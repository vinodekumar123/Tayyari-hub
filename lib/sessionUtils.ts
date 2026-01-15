

import { db } from '@/app/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, increment, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { UAParser } from 'ua-parser-js';
import { DeviceLimitError, SessionRevokedError, DeviceBlockedError } from './authErrors';

// Simple string hash function for fingerprinting
const simpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
};

// Strong Device Fingerprinting
const getBrowserFingerprint = () => {
    if (typeof window === 'undefined') return 'server-side';

    const { userAgent, language, hardwareConcurrency } = window.navigator;
    const { width, height, colorDepth, pixelDepth } = window.screen;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // @ts-ignore - deviceMemory is experimental but useful for fingerprinting
    const deviceMemory = (navigator as any).deviceMemory || 'unknown';
    // @ts-ignore - connection info
    const connectionType = (navigator as any).connection?.effectiveType || 'unknown';

    const data = [
        userAgent,
        language,
        hardwareConcurrency,
        width,
        height,
        colorDepth,
        pixelDepth,
        timezone,
        deviceMemory,
        connectionType
    ].join('||');

    return simpleHash(data);
};

/**
 * Helper to get IP and Geo Info with timeout
 * @param timeoutMs Maximum time to wait for GeoIP lookup (default: 3000ms)
 */
const getGeoInfo = async (timeoutMs: number = 2000) => {
    try {
        // Skip GeoIP on localhost
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return { ip: '127.0.0.1', city: 'Localhost', country: 'Localhost', region: 'Localhost' };
        }

        // Primary: ipapi.co (Rich data but strict CORS/Rate limits)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error('ipapi.co failed');

            const data = await res.json();
            return {
                ip: data.ip || 'unknown',
                city: data.city || 'Unknown City',
                country: data.country_name || 'Unknown Country',
                region: data.region || ''
            };
        } catch (e) {
            // Fallback: ipify (Simple IP, very reliable CORS)
            // console.warn('Primary GeoIP failed, trying fallback...');
        }

        // Fallback: ipify
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500); // Short timeout

            const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error('ipify failed');

            const data = await res.json();
            return {
                ip: data.ip,
                city: 'Unknown (Fallback)',
                country: 'Unknown (Fallback)',
                region: ''
            };
        } catch (e) {
            // console.warn('All GeoIP lookups failed');
        }

        return { ip: 'unknown', city: 'Unknown', country: 'Unknown', region: '' };

    } catch (e) {
        // Absolute safety net
        return { ip: 'unknown', city: 'Unknown', country: 'Unknown', region: '' };
    }
};

// Helper to get or set device ID
const getDeviceId = () => {
    let deviceId = localStorage.getItem('tayyari_device_id');
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('tayyari_device_id', deviceId);
    }
    return deviceId;
};

// Login state management to prevent race conditions
const LOGIN_IN_PROGRESS_KEY = 'tayyari_login_in_progress';
const LOGIN_GRACE_PERIOD_MS = 30000; // 30 seconds

export const setLoginInProgress = () => {
    localStorage.setItem(LOGIN_IN_PROGRESS_KEY, Date.now().toString());
};

export const clearLoginInProgress = () => {
    localStorage.removeItem(LOGIN_IN_PROGRESS_KEY);
};

export const isLoginInProgress = (): boolean => {
    const timestamp = localStorage.getItem(LOGIN_IN_PROGRESS_KEY);
    if (!timestamp) return false;
    const elapsed = Date.now() - parseInt(timestamp, 10);
    // Auto-clear if grace period exceeded
    if (elapsed > LOGIN_GRACE_PERIOD_MS) {
        clearLoginInProgress();
        return false;
    }
    return true;
};

/**
 * Helper to reliably get millis from a Firestore Timestamp or ServerTimestamp behavior
 * Improved to handle edge cases more predictably
 */
