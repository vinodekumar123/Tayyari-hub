import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function logDebug(message: string) {
    try {
        const logPath = path.join(process.cwd(), 'debug_log.txt');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
    } catch (e) {
        // ignore logging errors
    }
}

export async function POST(request: NextRequest) {
    logDebug('Validation API called');
    try {
        // Check if adminDb is initialized
        if (!adminDb) {
            logDebug('Firebase Admin not initialized');
            console.error('[Validation API] Firebase Admin not initialized');
            return NextResponse.json(
                { error: 'Server configuration error - Firebase Admin not initialized' },
                { status: 500 }
            );
        }

        // Parse request body
        let body;
        try {
            body = await request.json();
            logDebug(`Request body parsed: ${JSON.stringify(body)}`);
        } catch (parseError) {
            console.error('[Validation API] Failed to parse request body:', parseError);
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const { quizId, userId, userRole } = body;

        // Validate required fields
        if (!quizId || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields: quizId and userId are required' },
                { status: 400 }
            );
        }

        // PARALLEL DATA FETCHING
        // We fetch all necessary data in parallel to minimize latency
        const quizPromise = adminDb.collection('quizzes').doc(quizId).get();

        // Fetch enrollments optimistically (we might not need them if public, but fetching is faster than waiting)
        const enrollmentPromise = adminDb.collection('enrollments')
            .where('studentId', '==', userId)
            .where('status', '==', 'active')
            .get();

        // Fetch attempt status
        const attemptPromise = adminDb.collection('users').doc(userId).collection('quizAttempts').doc(quizId).get();

        const [quizSnap, enrollmentsSnap, attemptSnap] = await Promise.all([
            quizPromise,
            enrollmentPromise,
            attemptPromise
        ]);

        if (!quizSnap.exists) {
            console.error('[Validation API] Quiz not found:', quizId);
            return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
        }

        const quizData = quizSnap.data();

        // Determine final user role (from request or default to student)
        const finalUserRole = userRole || 'student';

        // PREVIEW MODE: Admin and Teacher bypass all restrictions
        if (finalUserRole === 'admin' || finalUserRole === 'teacher') {
            return NextResponse.json({
                valid: true,
                mode: 'preview',
                quiz: quizData,
                userRole: finalUserRole,
                message: `${finalUserRole.charAt(0).toUpperCase() + finalUserRole.slice(1)} preview access granted`
            });
        }

        // STUDENT VALIDATION
        const validationErrors: string[] = [];

        // 1. Check if quiz is published
        if (!quizData?.published) {
            validationErrors.push('This quiz is not published yet');
        }

        // 2. Time Window Validation
        const now = new Date();

        if (quizData && quizData.startDate && quizData.startTime) {
            try {
                const startDateTime = new Date(`${quizData.startDate}T${quizData.startTime}`);
                if (!isNaN(startDateTime.getTime()) && now < startDateTime) {
                    validationErrors.push('This quiz has not started yet. Please check back later.');
                }
            } catch (e) {
                console.warn('[Validation API] Invalid start date/time format');
            }
        }

        if (quizData && quizData.endDate && quizData.endTime) {
            try {
                const endDateTime = new Date(`${quizData.endDate}T${quizData.endTime}`);
                if (!isNaN(endDateTime.getTime()) && now > endDateTime) {
                    validationErrors.push('This quiz has ended and is no longer available.');
                }
            } catch (e) {
                console.warn('[Validation API] Invalid end date/time format');
            }
        }

        // 3. Enrollment/Access Check
        // Use the pre-fetched enrollmentsSnap
        const isSeriesRestricted = quizData?.accessType === 'series' || quizData?.accessType === 'paid';

        if (isSeriesRestricted && quizData?.series && Array.isArray(quizData.series) && quizData.series.length > 0) {
            try {
                const enrolledSeriesIds = new Set(enrollmentsSnap.docs.map(doc => doc.data().seriesId));
                const hasAccess = quizData.series.some((sId: string) => enrolledSeriesIds.has(sId));

                if (!hasAccess) {
                    validationErrors.push('You are not enrolled in the required series or course for this quiz.');
                }
            } catch (enrollError: any) {
                console.error('[Validation API] Error checking enrollment:', enrollError.message);
                // Don't block on enrollment check error - allow access
            }
        }

        // If there are any validation errors, return them
        if (validationErrors.length > 0) {
            return NextResponse.json(
                {
                    valid: false,
                    errors: validationErrors,
                    primaryError: validationErrors[0]
                },
                { status: 403 }
            );
        }

        // 4. Check attempt limits
        // Use pre-fetched attemptSnap
        const maxAttempts = quizData?.maxAttempts || 1;
        let currentAttemptCount = 0;

        try {
            if (attemptSnap.exists) {
                const data = attemptSnap.data();
                if (data?.completed) {
                    currentAttemptCount = data.attemptNumber || 1;
                }
            }
        } catch (attemptError: any) {
            console.error('[Validation API] Error checking attempts:', attemptError.message);
            // Don't block on attempt check error
        }

        if (currentAttemptCount >= maxAttempts) {
            return NextResponse.json(
                {
                    valid: false,
                    errors: ['You have reached the maximum number of attempts for this quiz.'],
                    primaryError: 'Maximum attempts reached'
                },
                { status: 403 }
            );
        }

        // All checks passed - Student can attempt quiz
        console.log('[Validation API] Student validation passed');
        return NextResponse.json({
            valid: true,
            mode: 'attempt',
            quiz: quizData,
            userRole: finalUserRole,
            currentAttemptCount,
            maxAttempts
        });

    } catch (error: any) {
        console.error('[Validation API] Unexpected error:', error.message, error.stack);
        return NextResponse.json(
            { error: 'Internal server error: ' + (error.message || 'Unknown error') },
            { status: 500 }
        );
    }
}
