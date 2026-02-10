
import * as admin from 'firebase-admin';
import * as path from 'path';

import * as fs from 'fs';

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully.');
} catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    process.exit(1);
}

const db = admin.firestore();

async function diagnoseLeaderboard() {
    console.log('Starting leaderboard diagnosis...');

    try {
        console.log('1. Testing Helper: Querying users with role="student" (limit 5)...');
        const usersRef = db.collection('users');
        const basicSnapshot = await usersRef.where('role', '==', 'student').limit(5).get();

        console.log(`Found ${basicSnapshot.size} students (basic query).`);
        if (!basicSnapshot.empty) {
            basicSnapshot.docs.forEach(doc => {
                const data = doc.data();
                console.log(`- User ID: ${doc.id}`);
                console.log(`  stats:`, JSON.stringify(data.stats, null, 2));
                const hasGrandTotal = data.stats && data.stats.grandTotalScore !== undefined;
                console.log(`  Has grandTotalScore: ${hasGrandTotal}`);
            });
        }

        console.log('\n2. Testing Leaderboard Query (with orderBy stats.grandTotalScore)...');
        try {
            const q = usersRef
                .where('role', '==', 'student')
                .orderBy('stats.grandTotalScore', 'desc')
                .limit(50);

            const leaderboardSnapshot = await q.get();
            console.log(`Leaderboard query successful. Found ${leaderboardSnapshot.size} users.`);

            if (leaderboardSnapshot.empty) {
                console.warn('WARNING: Leaderboard query returned 0 results. This likely means no users have "stats.grandTotalScore" field indexed or present.');
            }
        } catch (queryError: any) {
            console.error('ERROR executing leaderboard query:');
            console.error(queryError.message);
            if (queryError.details) console.error('Details:', queryError.details);
            if (queryError.code === 9) { // FAILED_PRECONDITION
                console.error('POTENTIAL CAUSE: Missing Index. Look for a URL in the error message to create the index.');
            }
        }

    } catch (error) {
        console.error('Unexpected error during diagnosis:', error);
    }
}

diagnoseLeaderboard();
