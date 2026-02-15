import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { Query } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// GET /api/students - Get paginated list of students
export async function GET(request: NextRequest) {
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

        // Enforce Admin Role (or other logic if needed)
        // Check custom claim 'role' or 'admin'
        if (decodedToken.role !== 'admin' && decodedToken.admin !== true) {
            return NextResponse.json({ success: false, error: 'Forbidden: Admins only' }, { status: 403 });
        }

        // 2. Parse Params
        const searchParams = request.nextUrl.searchParams;
        const limitStr = searchParams.get('limit') || '20';
        const limitVal = parseInt(limitStr);
        const sortBy = searchParams.get('sortBy') || 'createdAt';
        const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
        const startAfterId = searchParams.get('startAfter'); // Cursor (Doc ID)
        const searchQuery = searchParams.get('search') || '';

        // 3. Build Query using Admin SDK
        let queryRef: Query = adminDb.collection('users').where('role', '==', 'student');

        // Search (Note: Firestore doesn't support full-text search natively. 
        // Admin SDK can't do 'contains'. relying on client-side or simple prefix matches if feasible.
        // For now, keeping the logic similar to original but applying post-fetch filter if strict search needed, 
        // OR using a specific indexable field.)
        // Original code did client-side filtering after fetch. We will do the same but limited by page size, which is flawed.
        // Ideally use Algolia. For now, sticking to Firestore constraints.

        queryRef = queryRef.orderBy(sortBy, sortOrder);

        // Cursor Pagination
        if (startAfterId) {
            const startAfterDoc = await adminDb.collection('users').doc(startAfterId).get();
            if (startAfterDoc.exists) {
                queryRef = queryRef.startAfter(startAfterDoc);
            }
        }

        queryRef = queryRef.limit(limitVal);

        const snapshot = await queryRef.get();

        let students = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                fullName: data.fullName || '',
                email: data.email || '',
                phone: data.phone || '',
                photoURL: data.photoURL || null,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
                stats: data.stats || {
                    totalQuizzes: 0,
                    totalQuestions: 0,
                    totalCorrect: 0,
                    overallAccuracy: 0,
                },
            };
        });

        // Client-side filtering for search (Warning: This only searches the fetched page!)
        // To properly search, one needs a dedicated search service. 
        // Preserving original behavior but acknowledging limitation.
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            students = students.filter(s =>
                s.fullName.toLowerCase().includes(lowerQuery) ||
                s.email.toLowerCase().includes(lowerQuery) ||
                (s.phone && s.phone.includes(searchQuery))
            );
        }

        // Get last doc for next cursor
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];

        return NextResponse.json({
            success: true,
            data: students,
            pagination: {
                limit: limitVal,
                count: students.length,
                nextCursor: lastDoc ? lastDoc.id : null,
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
