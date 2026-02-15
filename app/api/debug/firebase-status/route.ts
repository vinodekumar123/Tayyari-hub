import { NextResponse } from 'next/server';
import { isAdminInitialized, getInitializationError } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/auth-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // specific auth check for debug route
    const auth = await requireSuperadmin(request);
    if (!auth.authorized) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const isInit = isAdminInitialized();
    const error = getInitializationError();

    // Check environment variables (don't expose full values for security)
    const hasServiceAccountEnv = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccountPreview = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? `${process.env.FIREBASE_SERVICE_ACCOUNT_KEY.substring(0, 10)}...`
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
            jsonParseError, // Only show error message, not content
            parsedKeys, // Safe to show keys
            nodeEnv: process.env.NODE_ENV,
            hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        }
    });
}
