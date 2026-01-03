

import { db } from '@/app/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, increment, limit, onSnapshot } from 'firebase/firestore';
import { UAParser } from 'ua-parser-js';

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

// Helper to get IP and Geo Info
const getGeoInfo = async () => {
    try {
        // Using ipapi.co for location data (Free tier: 1000 requests/day, suitable for dev/demo)
        // Production recommendation: Use a paid service or server-side IP lookup to avoid client-side rate limits/cors issues if scaling
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return {
            ip: data.ip || 'unknown',
            city: data.city || 'Unknown City',
            country: data.country_name || 'Unknown Country',
            region: data.region || ''
        };
    } catch (e) {
        console.warn("Geo lookup failed, falling back to simple IP");
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const data = await res.json();
            return { ip: data.ip, city: 'Unknown', country: 'Unknown', region: '' };
        } catch (err) {
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
            throw new Error('This device is blocked from accessing the platform.');
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
            docs.sort((a, b) => {
                const timeA = a.loginTime?.toMillis ? a.loginTime.toMillis() : (a.loginTime?.seconds * 1000 || 0);
                const timeB = b.loginTime?.toMillis ? b.loginTime.toMillis() : (b.loginTime?.seconds * 1000 || 0);
                return timeB - timeA;
            });
            deviceSession = docs[0]; // Most recent session
        }

        if (deviceSession) {
            // If the MOST RECENT session for this device is inactive, it means we were revoked/logged out.
            if (!deviceSession.isActive) {
                if (isAutoCheck) {
                    throw new Error("Session has been revoked or expired.");
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

        // STRICT LIMIT ENFORCEMENT
        // User requested "Red Flag... or logged in more than 3 mobiles", but explicitly requested "prevent 4th login" in follow-up.
        const MAX_DEVICES = 3;
        if (activeSessions.length >= MAX_DEVICES) {
            // Option A: Strict Block
            throw new Error(`Device limit reached (${MAX_DEVICES}). Please logout from another device to continue.`);

            // Option B (Alternative): Auto-logout oldest - commented out but viable for "soft" limit
            // const sorted = activeSessions.sort((a:any, b:any) => a.loginTime?.seconds - b.loginTime?.seconds);
            // await updateDoc(doc(db, 'sessions', sorted[0].id), { isActive: false });
        }

        // Check red flag logic (Still useful if we relax limits later or for manual admin review)
        const isRedFlag = activeSessions.length >= MAX_DEVICES; // Should catch if limit raised

        if (isRedFlag) {
            await updateDoc(doc(db, 'users', user.uid), {
                redFlag: true,
                redFlagReason: 'Multiple active sessions (>3)'
            });
        }

        // Create session doc
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
            isRedFlagSession: isRedFlag,
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
            docs.sort((a, b) => {
                const timeA = a.loginTime?.toMillis ? a.loginTime.toMillis() : (a.loginTime?.seconds * 1000 || 0);
                const timeB = b.loginTime?.toMillis ? b.loginTime.toMillis() : (b.loginTime?.seconds * 1000 || 0);
                return timeB - timeA;
            });
            const session = docs[0];

            if (!session.isActive) {
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
            docs.sort((a, b) => {
                const timeA = a.loginTime?.toMillis ? a.loginTime.toMillis() : (a.loginTime?.seconds * 1000 || 0);
                const timeB = b.loginTime?.toMillis ? b.loginTime.toMillis() : (b.loginTime?.seconds * 1000 || 0);
                return timeB - timeA;
            });
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

    } catch (e) {
        console.error("Logout session update failed", e);
        // Don't throw, we still want to proceed with client-side signout
    }
};
