import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// GET /api/students/[id] - Get single student by ID
export async function GET(
    request: NextRequest,
    context: any
) {
    try {
        // 1. Auth & RBAC Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Missing token' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        if (decodedToken.role !== 'admin' && decodedToken.admin !== true) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const { params } = context;
        const { id } = await params; // Next.js 15 params are async, need await or treat as promise if strictly typed in newer versions, but context.params is usually object in older. adhering to standard handling.

        if (!id) {
            return NextResponse.json({ success: false, error: 'Student ID is required' }, { status: 400 });
        }

        // Fetch student document
        const studentDoc = await adminDb.collection('users').doc(id).get();

        if (!studentDoc.exists) {
            return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
        }

        const studentData = studentDoc.data();

        // Fetch student's quiz attempts (limit 10)
        const quizAttemptsSnapshot = await adminDb
            .collection('users')
            .doc(id)
            .collection('quizAttempts')
            .orderBy('submittedAt', 'desc')
            .limit(10)
            .get();

        const quizAttempts = quizAttemptsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                submittedAt: data.submittedAt?.toDate?.()?.toISOString() || null,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                id: studentDoc.id,
                fullName: studentData?.fullName || '',
                email: studentData?.email || '',
                phone: studentData?.phone || '',
                photoURL: studentData?.photoURL || null,
                createdAt: studentData?.createdAt?.toDate?.()?.toISOString() || null,
                stats: studentData?.stats || {},
                usedMockQuestionIds: studentData?.usedMockQuestionIds || [],
                recentAttempts: quizAttempts,
            },
        });
    } catch (error: any) {
        console.error('Error fetching student:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch student' },
            { status: 500 }
        );
    }
}
