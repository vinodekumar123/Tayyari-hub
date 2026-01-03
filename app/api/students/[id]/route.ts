import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, limit, orderBy, doc, getDoc } from 'firebase/firestore';

// GET /api/students/[id] - Get single student by ID
export async function GET(
    request: NextRequest,
    // Next's generated types expect a different context shape; accept any to remain compatible
    context: any
) {
    try {
        const { params } = context;
        const { id } = params || {};

        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Student ID is required' },
                { status: 400 }
            );
        }

        // Fetch student document
        const studentDoc = await getDoc(doc(db, 'users', id));

        if (!studentDoc.exists()) {
            return NextResponse.json(
                { success: false, error: 'Student not found' },
                { status: 404 }
            );
        }

        const studentData = studentDoc.data();

        // Fetch student's quiz attempts
        const quizAttemptsQuery = query(
            collection(db, 'users', id, 'quizAttempts'),
            orderBy('submittedAt', 'desc'),
            limit(10)
        );

        const quizAttemptsSnapshot = await getDocs(quizAttemptsQuery);
        const quizAttempts = quizAttemptsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            submittedAt: doc.data().submittedAt?.toDate?.()?.toISOString() || null,
        }));

        return NextResponse.json({
            success: true,
            data: {
                id: studentDoc.id,
                fullName: studentData.fullName || '',
                email: studentData.email || '',
                phone: studentData.phone || '',
                photoURL: studentData.photoURL || null,
                createdAt: studentData.createdAt?.toDate?.()?.toISOString() || null,
                stats: studentData.stats || {},
                usedMockQuestionIds: studentData.usedMockQuestionIds || [],
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
