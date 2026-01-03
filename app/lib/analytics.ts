import { db } from '@/app/firebase';
import {
    doc,
    runTransaction,
    increment,
    Timestamp,
    arrayUnion,
    arrayRemove
} from 'firebase/firestore';

/**
 * Updates the 'usedInQuizzes' count for questions when a quiz is created or updated.
 * @param questionIds List of question IDs currently in the quiz.
 * @param previousQuestionIds List of question IDs that were previously in the quiz (for updates).
 */
export async function updateQuestionUsage(questionIds: string[], previousQuestionIds: string[] = []) {
    const added = questionIds.filter(id => !previousQuestionIds.includes(id));
    const removed = previousQuestionIds.filter(id => !questionIds.includes(id));

    try {
        await runTransaction(db, async (transaction) => {
            // Increment usage for added questions
            for (const id of added) {
                const qRef = doc(db, 'questions', id);
                transaction.update(qRef, {
                    usageCount: increment(1),
                    lastUsedAt: Timestamp.now()
                });
            }

            // Decrement usage for removed questions
            for (const id of removed) {
                const qRef = doc(db, 'questions', id);
                transaction.update(qRef, {
                    usageCount: increment(-1)
                });
            }
        });
    } catch (error) {
        console.error("Failed to update question usage:", error);
    }
}

/**
 * Records performance data for questions after a quiz submission.
 * @param studentId The ID of the student who took the quiz.
 * @param quizId The ID of the quiz.
 * @param questionResults Array of results for each question.
 */
export async function recordQuestionPerformance(
    studentId: string,
    quizId: string,
    questionResults: {
        questionId: string,
        isCorrect: boolean,
        timeSpent?: number,
        chosenOption: string
    }[]
) {
    try {
        await runTransaction(db, async (transaction) => {
            for (const res of questionResults) {
                const qRef = doc(db, 'questions', res.questionId);

                // Define fields to update
                const updates: any = {
                    totalAttempts: increment(1),
                    [`optionCounts.${res.chosenOption}`]: increment(1),
                };

                if (res.isCorrect) {
                    updates.correctAttempts = increment(1);
                }

                if (res.timeSpent !== undefined) {
                    // Note: Average time is harder in Firestore without full doc read.
                    // We'll store totalTimeSpent and divide by totalAttempts on read.
                    updates.totalTimeSpent = increment(res.timeSpent);
                }

                transaction.update(qRef, updates);
            }
        });
    } catch (error) {
        console.error("Failed to record question performance:", error);
    }
}
