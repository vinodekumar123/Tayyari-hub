import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/firebaseAdmin';

// Rate limiting map (in-memory, simple implementation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = userId;
    const record = rateLimitMap.get(key);

    if (!record || now > record.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (record.count >= limit) {
        return false;
    }

    record.count++;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        const { quizId, userId, answers, flags, currentIndex, remainingTime } = await request.json();

        // Validate required fields
        if (!quizId || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Rate limiting: max 10 saves per minute per user
        if (!checkRateLimit(userId, 10, 60000)) {
            return NextResponse.json(
                { error: 'Too many save requests. Please wait a moment.' },
                { status: 429 }
            );
        }

        // Save progress
        const attemptRef = adminDb
            .collection('users')
            .doc(userId)
            .collection('quizAttempts')
            .doc(quizId);

        await attemptRef.set({
            answers: answers || {},
            flags: flags || {},
            currentIndex: currentIndex || 0,
            remainingTime: remainingTime || 0,
            completed: false,
            lastSaved: FieldValue.serverTimestamp()
        }, { merge: true });

        return NextResponse.json({
            success: true,
            message: 'Progress saved'
        });

    } catch (error: any) {
        console.error('Autosave error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to save progress' },
            { status: 500 }
        );
    }
}
