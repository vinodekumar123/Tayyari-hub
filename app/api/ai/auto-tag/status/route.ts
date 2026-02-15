import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireStaff } from '@/lib/auth-middleware';

// Initialize Firebase Admin if not already initialized
// Initialize Firebase Admin if not already initialized
function getAdminDb() {
    if (getApps().length === 0) {
        if (process.env.FIREBASE_PRIVATE_KEY) {
            // Production / Vercel Environment using Env Vars
            initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                })
            });
        } else {
            // Local fallback
            try {
                initializeApp();
            } catch (error) {
                console.error("Firebase Admin Init Failed", error);
            }
        }
    }
    return getFirestore();
}

export async function GET(req: Request) {
    try {
        const authResult = await requireStaff(req);
        if (!authResult.authorized) {
            return NextResponse.json({ error: 'Unauthorized', details: authResult.error }, { status: authResult.status ?? 401 });
        }

        const { searchParams } = new URL(req.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        const db = getAdminDb();
        const docRef = db.collection('tagging_jobs').doc(jobId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const data = docSnap.data();

        // Convert timestamps to ISO strings for JSON serialization
        const serialized = {
            id: docSnap.id,
            ...data,
            createdAt: data?.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data?.createdAt,
            updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data?.updatedAt,
            completedAt: data?.completedAt?.toDate ? data.completedAt.toDate().toISOString() : data?.completedAt
        };

        return NextResponse.json(serialized);

    } catch (error: any) {
        console.error('[Auto-Tag Status] Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch status',
            details: error.message
        }, { status: 500 });
    }
}
