import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/firebaseAdmin';

// Generate idempotency key from request
function generateIdempotencyKey(userId: string, quizId: string, timestamp: number): string {
    return `${userId}_${quizId}_${timestamp}`;
}

export async function POST(request: NextRequest) {
    try {
        const {
            quizId,
            userId,
            answers,
            flags,
            timeLogs,
            attemptNumber,
            timestamp
        } = await request.json();

        // Validate required fields
        if (!quizId || !userId || !answers) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Idempotency check - prevent double submission
        const idempotencyKey = generateIdempotencyKey(userId, quizId, timestamp || Date.now());
        const submissionRef = adminDb.collection('submissions').doc(idempotencyKey);
        const existingSubmission = await submissionRef.get();

        if (existingSubmission.exists) {
            return NextResponse.json(
                {
                    success: true,
                    cached: true,
                    message: 'Submission already processed',
                    result: existingSubmission.data()
                }
            );
        }

        // Fetch quiz data for scoring
        const quizRef = adminDb.collection('quizzes').doc(quizId);
        const quizSnap = await quizRef.get();

        if (!quizSnap.exists) {
            return NextResponse.json(
                { error: 'Quiz not found' },
                { status: 404 }
            );
        }

        const quizData = quizSnap.data();
        const selectedQuestions = quizData?.selectedQuestions || [];

        // Calculate score server-side (secure)
        let score = 0;
        const total = selectedQuestions.length;

        for (const question of selectedQuestions) {
            if (question.graceMark || answers[question.id] === question.correctAnswer) {
                score += 1;
            }
        }

        // Prepare result data
        const resultData = {
            quizId,
            title: quizData?.title || 'Untitled Quiz',
            score,
            total,
            timestamp: FieldValue.serverTimestamp(),
            answers: answers || {},
            flags: flags || {},
            timeLogs: timeLogs || {},
            attemptNumber: attemptNumber || 1,
            submittedAt: FieldValue.serverTimestamp()
        };

        // Atomic batch write
        const batch = adminDb.batch();

        // 1. Save result
        const resultRef = adminDb
            .collection('users')
            .doc(userId)
            .collection('quizAttempts')
            .doc(quizId)
            .collection('results')
            .doc(quizId);

        batch.set(resultRef, resultData);

        // 2. Mark attempt as completed
        const attemptRef = adminDb
            .collection('users')
            .doc(userId)
            .collection('quizAttempts')
            .doc(quizId);

        batch.set(attemptRef, {
            completed: true,
            submittedAt: FieldValue.serverTimestamp(),
            remainingTime: 0,
            attemptNumber: attemptNumber || 1
        }, { merge: true });

        // 3. Store idempotency record
        batch.set(submissionRef, {
            ...resultData,
            processedAt: FieldValue.serverTimestamp()
        });

        // Commit all changes atomically
        await batch.commit();

        // Async: Update analytics (non-blocking)
        updateAnalyticsAsync(userId, quizId, {
            score,
            total,
            answers,
            selectedQuestions,
            subject: quizData?.subject,
            timeLogs
        }).catch(err => {
            console.error('Analytics update failed (non-critical):', err);
        });

        return NextResponse.json({
            success: true,
            score,
            total,
            message: 'Quiz submitted successfully'
        });

    } catch (error: any) {
        console.error('Quiz submission error:', error);
        return NextResponse.json(
            { error: error.message || 'Submission failed' },
            { status: 500 }
        );
    }
}

// Async analytics update (non-blocking)
async function updateAnalyticsAsync(
    userId: string,
    quizId: string,
    data: {
        score: number;
        total: number;
        answers: Record<string, string>;
        selectedQuestions: any[];
        subject: any;
        timeLogs: Record<string, number>;
    }
) {
    try {
        // Dynamic import to avoid blocking main flow
        const { updateStudentStats } = await import('@/app/lib/student-stats');
        const { recordQuestionPerformance } = await import('@/app/lib/analytics');

        await updateStudentStats(userId, {
            quizId,
            score: data.score,
            total: data.total,
            answers: data.answers,
            selectedQuestions: data.selectedQuestions,
            subject: Array.isArray(data.subject)
                ? data.subject.map((s: any) => s.name || s)
                : (typeof data.subject === 'object' ? data.subject?.name : data.subject),
            timestamp: FieldValue.serverTimestamp() as any
        }, 'admin');

        const questionResults = data.selectedQuestions.map(q => ({
            questionId: q.id,
            isCorrect: q.graceMark || data.answers[q.id] === q.correctAnswer,
            chosenOption: data.answers[q.id] || 'unanswered',
            timeSpent: data.timeLogs[q.id] || 0,
            graceMark: q.graceMark || false
        }));

        await recordQuestionPerformance(userId, quizId, questionResults);
    } catch (error) {
        console.error('Analytics async update error:', error);
        // Don't throw - this is non-critical
    }
}