const getTimeMillis = (timestamp: any): number => {
    if (!timestamp) {
        // Treat pending/null as current time to avoid sorting issues
        return Date.now();
    }
    if (typeof timestamp.toMillis === 'function') {
        return timestamp.toMillis();
    }
    if (timestamp.seconds !== undefined) {
        return timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
    }
    if (typeof timestamp === 'number') {
        return timestamp;
    }
    // Last resort fallback
    console.warn('Unexpected timestamp format:', timestamp);
    return Date.now();
};

// FIX #2: Reconcile session count to prevent desync
const reconcileSessionCount = async (userId: string): Promise<number> => {
    try {
        const sessionsRef = collection(db, 'sessions');
        const q = query(
            sessionsRef,
            where('userId', '==', userId),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);
        const actualCount = snapshot.size;

        // Update user document with actual count
        // FIX: Add small delay/retry or transaction if needed, but for now just update
        await updateDoc(doc(db, 'users', userId), {
            activeSessions: actualCount
        });

        return actualCount;
    } catch (e) {
        console.error("Session count reconciliation failed", e);
        return 0;
    }
};

export const logUserSession = async (user: any, isAutoCheck = false) => {
    try {
        const { ip, city, country, region } = await getGeoInfo();
        const deviceId = getDeviceId();
        const parser = new UAParser();
        const result = parser.getResult();

        // Check if device is blocked
        const blockedDeviceQuery = query(collection(db, 'blocked_devices'), where('deviceId', '==', deviceId));
        const blockedDeviceSnap = await getDocs(blockedDeviceQuery);
        if (!blockedDeviceSnap.empty) {
            throw new DeviceBlockedError();
        }

        // Check active sessions for this user
        const sessionsRef = collection(db, 'sessions');
        const activeSessionsQuery = query(
            sessionsRef,
            where('userId', '==', user.uid),
            where('isActive', '==', true)
        );
        // Check query for specific device session (active or inactive) to detect revocation
        const deviceSessionQuery = query(sessionsRef, where('userId', '==', user.uid), where('deviceId', '==', deviceId));
        const deviceSessionSnap = await getDocs(deviceSessionQuery);

        let deviceSession = null;
        if (!deviceSessionSnap.empty) {
            // Sort in memory to avoid complex index requirements
            const docs = deviceSessionSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            // Sort by loginTime desc
            docs.sort((a, b) => getTimeMillis(b.loginTime) - getTimeMillis(a.loginTime));
            deviceSession = docs[0]; // Most recent session
        }

        if (deviceSession) {
            // If the MOST RECENT session for this device is inactive, it means we were revoked/logged out.
            if (deviceSession.isActive) {
                // Active session found - just update it
                await updateDoc(doc(db, 'sessions', deviceSession.id), {
                    lastActive: serverTimestamp(),
                    deviceId: deviceId,
                    ip, city, country, region
                });
                return; // All good
            }

            // If session is inactive, it's expected after logout.
            // For auto-check (ensuring active session), only revoke if it was explicitly revoked by admin.
            // Standard logout sets isActive=false but doesn't set isRevoked (or implies normal logout).
            // We'll check a new flag 'wasAdminRevoked' if we add it, or just rely on the fact that
            // if we are Logging In (isAutoCheck=false), we should proceed to create a NEW session.

            if (isAutoCheck) {
                // Check if it was a forced revocation (we'll assume so if we're checking validity)
                // But wait - if user logged out normally, they shouldn't be here (auth state would be null).
                // If auth state exists but session is inactive, it MIGHT be a revocation.

                // FIX: To distinguish normal logout vs admin revoke, we can check a flag.
                // For now, if we are in auto-check and session is inactive, it's a revocation.
                // BUT - on re-login, isAutoCheck is FALSE. So we skip this throw.
                throw new SessionRevokedError();
            }

            // Login Flow (isAutoCheck=false): We are starting fresh. 
            // We ignore the old inactive session and fall through to create a new one.
        }

        // --- Fingerprint / Fuzzy Match (Optional fallback if DeviceID lost but Fingerprint matches active session) ---
        // (Keeping strict logic for now to ensure security)

        // STRICT LIMIT ENFORCEMENT
        const activeSessionsSnap = await getDocs(activeSessionsQuery);
        const activeSessions = activeSessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Check if this specific device is already logged in (re-login or refresh)
        // Strong Match: Check strict deviceId OR fuzzy fingerprint match
        const fingerprint = getBrowserFingerprint();
        let existingSession = activeSessions.find((s: any) => s.deviceId === deviceId);

        // If no exact ID match, try finding by fingerprint (Handles cleared cache/localStorage)
        if (!existingSession) {
            existingSession = activeSessions.find((s: any) => s.deviceFingerprint === fingerprint);
        }

        if (existingSession) {
            // Just update the existing session's lastActive and location
            await updateDoc(doc(db, 'sessions', existingSession.id), {
                lastActive: serverTimestamp(),
                // If we recovered a session via fingerprint, update the deviceId to specific current one
                deviceId: deviceId, // Ensure client uses current random ID for future exact lookups
                ip, city, country, region
            });
            return; // All good, existing session updated
        }

        // FIX #2: Reconcile count before enforcing limit to ensure accuracy
        const reconciledCount = await reconcileSessionCount(user.uid);

        // STRICT LIMIT ENFORCEMENT
        const MAX_DEVICES = 3;
        // FIX #1: Use reconciled count (more accurate than activeSessions.length which might have race conditions)
        if (reconciledCount >= MAX_DEVICES) {
            // BLOCK LOGIC: Log the attempt first, then throw
            const blockedReason = `Device limit reached (${MAX_DEVICES})`;

            // Create "Blocked" session doc
            await addDoc(sessionsRef, {
                userId: user.uid,
                email: user.email,
                userName: user.displayName || 'Unknown',
                ip, city, country, region,
                deviceId,
                deviceType: result.device.type || 'desktop',
                os: `${result.os.name} ${result.os.version}`,
                browser: `${result.browser.name} ${result.browser.version}`,
                loginTime: serverTimestamp(),
                lastActive: serverTimestamp(),
                isActive: false, // NOT Active
                isBlocked: true, // BLOCKED Flag
                blockReason: blockedReason,
                isRedFlagSession: true, // Mark as red flag too
                deviceFingerprint: fingerprint,
                deviceMemory: (navigator as any).deviceMemory || null,
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                hardwareConcurrency: navigator.hardwareConcurrency || null,
            });

            // Mark user as Red Flag
            await updateDoc(doc(db, 'users', user.uid), {
                redFlag: true,
                redFlagReason: 'Multiple active sessions (>3) - Blocked Attempt'
            });

            throw new DeviceLimitError(`Device limit reached (${MAX_DEVICES}). Please logout from another device to continue.`);
        }

        // Create New Active Session
        await addDoc(sessionsRef, {
            userId: user.uid,
            email: user.email,
            userName: user.displayName || 'Unknown',
            ip,
            city,
            country,
            region,
            deviceId,
            deviceType: result.device.type || 'desktop',
            os: `${result.os.name} ${result.os.version}`,
            browser: `${result.browser.name} ${result.browser.version}`,
            cpu: result.cpu.architecture,
            loginTime: serverTimestamp(),
            lastActive: serverTimestamp(),
            isActive: true,
            isRedFlagSession: false,
            deviceFingerprint: fingerprint, // Store for recovery
            deviceMemory: (navigator as any).deviceMemory || null,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            hardwareConcurrency: navigator.hardwareConcurrency || null,
            wasAdminRevoked: false, // EXPLICIT FLAG: false for new sessions
        });

        // Update user's active session count
        await updateDoc(doc(db, 'users', user.uid), {
            lastLoginIp: ip,
            lastLoginTime: serverTimestamp(),
            activeSessions: increment(1)
        });

    } catch (error: any) {
        // Only log unexpected errors. Revoked/Blocked/Limit are handled by UI.
        const msg = error.message || "";
        // Don't log expected auth errors
        if (!msg.includes("revoked") && !msg.includes("blocked") && !msg.includes("limit")) {
            console.error('Error logging session:', error);
        }
        throw error; // Re-throw to handle in UI
    }
};

