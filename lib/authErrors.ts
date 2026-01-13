/**
 * Custom error types for authentication flows
 * Provides better error handling and user feedback
 */

export class AuthError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'AuthError';
    }
}

export class DeviceLimitError extends AuthError {
    constructor(message: string = 'Device limit reached. Please logout from another device to continue.') {
        super(message, 'auth/device-limit');
        this.name = 'DeviceLimitError';
    }
}

export class SessionRevokedError extends AuthError {
    constructor(message: string = 'Your session has been revoked. Please login again.') {
        super(message, 'auth/session-revoked');
        this.name = 'SessionRevokedError';
    }
}

export class DeviceBlockedError extends AuthError {
    constructor(message: string = 'This device has been blocked from accessing the platform.') {
        super(message, 'auth/device-blocked');
        this.name = 'DeviceBlockedError';
    }
}

export class RateLimitError extends AuthError {
    constructor(
        message: string = 'Too many login attempts. Please try again later.',
        public retryAfter?: number
    ) {
        super(message, 'auth/rate-limit');
        this.name = 'RateLimitError';
    }
}

export class EmailNotVerifiedError extends AuthError {
    constructor(message: string = 'Please verify your email address before logging in.') {
        super(message, 'auth/email-not-verified');
        this.name = 'EmailNotVerifiedError';
    }
}

/**
 * Type guard to check if error is one of our custom auth errors
 */
export function isAuthError(error: unknown): error is AuthError {
    return error instanceof AuthError;
}

/**
 * Get user-friendly error message from Firebase or custom errors
 */
export function getAuthErrorMessage(error: unknown): string {
    if (isAuthError(error)) {
        return error.message;
    }

    if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string; message?: string };

        switch (firebaseError.code) {
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'Invalid email or password.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection.';
            case 'auth/popup-closed-by-user':
                return 'Sign in was cancelled.';
            case 'auth/popup-blocked':
                return 'Please allow popups for this site to sign in with Google.';
            case 'auth/operation-not-allowed':
                return 'This sign-in method is not enabled.';
            default:
                return 'An error occurred. Please try again.';
        }
    }

    return 'An unexpected error occurred. Please try again.';
}
