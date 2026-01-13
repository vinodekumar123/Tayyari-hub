

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
const getGeoInfo = async (timeoutMs: number = 3000) => {
    try {
        // Skip GeoIP on localhost to prevent CORS errors
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return { ip: '127.0.0.1', city: 'Localhost', country: 'Localhost', region: 'Localhost' };
        }

        // Race between fetch and timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // Using ipapi.co for location data (Free tier: 1000 requests/day, suitable for dev/demo)
            // Production recommendation: Use a paid service or server-side IP lookup to avoid client-side rate limits/cors issues if scaling
            const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            return {
                ip: data.ip || 'unknown',
                city: data.city || 'Unknown City',
                country: data.country_name || 'Unknown Country',
                region: data.region || ''
            };
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.warn('GeoIP lookup timed out');
                return { ip: 'unknown', city: 'Unknown', country: 'Unknown', region: '' };
            }
            throw fetchError;
        }
    } catch (e) {
        console.warn("Geo lookup failed, falling back to simple IP");
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            return { ip: data.ip, city: 'Unknown', country: 'Unknown', region: '' };
        } catch (err) {
            console.warn('All GeoIP lookups failed, using fallback');
            return { ip: 'unknown', city: 'Unknown', country: 'Unknown', region: '' };
        }
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
            if (!deviceSession.isActive) {
                if (isAutoCheck) {
                    throw new SessionRevokedError();
                }
                // Login Flow: We are starting fresh, so we ignore the old inactive one and create a new one below.
            } else {
                // Active session found - just update it
                await updateDoc(doc(db, 'sessions', deviceSession.id), {
                    lastActive: serverTimestamp(),
                    deviceId: deviceId,
                    ip, city, country, region
                });
                return; // All good
            }
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
        if (!snapshot.empty) {
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // Sort by loginTime desc to get latest
            // CRITICAL FIX: Handle pending timestamps (null/serverTimestamp) efficiently to avoid race condition
            docs.sort((a, b) => getTimeMillis(b.loginTime) - getTimeMillis(a.loginTime));

            const session = docs[0];

            if (session.isBlocked) {
                // If the latest session is blocked, it means they tried to login but failed validation
                // We should theoretically trigger revoked, but 'blocked' is clearer if we had a status for it.
                // For now, revoked works to kick them out.
                onStatusChange('revoked');
            } else if (!session.isActive) {
                onStatusChange('revoked');
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
