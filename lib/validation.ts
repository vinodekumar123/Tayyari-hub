/**
 * Validation utilities for authentication forms
 */

/**
 * Validates email format
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email) {
        return { valid: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Please enter a valid email address' };
    }

    return { valid: true };
}

/**
 * Validates password strength
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
    if (!password) {
        return { valid: false, error: 'Password is required' };
    }

    if (password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters' };
    }

    return { valid: true };
}

/**
 * Rate limiting for login attempts
 */
interface LoginAttempt {
    timestamp: number;
    count: number;
}

const RATE_LIMIT_KEY = 'tayyari_login_attempts';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if rate limit is exceeded
 * @returns Object with isLimited flag and retryAfter timestamp if limited
 */
export function checkRateLimit(): { isLimited: boolean; retryAfter?: number } {
    if (typeof window === 'undefined') {
        return { isLimited: false };
    }

    try {
        const stored = localStorage.getItem(RATE_LIMIT_KEY);
        if (!stored) {
            return { isLimited: false };
        }

        const attempt: LoginAttempt = JSON.parse(stored);
        const now = Date.now();
        const timeSinceFirst = now - attempt.timestamp;

        // Reset if window expired
        if (timeSinceFirst > WINDOW_MS) {
            localStorage.removeItem(RATE_LIMIT_KEY);
            return { isLimited: false };
        }

        // Check if limit exceeded
        if (attempt.count >= MAX_ATTEMPTS) {
            const retryAfter = attempt.timestamp + WINDOW_MS;
            return { isLimited: true, retryAfter };
        }

        return { isLimited: false };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        return { isLimited: false };
    }
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(): void {
    if (typeof window === 'undefined') return;

    try {
        const stored = localStorage.getItem(RATE_LIMIT_KEY);
        const now = Date.now();

        if (!stored) {
            const attempt: LoginAttempt = { timestamp: now, count: 1 };
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(attempt));
            return;
        }

        const attempt: LoginAttempt = JSON.parse(stored);
        const timeSinceFirst = now - attempt.timestamp;

        // Reset if window expired
        if (timeSinceFirst > WINDOW_MS) {
            const newAttempt: LoginAttempt = { timestamp: now, count: 1 };
            localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(newAttempt));
            return;
        }

        // Increment count
        attempt.count += 1;
        localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(attempt));
    } catch (error) {
        console.error('Failed to record attempt:', error);
    }
}

/**
 * Reset rate limit (call on successful login)
 */
export function resetRateLimit(): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(RATE_LIMIT_KEY);
    } catch (error) {
        console.error('Failed to reset rate limit:', error);
    }
}

/**
 * Get remaining time until retry is allowed (in milliseconds)
 */
export function getRemainingLockTime(): number {
    const { isLimited, retryAfter } = checkRateLimit();
    if (!isLimited || !retryAfter) return 0;

    return Math.max(0, retryAfter - Date.now());
}

/**
 * Format remaining time in human-readable format
 */
export function formatRemainingTime(ms: number): string {
    const minutes = Math.ceil(ms / 60000);
    if (minutes <= 1) return 'less than a minute';
    return `${minutes} minutes`;
}
