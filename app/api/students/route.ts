import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, limit, orderBy, startAfter, doc, getDoc } from 'firebase/firestore';

// GET /api/students - Get paginated list of students
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('limit') || '20');
        const searchQuery = searchParams.get('search') || '';
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        // Build query
        let q = query(
            collection(db, 'users'),
            where('role', '==', 'student'),
            orderBy(sortBy as any, sortOrder as any),
            limit(pageSize)
        );

        // Execute query
        const snapshot = await getDocs(q);

        let students = snapshot.docs.map(doc => ({
            id: doc.id,
            fullName: doc.data().fullName || '',
            email: doc.data().email || '',
            phone: doc.data().phone || '',
            photoURL: doc.data().photoURL || null,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
            stats: doc.data().stats || {
                totalQuizzes: 0,
                totalQuestions: 0,
                totalCorrect: 0,
                overallAccuracy: 0,
            },
        }));

        // Client-side filtering for search (for now)
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            students = students.filter(s =>
                s.fullName.toLowerCase().includes(lowerQuery) ||
                s.email.toLowerCase().includes(lowerQuery) ||
                s.phone?.includes(searchQuery)
            );
        }

        // Pagination
        const startIndex = (page - 1) * pageSize;
        const paginatedStudents = students.slice(startIndex, startIndex + pageSize);

        return NextResponse.json({
            success: true,
            data: paginatedStudents,
            pagination: {
                page,
                pageSize,
                total: students.length,
                totalPages: Math.ceil(students.length / pageSize),
            },
        });
    } catch (error: any) {
        console.error('Error fetching students:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch students' },
            { status: 500 }
        );
    }
}

// GET /api/students/[id] endpoint would be in a subdirectory
