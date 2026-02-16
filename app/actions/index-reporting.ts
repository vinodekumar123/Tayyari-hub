'use server';

import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
// Note: This matches existing patterns in the codebase (e.g., firebase-admin.ts)
// We assume CREDENTIALS are handled elsewhere or we use the existing init logic.
// For now, using a standard check. The user has `lib/firebase-admin.ts` so we might want to use that 
// but it's often better to keep actions self-contained or use the shared instance.
// Let's rely on `lib/firebase-admin.ts` if it exports a db instance, checking... 
// Actually I'll use a standard lazy init here to be safe, or just import from lib if I checked it.
// I haven't checked lib/firebase-admin.ts content yet, so I will stick to standard lazy init pending review.

const initAdmin = () => {
    if (!getApps().length) {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            try {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                initializeApp({
                    credential: cert(serviceAccount),
                });
            } catch (e) {
                console.error("Failed to parse service account key", e);
                // Fallback or let it fail
            }
        } else {
            initializeApp(); // ADC or other auth
        }
    }
    return getFirestore();
}

export async function reportMissingIndex(errorDetails: {
    message: string;
    link?: string;
    queryInfo?: string; // Optional context about what query failed
    path?: string; // URL path where error occurred
}) {
    if (!errorDetails.link && !errorDetails.message.includes("requires an index")) {
        return { success: false, reason: "Not an index error" };
    }

    try {
        const db = initAdmin();
        const collectionRef = db.collection('detected_indexes');

        // Extract create link if not provided but present in message
        let createLink = errorDetails.link;
        if (!createLink) {
            const linkMatch = errorDetails.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
            if (linkMatch) {
                createLink = linkMatch[0];
            }
        }

        if (!createLink) {
            return { success: false, reason: "Could not extract creation link" };
        }

        // Generate a unique ID based on the link (it contains the index definition)
        // Use SHA-256 to ensure uniqueness even if links share a long prefix.
        const { createHash } = await import('crypto');
        const id = createHash('sha256').update(createLink).digest('hex');

        const docRef = collectionRef.doc(id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            await docRef.update({
                occurrences: (docSnap.data()?.occurrences || 0) + 1,
                lastSeen: new Date(),
                path: errorDetails.path || docSnap.data()?.path
            });
        } else {
            await docRef.set({
                createLink,
                message: errorDetails.message,
                queryInfo: errorDetails.queryInfo || 'Unknown',
                path: errorDetails.path || 'Unknown',
                occurrences: 1,
                firstSeen: new Date(),
                lastSeen: new Date(),
                status: 'MISSING' // Initial status
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Failed to report missing index:", error);
        return { success: false, error: "Internal Server Error" };
    }
}
