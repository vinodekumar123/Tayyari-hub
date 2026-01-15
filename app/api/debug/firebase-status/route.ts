import { NextResponse } from 'next/server';
import { isAdminInitialized, getInitializationError } from '@/lib/firebase-admin';

export async function GET() {
    const isInit = isAdminInitialized();
    const error = getInitializationError();

    // Check environment variables (don't expose full values for security)
    const hasServiceAccountEnv = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccountPreview = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? `${process.env.FIREBASE_SERVICE_ACCOUNT_KEY.substring(0, 50)}...`
        : 'NOT SET';

    // Try to parse the JSON to check if it's valid
    let jsonParseError = null;
    let parsedKeys: string[] = [];
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
            const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            parsedKeys = Object.keys(parsed);
        } catch (e: any) {
            jsonParseError = e.message;
        }
    }

    return NextResponse.json({
        firebaseAdminInitialized: isInit,
        initializationError: error?.message || null,
        environment: {
            hasServiceAccountEnv,
            serviceAccountPreview,
            jsonParseError,
            parsedKeys,
            nodeEnv: process.env.NODE_ENV,
            hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        }
    });
}
