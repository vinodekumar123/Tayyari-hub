
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/lib/firebase-admin';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Issue types for quality analysis
type IssueType = 'missing_options' | 'missing_explanation' | 'invalid_correct_answer' | 'missing_correct_answer' | 'ai_detected';

interface QualityIssue {
    questionId: string;
    issues: {
        type: IssueType;
        comment: string;
    }[];
}

interface ChapterResult {
    duplicateGroups: string[][];
    qualityIssues: QualityIssue[];
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            subject,
            chapters,           // Array of chapters (new)
            chapter,            // Single chapter (legacy support)
            enableAiAnalysis = true,
            enableQualityCheck = false
        } = body;

        // Support both single chapter (legacy) and multiple chapters
        const chaptersToProcess = chapters || (chapter ? [chapter] : []);

        if (!subject || chaptersToProcess.length === 0) {
            return NextResponse.json({ error: 'Subject and at least one Chapter are required' }, { status: 400 });
        }

        const byChapter: Record<string, ChapterResult> = {};
        let totalProcessed = 0;

        // Process each chapter sequentially
        for (const chap of chaptersToProcess) {
            const result = await processChapter(subject, chap, enableAiAnalysis, enableQualityCheck);
            byChapter[chap] = result;
            totalProcessed += result.totalQuestions || 0;
        }

        // For legacy compatibility, also return flat allGroups
        const allGroups = Object.values(byChapter).flatMap(r => r.duplicateGroups);

        return NextResponse.json({
            totalProcessed,
            byChapter,
            allGroups, // Legacy support
            exactDuplicates: allGroups, // Legacy support
            aiDuplicates: []
        });

    } catch (error: any) {
        console.error('Find Repeated Error:', error);
        return NextResponse.json({ error: 'Failed to analyze duplicates', details: error.message }, { status: 500 });
    }
}

async function processChapter(
    subject: string,
    chapter: string,
    enableAiAnalysis: boolean,
    enableQualityCheck: boolean
): Promise<ChapterResult & { totalQuestions: number }> {
    // Fetch questions from Firestore
    const questionsRef = adminDb.collection('mock-questions');
    let query = questionsRef
        .where('subject', '==', subject)
        .where('chapter', '==', chapter)
        .where('isDeleted', '!=', true);

    const snapshot = await query.get();

    if (snapshot.empty) {
        return { duplicateGroups: [], qualityIssues: [], totalQuestions: 0 };
    }

    const questions = snapshot.docs.map(doc => ({
        id: doc.id,
        text: doc.data().questionText,
        options: doc.data().options || [],
        correctAnswer: doc.data().correctAnswer,
        explanation: doc.data().explanation,
        ...doc.data()
    }));

    // 1. Initial Fast Matching (Exact matches after stripping HTML/Whitespace)
    const normalize = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();

    const normalizedMap: Record<string, typeof questions> = {};
    const exactDuplicates: string[][] = [];

    questions.forEach(q => {
        const normText = normalize(q.text);
        const normOptions = (q.options || [])
            .map((opt: string) => normalize(opt))
            .sort()
            .join('|');

        const compositeKey = `${normText}###${normOptions}`;

        if (!normalizedMap[compositeKey]) normalizedMap[compositeKey] = [];
        normalizedMap[compositeKey].push(q);
    });

    const seenInExact = new Set<string>();
    Object.values(normalizedMap).forEach(group => {
        if (group.length > 1) {
            exactDuplicates.push(group.map(q => q.id));
            group.forEach(q => seenInExact.add(q.id));
        }
    });

    // 2. Semantic Analysis using AI (if enabled)
    let aiDuplicates: string[][] = [];
    if (enableAiAnalysis) {
        const remainingQuestions = questions.filter(q => !seenInExact.has(q.id));

        if (remainingQuestions.length > 1) {
            const BATCH_SIZE = 30;
            for (let i = 0; i < remainingQuestions.length; i += BATCH_SIZE) {
                const batch = remainingQuestions.slice(i, i + BATCH_SIZE);
                const result = await findSemanticDuplicates(batch);
                if (result && result.duplicateGroups) {
                    aiDuplicates = [...aiDuplicates, ...result.duplicateGroups];
                }
            }
        }
    }

    // 3. Quality Check (if enabled)
    let qualityIssues: QualityIssue[] = [];
    if (enableQualityCheck) {
        qualityIssues = await analyzeQuestionQuality(questions);
    }

    return {
        duplicateGroups: [...exactDuplicates, ...aiDuplicates],
        qualityIssues,
        totalQuestions: questions.length
    };
}

