
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
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

async function migrateUserRoles() {
    console.log('Starting user role migration...');

    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();

        if (snapshot.empty) {
            console.log('No users found to migrate.');
            return;
        }

        console.log(`Found ${snapshot.size} users. Processing...`);

        let updatedCount = 0;
        let skippedCount = 0;
        let batch = db.batch();
        let operationCounter = 0;
        const BATCH_LIMIT = 400; // Safe limit below 500

        for (const doc of snapshot.docs) {
            const data = doc.data();
            let newRole = null;

            // Priority: 'admin' > 'teacher' > 'student' (default if nothing else)
            // Existing 'role' field takes precedence if valid

            if (data.role) {
                // If role exists, check for conflict with boolean flags?
                // For now, trust existing role
                skippedCount++;
                continue;
            }

            // Role is MISSING or invalid
            if (data.admin === true || data.role === 'admin') {
                newRole = 'admin';
            } else if (data.teacher === true || data.role === 'teacher') {
                newRole = 'teacher';
            } else {
                // Default fallback for normal users
                newRole = 'student';
            }

            if (newRole) {
                const userRef = usersRef.doc(doc.id);
                batch.update(userRef, { role: newRole });
                updatedCount++;
                operationCounter++;

                if (operationCounter >= BATCH_LIMIT) {
                    await batch.commit();
                    console.log(`Committed batch of ${operationCounter} updates.`);
                    batch = db.batch();
                    operationCounter = 0;
                }
            }
        }

        if (operationCounter > 0) {
            await batch.commit();
            console.log(`Committed final batch of ${operationCounter} updates.`);
        }

        console.log('Migration complete.');
        console.log(`- Updated (Added Role): ${updatedCount}`);
        console.log(`- Skipped (Already Has Role): ${skippedCount}`);

    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrateUserRoles();
