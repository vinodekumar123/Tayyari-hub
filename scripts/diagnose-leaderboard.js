
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log(`Service Account Project ID: ${serviceAccount.project_id}`);

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    console.log('Firebase Admin initialized successfully.');
} catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    process.exit(1);
}

const db = admin.firestore();

async function diagnoseLeaderboard() {
    console.log('Starting leaderboard diagnosis...');

    try {
        console.log('0. Listing all root collections...');
        const collections = await db.listCollections();
        console.log('Collections found:', collections.map(c => c.id).join(', '));

        console.log('\n1. Fetching ANY user (limit 1) to inspect data structure...');
        const usersRef = db.collection('users');
        const anySnapshot = await usersRef.limit(1).get();

        if (anySnapshot.empty) {
            console.log("No users found at all in 'users' collection.");
        } else {
            const doc = anySnapshot.docs[0];
            const data = doc.data();
            console.log(`- User ID: ${doc.id}`);
            console.log(`- Role: ${data.role}`);
            console.log(`- Email: ${data.email || 'N/A'}`);
            console.log(`- Stats Object:`);
            console.log(JSON.stringify(data.stats, null, 2));

            if (data.role !== 'student') {
                console.log(`(This user is not a student, role is '${data.role}')`);
            }
        }

        // Check specifically for students again, but without limit/filter to see count? No, that's too expensive.
        // Just check count of students
        console.log('\n2. Counting students...');
        const studentSnap = await usersRef.where('role', '==', 'student').count().get();
        console.log(`Total students count: ${studentSnap.data().count}`);

    } catch (error) {
        console.error('Unexpected error during diagnosis:', error);
    }
}

diagnoseLeaderboard();
