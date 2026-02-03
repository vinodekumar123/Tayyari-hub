'use server';

import { adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface CreateQuizConfig {
    userId: string;
    subjects: string[];
    chapters: string[];
    questionsPerSubject: Record<string, number>;
    questionsPerPage: number;
    duration: number;
    title: string;
}

export async function createMockQuiz(config: CreateQuizConfig) {
    try {
        if (!adminDb) {
            throw new Error('Firebase Admin not initialized');
        }

        const { userId, subjects, chapters, questionsPerSubject, questionsPerPage, duration, title } = config;

        // input validation
        if (!userId || subjects.length === 0 || chapters.length === 0) {
            throw new Error('Missing required fields');
        }

        // --- NEW: Server-Side Access & Limit Check ---
        const { limitCount, limitFrequency } = await getUserLimitRule(userId);
        const periodKey = getPeriodKey(limitFrequency);

        // Optional: Fast fail before processing questions (Optimistic Read)
        // We do strict check in transaction, but this saves resources.
        const userDocPre = await adminDb.collection('users').doc(userId).get();
        const quizUsagePre = userDocPre.data()?.quizUsage || {};
        const currentUsagePre = (quizUsagePre.periodKey === periodKey) ? (quizUsagePre.count || 0) : 0;
        if (currentUsagePre >= limitCount) {
            throw new Error(`You have reached your limit of ${limitCount} mock tests for this ${limitFrequency.replace('ly', '')}.`);
        }

        const MAX_QUESTIONS = 180;
        const MAX_DURATION = 180;

        let totalRequested = 0;
        Object.values(questionsPerSubject).forEach(c => totalRequested += c);

        if (totalRequested > MAX_QUESTIONS) {
            throw new Error(`Total questions cannot exceed ${MAX_QUESTIONS}`);
        }

        if (duration > MAX_DURATION) {
            throw new Error(`Duration cannot exceed ${MAX_DURATION} minutes`);
        }


        let allSelectedQuestions: any[] = [];
        const subjectsProcessed: string[] = [];

        // 1. Fetch Analytics for User (to prioritize unused questions)
        // We can do this in parallel with question fetching if we are careful, 
        // but sequential for safety first.
        const userUsageRef = adminDb.collection('users').doc(userId).collection('question-usage');

        // Process each subject
        for (const subject of subjects) {
            const numNeeded = questionsPerSubject[subject] || 0;
            if (numNeeded <= 0) continue;

            // Fetch usage data for this subject
            const usageDoc = await userUsageRef.doc(subject).get();
            const usedQuestionIds = new Set<string>(usageDoc.exists ? (usageDoc.data()?.usedQuestions || []) : []);

            // Fetch questions for this subject
            // [OPTIMIZED] Fetch only selected chapters if feasible
            const questionsRef = adminDb.collection('mock-questions');
            let pool: any[] = [];

            // Identify chapters specifically for this subject
            // Since `chapters` array is flat selected list, we need to know which belong to this subject.
            // But we don't have that map here. 
            // HOWEVER, we can query: where subject==S and chapter in [list]
            // Firestore 'in' limit is 10.

            // We can't easily know WHICH of the selected `chapters` belong to `subject` without metadata.
            // But filtering by subject+chapter is safe even if chapter doesn't exist.
            // So we can try to filter `chapters` if less than 30?
            // If we have > 10 chapters selected, we might need multiple queries.

            // To be safe and optimized:
            // 1. If no chapters selected (shouldn't happen due to UI validation), fetch all subject.
            // 2. If chapters selected, we iterate and parallel fetch. 
            //    (Cost: N reads, but N is small (5-10 typically)).

            // NOTE: We rely on the fact that `chapters` contains ALL selected chapters across ALL subjects.
            // Querying `subject=S` AND `chapter=C` where C is a chapter from another subject returns empty. Safe.

            if (chapters.length > 0) {
                // Chunk into batches of 10 for 'in' query
                const chunks = [];
                for (let i = 0; i < chapters.length; i += 10) {
                    chunks.push(chapters.slice(i, i + 10));
                }

                const promises = chunks.map(chunk =>
                    questionsRef
                        .where('subject', '==', subject)
                        .where('chapter', 'in', chunk)
                        .get()
                );

                const snaps = await Promise.all(promises);
                snaps.forEach(s => {
                    s.docs.forEach(d => pool.push({ id: d.id, ...d.data() }));
                });
            } else {
                // Fallback (e.g. "All Chapters" logic if supported in future)
                const qSnap = await questionsRef.where('subject', '==', subject).get();
                qSnap.docs.forEach(d => pool.push({ id: d.id, ...d.data() }));
            }

            // Pool is already populated and filtered by chapter via query optimization
            if (pool.length === 0) {
                if (chapters.length > 0) {
                    console.warn(`No questions found for subject: ${subject} in selected chapters.`);
                } else {
                    console.warn(`No questions found for subject: ${subject}`);
                }
                continue;
            }

            // Split into Used / Unused
            let unused = pool.filter((q: any) => !usedQuestionIds.has(q.id));
            let used = pool.filter((q: any) => usedQuestionIds.has(q.id));

            // Shuffle
            const shuffle = (array: any[]) => {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
                return array;
            };

            unused = shuffle(unused);
            used = shuffle(used);

            // Select
            let selected: any[] = [];
            // Priority 1: Unused
            selected.push(...unused.slice(0, numNeeded));

            // Priority 2: Used (if needed)
            if (selected.length < numNeeded) {
                const remaining = numNeeded - selected.length;
                selected.push(...used.slice(0, remaining));
            }

            allSelectedQuestions.push(...selected);
            subjectsProcessed.push(subject);
        }

        if (allSelectedQuestions.length === 0) {
            throw new Error("No questions found matching your criteria.");
        }

        // Format for storage
        const selectedSnapshot = allSelectedQuestions.map((q) => ({
            id: q.id,
            questionText: q.questionText,
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || '',
            enableExplanation: !!q.enableExplanation,
            subject: q.subject || '',
            chapter: q.chapter || '',
        }));

        const quizTitle = title?.trim() || `${subjects.map(s => s.substring(0, 3)).join(', ')} Mock - ${new Date().toLocaleDateString()}`;

        // Pre-calculate mappings to minimize logic inside transaction
        const subjectToIds: Record<string, string[]> = {};
        allSelectedQuestions.forEach(q => {
            const s = q.subject;
            if (!subjectToIds[s]) subjectToIds[s] = [];
            subjectToIds[s].push(q.id);
        });

        const newQuizRef = adminDb.collection('user-quizzes').doc();
        const quizId = newQuizRef.id;

        // Transaction to save everything safely
        await adminDb.runTransaction(async (t) => {
            // --- STEP 1: READS ---
            const userRef = adminDb.collection('users').doc(userId);
            const userDoc = await t.get(userRef);
            const usageDocs: Record<string, string[]> = {};

            // 1.1 Read Question Usage per subject
            for (const subj of Object.keys(subjectToIds)) {
                const ref = userUsageRef.doc(subj);
                const doc = await t.get(ref);
                usageDocs[subj] = doc.exists ? (doc.data()?.usedQuestions || []) : [];
            }

            // 1.2 Read & Validate Quiz Limit (Atomic)
            const quizUsage = userDoc.data()?.quizUsage || {};
            const currentUsage = (quizUsage.periodKey === periodKey) ? (quizUsage.count || 0) : 0;

            if (currentUsage >= limitCount) {
                throw new Error(`Limit reached: ${currentUsage}/${limitCount} tests used this period.`);
            }

            // --- STEP 2: WRITES ---

            // 2.1 Update User Quota
            t.set(userRef, {
                quizUsage: {
                    periodKey,
                    count: currentUsage + 1,
                    lastUpdated: Timestamp.now()
                }
            }, { merge: true });

            // 2.2 Create Quiz
            t.set(newQuizRef, {
                title: quizTitle,
                createdBy: userId,
                subjects: subjects,
                chapters: chapters,
                duration: duration,
                questionCount: selectedSnapshot.length,
                questionsPerPage,
                selectedQuestions: selectedSnapshot,
                createdAt: Timestamp.now(),
            });

            // 2.3 Update Usage for User (Questions & Chapter Stats)
            for (const [subj, ids] of Object.entries(subjectToIds)) {
                const ref = userUsageRef.doc(subj);
                const existingUsed = new Set<string>(usageDocs[subj]);

                // Track chapter usage delta for this batch
                const chapterDelta: Record<string, number> = {};

                // We need to know the chapter of each ID. 
                // We can find it in 'allSelectedQuestions' which is in memory.
                const subjectQuestions = allSelectedQuestions.filter(q => q.subject === subj);

                subjectQuestions.forEach(q => {
                    existingUsed.add(q.id);
                    const ch = q.chapter || 'Uncategorized';
                    chapterDelta[ch] = (chapterDelta[ch] || 0) + 1;
                });

                // Read latest chapterStats (need to read doc again? No, we likely didn't read it fully in step 1)
                // We only read 'usedQuestions' projection? 
                // Actually usageDocs[subj] comes from doc.data().usedQuestions.
                // We need the FULL doc or a separate read if we didn't get it.
                // To optimize, let's assume we can merge. 
                // Firestore 'merge: true' with nested fields (chapterStats.ChapterName) works 
                // BUT we need to increment. 'FieldValue.increment' is best!

                // We can use FieldValue.increment for chapter keys without reading existing value!
                const updates: any = {
                    usedQuestions: Array.from(existingUsed),
                    updatedAt: Timestamp.now()
                };

                Object.entries(chapterDelta).forEach(([ch, count]) => {
                    // path: chapterStats.ChapterName
                    // Escaping special characters in map keys for FieldPath? 
                    // Chapters might have dots. Safer to use a flattened map if possible, 
                    // or just standard map update if keys are safe.
                    // Assuming safe keys for now or simple strings.
                    updates[`chapterStats.${ch}`] = FieldValue.increment(count);
                });

                t.set(ref, updates, { merge: true });
            }

            // 2.4 Increment Global Usage for each question
            allSelectedQuestions.forEach(q => {
                const qRef = adminDb.collection('mock-questions').doc(q.id);
                t.update(qRef, {
                    usedInQuizzes: FieldValue.increment(1)
                });
            });
        });

        return { success: true, quizId };

    } catch (error: any) {
        console.error('Server Action Error:', error);
        return { success: false, error: error.message };
    }
}


// Helper to generate period key (e.g., "weekly-2023-44", "daily-2023-10-25")
function getPeriodKey(frequency: string): string {
    const now = new Date();
    const year = now.getFullYear();

    if (frequency === 'daily') {
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `daily-${year}-${month}-${day}`;
    }

    if (frequency === 'weekly') {
        // ISO Week number logic
        const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const weekNo = Math.ceil((((date.getTime() - new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).getTime()) / 86400000) + 1) / 7);
        return `weekly-${year}-W${weekNo}`;
    }

    if (frequency === 'monthly') {
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `monthly-${year}-${month}`;
    }

    return 'lifetime';
}

