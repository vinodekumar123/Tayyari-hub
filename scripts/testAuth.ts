
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("Initializing with Application Default Credentials...");
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'tayyari-hub' // Hardcode fallback to match logs
        });

        console.log("Attempting Firestore read...");
        const db = admin.firestore();
        const snap = await db.collection('users').limit(1).get();
        console.log(`Success! Found ${snap.size} docs.`);
    } catch (error: any) {
        console.error("Failed:", error);
    }
}

main();