export const ensureSessionActive = async (user: any) => {
    try {
        await logUserSession(user, true); // Pass true for isAutoCheck
    } catch (error: any) {
        // Re-throw critical errors (revoked/blocked) so UI can handle them (e.g. logout)
        if (error.message && (error.message.includes("revoked") || error.message.includes("blocked") || error.message.includes("limit"))) {
            throw error;
        }
        console.error("Session auto-ensure failed:", error);
    }
};

export const subscribeToSession = (user: any, onStatusChange: (status: 'active' | 'revoked') => void) => {
    const deviceId = getDeviceId();
    const sessionsRef = collection(db, 'sessions');
    const q = query(sessionsRef, where('userId', '==', user.uid), where('deviceId', '==', deviceId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        // CRITICAL: Skip revocation check if login is in progress
        if (isLoginInProgress()) {
            // Don't trigger any status change during login grace period
            return;
        }

        if (!snapshot.empty) {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // Sort by loginTime desc to get latest
            docs.sort((a, b) => getTimeMillis(b.loginTime) - getTimeMillis(a.loginTime));

            const session = docs[0];

            if (session.isBlocked) {
                onStatusChange('revoked');
            } else if (!session.isActive) {
                // CRITICAL FIX: Only revoke if session was explicitly revoked by admin
                // Normal logout sets isActive=false but wasAdminRevoked remains false
                if (session.wasAdminRevoked === true) {
                    onStatusChange('revoked');
                }
                // If wasAdminRevoked is false/undefined, this is a normal logout
                // The user is either logging in again (new session being created)
                // or they've already been redirected to login page
            } else {
                onStatusChange('active');
            }
        }
    }, (error) => {
        // Ignore permission denied errors which happen on logout
        if (error.code === 'permission-denied') {
            return;
        }
        console.error("Session listener error:", error);
    });

    return unsubscribe;
};

