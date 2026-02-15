import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Query } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// GET /api/quizzes - Get paginated list of quizzes
export async function GET(request: NextRequest) {
    try {
        // 1. Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid token' }, { status: 401 });
        }

        // 2. Parse Params
        const searchParams = request.nextUrl.searchParams;
        const limitStr = searchParams.get('limit') || '20';
        const limitVal = parseInt(limitStr);
        const startAfterId = searchParams.get('startAfter');

        const quizType = searchParams.get('type'); // 'admin' or 'user'
        const subject = searchParams.get('subject');

        // 3. Build Query
        let queryRef: Query = adminDb.collection('quizes');

        // Apply filters
        if (quizType) {
            queryRef = queryRef.where('quizType', '==', quizType);
        }
        if (subject) {
            queryRef = queryRef.where('subject', '==', subject);
        }

        // Apply Sort (Default: createdDate desc)
        queryRef = queryRef.orderBy('createdDate', 'desc');

        // Cursor Pagination
        if (startAfterId) {
            const startAfterDoc = await adminDb.collection('quizes').doc(startAfterId).get();
            if (startAfterDoc.exists) {
                queryRef = queryRef.startAfter(startAfterDoc);
            }
        }

        queryRef = queryRef.limit(limitVal);

        const snapshot = await queryRef.get();

        const quizzes = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title || '',
                subject: data.subject || '',
                quizType: data.quizType || 'admin',
                totalQuestions: data.questions?.length || 0,
                duration: data.duration || 0,
                createdDate: data.createdDate?.toDate?.()?.toISOString() || null,
                createdBy: data.createdBy || '',
                isActive: data.isActive !== false,
            };
        });

        // Get last doc for next cursor
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];

        return NextResponse.json({
            success: true,
            data: quizzes,
            pagination: {
                limit: limitVal,
                count: quizzes.length,
                nextCursor: lastDoc ? lastDoc.id : null,
                hasMore: quizzes.length === limitVal // Approximation
            },
        });
    } catch (error: any) {
        console.error('Error fetching quizzes:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch quizzes' },
            { status: 500 }
        );
    }
}
