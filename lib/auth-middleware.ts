import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface AuthenticatedRequest extends NextRequest {
    userId?: string;
    userEmail?: string;
    isSuperadmin?: boolean;
    isAdmin?: boolean;
    isTeacher?: boolean;
}

type RequestLike = NextRequest | Request;

const normalizeBool = (value: any) => value === true || value === 'true';

const getRoleFlags = (userData: any) => {
    const role = userData?.role;
    const isSuperadmin = normalizeBool(userData?.superadmin) || role === 'superadmin';
    const isAdmin = isSuperadmin || normalizeBool(userData?.admin) || role === 'admin';
    const subjects = userData?.subjects;
    const hasSubjects =
        Array.isArray(subjects) ? subjects.length > 0 :
            subjects && typeof subjects === 'object' ? Object.keys(subjects).length > 0 :
                false;
    const isTeacher = role === 'teacher' || hasSubjects;
    return { isSuperadmin, isAdmin, isTeacher };
};

/**
 * Middleware to authenticate requests using Firebase ID token
 * Verifies the user is authenticated and checks superadmin status
 */
export async function authenticateRequest(request: RequestLike): Promise<{
    authenticated: boolean;
    userId?: string;
    userEmail?: string;
    userName?: string;
    isSuperadmin?: boolean;
    isAdmin?: boolean;
    isTeacher?: boolean;
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

        const userData = userDoc.data() || {};
        const { isSuperadmin, isAdmin, isTeacher } = getRoleFlags(userData);
        const userName = userData?.fullName || userEmail || 'Admin';

        return {
            authenticated: true,
            userId,
            userEmail,
            userName,
            isSuperadmin,
            isAdmin,
            isTeacher,
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
export async function requireSuperadmin(request: RequestLike): Promise<{
    authorized: boolean;
    userId?: string;
    userEmail?: string;
    userName?: string;
    error?: string;
    status?: number;
}> {
    const authResult = await authenticateRequest(request);

    if (!authResult.authenticated) {
        return {
            authorized: false,
            error: authResult.error || 'Authentication failed',
            status: 401,
        };
    }

    if (!authResult.isSuperadmin) {
        return {
            authorized: false,
            error: 'Insufficient permissions. Superadmin access required.',
            status: 403,
        };
    }
    return {
        authorized: true,
        userId: authResult.userId,
        userEmail: authResult.userEmail,
        userName: authResult.userName || 'Admin',
        status: 200,
    };
}

export async function requireAdmin(request: RequestLike): Promise<{
    authorized: boolean;
    userId?: string;
    userEmail?: string;
    userName?: string;
    error?: string;
    status?: number;
}> {
    const authResult = await authenticateRequest(request);

    if (!authResult.authenticated) {
        return {
            authorized: false,
            error: authResult.error || 'Authentication failed',
            status: 401,
        };
    }

    if (!authResult.isAdmin) {
        return {
            authorized: false,
            error: 'Insufficient permissions. Admin access required.',
            status: 403,
        };
    }

    return {
        authorized: true,
        userId: authResult.userId,
        userEmail: authResult.userEmail,
        userName: authResult.userName || 'Admin',
        status: 200,
    };
}

export async function requireStaff(request: RequestLike): Promise<{
    authorized: boolean;
    userId?: string;
    userEmail?: string;
    userName?: string;
    error?: string;
    status?: number;
}> {
    const authResult = await authenticateRequest(request);

    if (!authResult.authenticated) {
        return {
            authorized: false,
            error: authResult.error || 'Authentication failed',
            status: 401,
        };
    }

    if (!authResult.isAdmin && !authResult.isTeacher) {
        return {
            authorized: false,
            error: 'Insufficient permissions. Staff access required.',
            status: 403,
        };
    }

    return {
        authorized: true,
        userId: authResult.userId,
        userEmail: authResult.userEmail,
        userName: authResult.userName || 'Admin',
        status: 200,
    };
}