export const updateSessionHeartbeat = async (user: any) => {
    try {
        const deviceId = getDeviceId();
        const sessionsRef = collection(db, 'sessions');
        const q = query(sessionsRef, where('userId', '==', user.uid), where('deviceId', '==', deviceId));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            docs.sort((a, b) => getTimeMillis(b.loginTime) - getTimeMillis(a.loginTime));
            const session = docs[0];
            if (session.isActive) {
                await updateDoc(doc(db, 'sessions', session.id), {
                    lastActive: serverTimestamp()
                });
            }
        }
    } catch (e) {
        console.error("Heartbeat failed", e);
    }
}

export const logoutUserSession = async (userId: string) => {
    try {
        const deviceId = getDeviceId();
        const sessionsRef = collection(db, 'sessions');
        const q = query(
            sessionsRef,
            where('userId', '==', userId),
            where('deviceId', '==', deviceId),
            where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            // Should be only one, but iterate to be safe
            for (const docSnap of snapshot.docs) {
                await updateDoc(doc(db, 'sessions', docSnap.id), {
                    isActive: false,
                    lastActive: serverTimestamp(),
                    loggedOutAt: serverTimestamp()
                });
            }
        }

        // Also decrement active session count for user
        await updateDoc(doc(db, 'users', userId), {
            activeSessions: increment(-1)
        });

        // NOTE: We keep device ID persistent (not clearing localStorage)
        // This helps track sessions across logins on the same device
        // It's important for multi-device limit enforcement

    } catch (e) {
        console.error("Logout session update failed", e);
        // Don't throw, we still want to proceed with client-side signout
    }
};
