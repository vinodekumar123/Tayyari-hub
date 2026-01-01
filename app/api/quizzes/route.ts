import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';

// GET /api/quizzes - Get paginated list of quizzes
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('limit') || '20');
        const quizType = searchParams.get('type'); // 'admin' or 'user'
        const subject = searchParams.get('subject');

        // Build base query
        let constraints: any[] = [
            orderBy('createdDate', 'desc'),
            limit(pageSize * page)
        ];

        // Add filters
        if (quizType) {
            constraints.unshift(where('quizType', '==', quizType));
        }

        if (subject) {
            constraints.unshift(where('subject', '==', subject));
        }

        const q = query(collection(db, 'quizes'), ...constraints);

        // Execute query
        const snapshot = await getDocs(q);

        const quizzes = snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title || '',
            subject: doc.data().subject || '',
            quizType: doc.data().quizType || 'admin',
            totalQuestions: doc.data().questions?.length || 0,
            duration: doc.data().duration || 0,
            createdDate: doc.data().createdDate?.toDate?.()?.toISOString() || null,
            createdBy: doc.data().createdBy || '',
            isActive: doc.data().isActive !== false,
        }));

        // Client-side pagination
        const startIndex = (page - 1) * pageSize;
        const paginatedQuizzes = quizzes.slice(startIndex, startIndex + pageSize);

        return NextResponse.json({
            success: true,
            data: paginatedQuizzes,
            pagination: {
                page,
                pageSize,
                total: quizzes.length,
                hasMore: quizzes.length === pageSize * page,
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
