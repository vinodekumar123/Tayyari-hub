import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { adminDb } from '@/app/firebaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { quizId, userId, isAdmin } = await request.json();

        // Validate required fields
        if (!quizId || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Fetch quiz data
        const quizRef = adminDb.collection('quizzes').doc(quizId);
        const quizSnap = await quizRef.get();

        if (!quizSnap.exists) {
            return NextResponse.json(
                { error: 'Quiz not found' },
                { status: 404 }
            );
        }

        const quizData = quizSnap.data();

        // Admin bypass - skip all checks
        if (isAdmin) {
            return NextResponse.json({
                valid: true,
                quiz: quizData,
                message: 'Admin access granted'
            });
        }

        // Check series enrollment for restricted quizzes
        const isSeriesRestricted = quizData?.accessType === 'series' || quizData?.accessType === 'paid';

        if (isSeriesRestricted && quizData?.series && Array.isArray(quizData.series) && quizData.series.length > 0) {
            const enrollmentsRef = adminDb.collection('enrollments');
            const enrollmentsSnap = await enrollmentsRef
                .where('studentId', '==', userId)
                .where('status', '==', 'active')
                .get();

            const enrolledSeriesIds = new Set(enrollmentsSnap.docs.map(doc => doc.data().seriesId));
            const hasAccess = quizData.series.some((sId: string) => enrolledSeriesIds.has(sId));

            if (!hasAccess) {
                return NextResponse.json(
                    { error: 'You are not enrolled in the required Series for this quiz' },
                    { status: 403 }
                );
            }
        }

        // Check attempt limits
        const maxAttempts = quizData?.maxAttempts || 1;
        const attemptsRef = adminDb.collection('users').doc(userId).collection('quizAttempts');
        const attemptsSnap = await attemptsRef.get();

        let currentAttemptCount = 0;
        attemptsSnap.docs.forEach((docSnap) => {
            if (docSnap.id === quizId && docSnap.data()?.completed) {
                currentAttemptCount = docSnap.data().attemptNumber || 1;
            }
        });

        if (currentAttemptCount >= maxAttempts) {
            return NextResponse.json(
                { error: 'Maximum attempts reached for this quiz' },
                { status: 403 }
            );
        }

        // All checks passed
        return NextResponse.json({
            valid: true,
            quiz: quizData,
            currentAttemptCount,
            maxAttempts
        });

    } catch (error: any) {
        console.error('Quiz validation error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
