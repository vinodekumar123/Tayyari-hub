import { db } from '@/app/firebase';
import { doc, runTransaction, Timestamp, increment, arrayUnion } from 'firebase/firestore';

export interface QuizResult {
    quizId: string;
    score: number;
    total: number;
    answers: Record<string, string>;
    selectedQuestions: any[]; // Or a more specific type if available
    subject?: string | string[]; // Can be a string or array of strings
    timestamp: Timestamp;
}

export async function updateStudentStats(userId: string, result: QuizResult, type: 'admin' | 'user') {
    const userRef = doc(db, 'users', userId);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) return;

            const data = userDoc.data();
            const stats = data.stats || {
                totalQuizzes: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                totalWrong: 0,
                totalTime: 0,
                overallAccuracy: 0,
                lastQuizDate: null,
                totalMockQuizzes: 0,
                totalMockQuestions: 0,
                totalMockCorrect: 0,
                mockAccuracy: 0,
                subjectStats: {}
            };

            // Calculate new values based on this result
            const questionsAttempted = Object.keys(result.answers).length;
            // We assume result.score is the number of correct answers
            const correct = result.score;
            const wrong = questionsAttempted - correct; // inaccurate if score logic is different, but standard for 1 point/question
            // If result.total is different from attempts, we might want to track 'questions presented' vs 'questions attempted'. 
            // Requirement says "Total questions, attempted, correct, wrong, unattempted".
            // Let's stick to simple "questions attempted" for the aggregate for now, or use result.total for "Total Questions".
            // Let's use questionsAttempted for accuracy calculation.

            if (type === 'admin') {
                stats.totalQuizzes = (stats.totalQuizzes || 0) + 1;
                stats.totalQuestions = (stats.totalQuestions || 0) + questionsAttempted;
                stats.totalCorrect = (stats.totalCorrect || 0) + correct;
                stats.totalWrong = (stats.totalWrong || 0) + wrong;
                // Add totalScore for Leaderboard
                stats.totalScore = (stats.totalScore || 0) + result.score;
                // Total Time? Passed in result? The limit was passed, but actual time taken?
                // We'll skip time for now as it wasn't passed in the simple result object payload in the plan, 
                // but we can add it if available in the calling context.

                stats.overallAccuracy = stats.totalQuestions > 0
                    ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
                    : 0;

                stats.lastQuizDate = result.timestamp;

                // Subject Stats
                // Handle array of subjects or single subject
                const subjects = Array.isArray(result.subject) ? result.subject : [result.subject || 'Uncategorized'];

                subjects.forEach((sub: string) => {
                    // Fix: Clean up subject name if it's an object (shouldn't be based on calling code, but safe to check)
                    const subjectName = typeof sub === 'object' ? (sub as any).name : sub;
                    if (!subjectName) return;

                    if (!stats.subjectStats[subjectName]) {
                        stats.subjectStats[subjectName] = { attempted: 0, correct: 0, wrong: 0, accuracy: 0 };
                    }

                    // We need to know how many questions belonging to THIS subject were answered/correct.
                    // If the quiz is mixed, we need per-question subject info.
                    // The `result.selectedQuestions` should have `subject` on them.

                    // Recalculate per-subject breakdown from the specific questions in this result
                    // This is more accurate than assuming the whole quiz belongs to the quiz.subject

                    // However, if we are inside this loop, we might be double counting if we iterate all questions for every subject tag.
                    // Better strategy: Iterate questions once, update stats, then merge.
                });

                // Precise Subject Breakdown
                result.selectedQuestions.forEach(q => {
                    const qSub = q.subject?.name || q.subject || 'Uncategorized';
                    // User answer
                    const ans = result.answers[q.id];
                    if (ans) { // Attempted
                        if (!stats.subjectStats[qSub]) {
                            stats.subjectStats[qSub] = { attempted: 0, correct: 0, wrong: 0, accuracy: 0 };
                        }
                        const sStat = stats.subjectStats[qSub];
                        sStat.attempted++;
                        if (ans === q.correctAnswer) {
                            sStat.correct++;
                        } else {
                            sStat.wrong++;
                        }
                        sStat.accuracy = Math.round((sStat.correct / sStat.attempted) * 100);
                    }
                });

            } else {
                // Mock / User Quiz
                stats.totalMockQuizzes = (stats.totalMockQuizzes || 0) + 1;
                stats.totalMockQuestions = (stats.totalMockQuestions || 0) + questionsAttempted;
                stats.totalMockCorrect = (stats.totalMockCorrect || 0) + correct;
                stats.mockAccuracy = stats.totalMockQuestions > 0
                    ? Math.round((stats.totalMockCorrect / stats.totalMockQuestions) * 100)
                    : 0;

                // Optionally update subject stats for mocks too? 
                // User request: "Update mock question bank statistics ... Total questions, Questions used".
                // This is handled by 'usedMockQuestionIds' array update which is already done in the caller.
            }

            transaction.update(userRef, { stats });
        });
    } catch (e) {
        console.error("Failed to update student stats:", e);
    }
}