async function findSemanticDuplicates(questions: any[]) {
    if (questions.length < 2) return null;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const list = questions.map(q => ({
        id: q.id,
        text: (q.text || '').replace(/<[^>]*>?/gm, '').substring(0, 300),
        options: (q.options || []).map((opt: string) => (opt || '').replace(/<[^>]*>?/gm, '').substring(0, 100))
    }));

    const prompt = `
        You are an AI assistant helping an administrator clean up a question bank.
        Identify questions that are semantically identical. 
        A duplicate is defined as a question that has the same core query AND the same set of options (even if ordered differently).
        
        Questions Data:
        ${JSON.stringify(list, null, 2)}
        
        OUTPUT RULES:
        1. Return ONLY valid JSON.
        2. Identify groups of IDs that are TRUE duplicates (same question and options).
        3. Format: { "duplicateGroups": [ ["id1", "id2"], ["id4", "id5", "id6"] ] }
        4. Do not include a question ID in more than one group.
        5. If no duplicates are found, return { "duplicateGroups": [] }.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        let text = response.text();

        if (text.includes('```')) {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        return JSON.parse(text);
    } catch (e) {
        console.error('AI Semantic Duplicate Check Failed:', e);
        return null;
    }
}

async function analyzeQuestionQuality(questions: any[]): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // First pass: Check for structural issues
    for (const q of questions) {
        const questionIssues: QualityIssue['issues'] = [];

        // Check for missing options (less than 4)
        if (!q.options || q.options.length < 4) {
            questionIssues.push({
                type: 'missing_options',
                comment: `Question has ${q.options?.length || 0} options. Expected 4 options for MCQ.`
            });
        }

        // Check for empty options
        if (q.options) {
            const emptyOptions = q.options.filter((opt: string) => !opt || opt.trim() === '');
            if (emptyOptions.length > 0) {
                questionIssues.push({
                    type: 'missing_options',
                    comment: `${emptyOptions.length} option(s) are empty or blank.`
                });
            }
        }

        // Check for missing correct answer
        if (!q.correctAnswer || q.correctAnswer.trim() === '') {
            questionIssues.push({
                type: 'missing_correct_answer',
                comment: 'No correct answer is specified for this question.'
            });
        }

        // Check if correct answer exists in options
        if (q.correctAnswer && q.options) {
            const normalizedCorrect = (q.correctAnswer || '').replace(/<[^>]*>?/gm, '').trim().toLowerCase();
            const normalizedOptions = q.options.map((opt: string) => (opt || '').replace(/<[^>]*>?/gm, '').trim().toLowerCase());

            if (!normalizedOptions.includes(normalizedCorrect)) {
                questionIssues.push({
                    type: 'invalid_correct_answer',
                    comment: `Correct answer "${q.correctAnswer.substring(0, 50)}..." is not found in the available options.`
                });
            }
        }

        // Check for missing explanation
        if (!q.explanation || q.explanation.trim() === '' || q.explanation.trim() === '<p></p>') {
            questionIssues.push({
                type: 'missing_explanation',
                comment: 'No explanation is provided for this question.'
            });
        }

        if (questionIssues.length > 0) {
            issues.push({
                questionId: q.id,
                issues: questionIssues
            });
        }
    }

    // Second pass: AI-based content analysis (for questions that passed structural checks)
    const structurallyValidQuestions = questions.filter(
        q => !issues.find(i => i.questionId === q.id)
    );

    if (structurallyValidQuestions.length > 0) {
        const aiIssues = await analyzeContentWithAI(structurallyValidQuestions);
        issues.push(...aiIssues);
    }

    return issues;
}

async function analyzeContentWithAI(questions: any[]): Promise<QualityIssue[]> {
    if (questions.length === 0) return [];

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const issues: QualityIssue[] = [];

    // Process in batches
    const BATCH_SIZE = 15;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);

        const list = batch.map(q => ({
            id: q.id,
            question: (q.text || '').replace(/<[^>]*>?/gm, '').substring(0, 400),
            options: (q.options || []).map((opt: string) => (opt || '').replace(/<[^>]*>?/gm, '').substring(0, 150)),
            correctAnswer: (q.correctAnswer || '').replace(/<[^>]*>?/gm, '').substring(0, 150)
        }));

        const prompt = `
            You are an expert MCQ quality reviewer for medical entrance exams (MDCAT).
            Analyze these questions for content issues ONLY (not structural issues).
            
            Check for:
            1. Ambiguous questions with multiple valid interpretations
            2. Incorrect/wrong correct answer (scientifically wrong)
            3. Misleading or confusing wording
            4. Options that are too similar to distinguish
            5. Question stem that doesn't match the options
            
            Questions:
            ${JSON.stringify(list, null, 2)}
            
            OUTPUT RULES:
            1. Return ONLY valid JSON.
            2. Only flag questions with CLEAR issues (be conservative).
            3. Format: { "issues": [ { "id": "question_id", "comment": "Specific explanation of what's wrong" } ] }
            4. If no issues found, return { "issues": [] }.
            5. Keep comments concise but specific (max 100 chars).
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            let text = response.text();

            if (text.includes('```')) {
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            const parsed = JSON.parse(text);
            if (parsed.issues && Array.isArray(parsed.issues)) {
                for (const issue of parsed.issues) {
                    if (issue.id && issue.comment) {
                        issues.push({
                            questionId: issue.id,
                            issues: [{
                                type: 'ai_detected',
                                comment: issue.comment
                            }]
                        });
                    }
                }
            }
        } catch (e) {
            console.error('AI Content Analysis Failed:', e);
        }
    }

    return issues;
}
