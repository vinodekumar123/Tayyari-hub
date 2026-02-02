import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
function getAdminDb() {
    if (getApps().length === 0) {
        // We need to ensure we have credentials. 
        // In a real app, strict checks are good. Here we assume serviceAccountKey exists or env vars are set.
        try {
            const serviceAccount = require('@/serviceAccountKey.json');
            initializeApp({
                credential: cert(serviceAccount)
            });
        } catch (e) {
            // Fallback for Vercel env vars where file might not exist but env vars do
            // Or just rely on default google creds if deployed on GCP/Vercel
            if (process.env.FIREBASE_PRIVATE_KEY) {
                initializeApp();
            } else {
                console.error("Firebase Admin Init Failed", e);
            }
        }
    }
    return getFirestore();
}

export async function GET(req: Request) {
    try {
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
