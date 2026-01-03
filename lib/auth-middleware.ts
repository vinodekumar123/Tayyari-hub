import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface AuthenticatedRequest extends NextRequest {
    userId?: string;
    userEmail?: string;
    isSuperadmin?: boolean;
}

/**
 * Middleware to authenticate requests using Firebase ID token
 * Verifies the user is authenticated and checks superadmin status
 */
export async function authenticateRequest(request: NextRequest): Promise<{
    authenticated: boolean;
    userId?: string;
    userEmail?: string;
    isSuperadmin?: boolean;
    error?: string;
}> {
    try {
        // Get the authorization header
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                authenticated: false,
                error: 'Missing or invalid authorization header',
            };
        }

        // Extract the token
        const idToken = authHeader.split('Bearer ')[1];

        if (!idToken) {
            return {
                authenticated: false,
                error: 'No token provided',
            };
        }

        // Verify the ID token
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        // Get user document from Firestore to check superadmin status
        const userDoc = await adminDb.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return {
                authenticated: false,
                error: 'User not found in database',
            };
        }

        const userData = userDoc.data();
        const isSuperadmin = userData?.superadmin === true;

        return {
            authenticated: true,
            userId,
            userEmail,
            isSuperadmin,
        };
    } catch (error: any) {
        console.error('Authentication error:', error);
        return {
            authenticated: false,
            error: error.message || 'Authentication failed',
        };
    }
}

/**
 * Middleware to require superadmin access
 */
export async function requireSuperadmin(request: NextRequest): Promise<{
    authorized: boolean;
    userId?: string;
    userEmail?: string;
    userName?: string;
    error?: string;
}> {
    const authResult = await authenticateRequest(request);

    if (!authResult.authenticated) {
        return {
            authorized: false,
            error: authResult.error || 'Authentication failed',
        };
    }

    if (!authResult.isSuperadmin) {
        return {
            authorized: false,
            error: 'Insufficient permissions. Superadmin access required.',
        };
    }

    // Get user's full name for audit logging
    let userName = 'Admin';
    try {
        const userDoc = await adminDb.collection('users').doc(authResult.userId!).get();
        userName = userDoc.data()?.fullName || userDoc.data()?.email || 'Admin';
    } catch (error) {
        console.warn('Failed to get user name:', error);
    }

    return {
        authorized: true,
        userId: authResult.userId,
        userEmail: authResult.userEmail,
        userName,
    };
}