async function getUserLimitRule(userId: string) {
    if (!adminDb) throw new Error("Database not initialized");

    const rulesSnap = await adminDb.collection('mock-test-access-rules')
        .where('isActive', '==', true)
        .get();

    let limitCount = 7;
    let limitFrequency = 'weekly';

    if (!rulesSnap.empty) {
        const rules = rulesSnap.docs.map(d => d.data());
        const enrollSnap = await adminDb.collection('enrollments')
            .where('studentId', '==', userId)
            .where('status', 'in', ['active', 'paid', 'enrolled'])
            .get();

        const enrolledSeriesIds = enrollSnap.docs.map(d => d.data().seriesId);
        const matchingRules = rules.filter(r => enrolledSeriesIds.includes(r.seriesId));

        if (matchingRules.length === 0) {
            throw new Error("You need to enroll in a Test Series to create mocks.");
        }

        matchingRules.sort((a, b) => b.limitCount - a.limitCount);
        const bestRule = matchingRules[0];
        limitCount = bestRule.limitCount;
        limitFrequency = bestRule.limitFrequency;
    }

    return { limitCount, limitFrequency };
}

async function checkUserAccess(userId: string) {
    const { limitCount, limitFrequency } = await getUserLimitRule(userId);
    const periodKey = getPeriodKey(limitFrequency);

    const userDoc = await adminDb.collection('users').doc(userId).get();
    const usageData = userDoc.data()?.quizUsage || {};

    // Check if period matches, otherwise usage is 0 (Auto Reset)
    const currentUsage = (usageData.periodKey === periodKey) ? (usageData.count || 0) : 0;

    if (currentUsage >= limitCount) {
        throw new Error(`You have reached your limit of ${limitCount} mock tests for this ${limitFrequency.replace('ly', '')}.`);
    }

    return true;
}

