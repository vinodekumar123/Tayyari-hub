
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/lib/firebase-admin';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { subject, chapter } = body;

        if (!subject || !chapter) {
            return NextResponse.json({ error: 'Subject and Chapter are required' }, { status: 400 });
        }

        // Fetch questions from Firestore
        const questionsRef = adminDb.collection('mock-questions');
        let query = questionsRef
            .where('subject', '==', subject)
            .where('chapter', '==', chapter)
            .where('isDeleted', '!=', true);

        const snapshot = await query.get();

        if (snapshot.empty) {
            return NextResponse.json({ duplicates: [], message: 'No questions found for this chapter.' });
        }

        const questions = snapshot.docs.map(doc => ({
            id: doc.id,
            text: doc.data().questionText,
            options: doc.data().options || []
        }));

        // 1. Initial Fast Matching (Exact matches after stripping HTML/Whitespace)
        const normalize = (html: string) => html.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();

        const normalizedMap: Record<string, typeof questions> = {};
        const exactDuplicates: string[][] = [];

        questions.forEach(q => {
            const normText = normalize(q.text);
            const normOptions = (q.options || [])
                .map((opt: string) => normalize(opt))
                .sort() // Sort to match even if options are in different order
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

        // 2. Semantic Analysis using AI for remaining questions
        const remainingQuestions = questions.filter(q => !seenInExact.has(q.id));

        let aiDuplicates: string[][] = [];
        if (remainingQuestions.length > 1) {
            const BATCH_SIZE = 30; // Reduced batch size due to more data (options) per question
            for (let i = 0; i < remainingQuestions.length; i += BATCH_SIZE) {
                const batch = remainingQuestions.slice(i, i + BATCH_SIZE);
                const result = await findSemanticDuplicates(batch);
                if (result && result.duplicateGroups) {
                    aiDuplicates = [...aiDuplicates, ...result.duplicateGroups];
                }
            }
        }

        return NextResponse.json({
            totalProcessed: questions.length,
            exactDuplicates,
            aiDuplicates,
            allGroups: [...exactDuplicates, ...aiDuplicates]
        });

    } catch (error: any) {
        console.error('Find Repeated Error:', error);
        return NextResponse.json({ error: 'Failed to analyze duplicates', details: error.message }, { status: 500 });
    }
}

async function findSemanticDuplicates(questions: any[]) {
    if (questions.length < 2) return null;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Create a compact list for the AI including options
    const list = questions.map(q => ({
        id: q.id,
        text: q.text.replace(/<[^>]*>?/gm, '').substring(0, 300),
        options: (q.options || []).map((opt: string) => opt.replace(/<[^>]*>?/gm, '').substring(0, 100))
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

        // Clean JSON
        if (text.includes('```')) {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        return JSON.parse(text);
    } catch (e) {
        console.error('AI Semantic Duplicate Check Failed:', e);
        return null;
    }
}
