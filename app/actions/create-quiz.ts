'use server';

import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

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

        const MAX_QUESTIONS = 100;
        let totalRequested = 0;
        Object.values(questionsPerSubject).forEach(c => totalRequested += c);

        if (totalRequested > MAX_QUESTIONS) {
            throw new Error(`Total questions cannot exceed ${MAX_QUESTIONS}`);
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
            // Optimization: Filter by chapter if possible?
            // Firestore 'in' query supports up to 10 items.
            // If chapters for this subject are <= 10, we can use 'in'.
            // But we don't know easily which chapters belong to which subject without querying metadata or assuming config maps cleanly.
            // For simplicity and to match previous logic's broad capability:
            // We fetch ALL questions for the subject and filter in memory (server-side is fast).
            // OR better: construct multiple queries if chapters are few.

            // Let's stick to the "Fetch Subject" approach but safer.
            const questionsRef = adminDb.collection('mock-questions');
            const qSnap = await questionsRef.where('subject', '==', subject).get();

            if (qSnap.empty) {
                console.warn(`No questions found for subject: ${subject}`);
                continue;
            }

            let pool = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter by Chapters
            if (chapters.length > 0) {
                pool = pool.filter((q: any) => chapters.includes(q.chapter));
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

        // Transaction to save everything safely
        const newQuizRef = adminDb.collection('user-quizzes').doc();
        const quizId = newQuizRef.id;

        await adminDb.runTransaction(async (t) => {
            // 1. Create Quiz
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

            // 2. Update Usage for User
            const subjectToIds: Record<string, string[]> = {};
            allSelectedQuestions.forEach(q => {
                const s = q.subject;
                if (!subjectToIds[s]) subjectToIds[s] = [];
                subjectToIds[s].push(q.id);
            });

            for (const [subj, ids] of Object.entries(subjectToIds)) {
                const ref = userUsageRef.doc(subj);
                // We need to read again inside transaction for consistency? 
                // Ideally yes, but for analytics slight race is ok. 
                // Firestore Transaction requires Reads before Writes.
                // We'll just use arrayUnion if easier, but we track the whole set.
                // Let's do a merge with logic helper or just a simple read-modify-write.

                const doc = await t.get(ref);
                const existingUsed = new Set<string>(doc.exists ? (doc.data()?.usedQuestions || []) : []);
                ids.forEach(id => existingUsed.add(id));

                t.set(ref, {
                    usedQuestions: Array.from(existingUsed),
                    updatedAt: Timestamp.now()
                }, { merge: true });
            }

            // 3. Increment Global Usage (Batch/Transaction limit is 500 writes, be careful)
            // If we have 100 questions, this adds 100 writes. Total 100 + Subjects + 1. Safe.
            allSelectedQuestions.forEach(q => {
                const qRef = adminDb.collection('mock-questions').doc(q.id);
                t.update(qRef, {
                    usedInQuizzes: adminDb!.FieldValue.increment(1) // Assuming explicit update, fallback if doc missing? No, query found it.
                });
                // Note: If doc doesn't exist (rare race), transaction fails. 
                // We'll assume consistency from query phase.
            });
        });

        return { success: true, quizId };

    } catch (error: any) {
        console.error('Server Action Error:', error);
        return { success: false, error: error.message };
    }
}
