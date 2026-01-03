
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// --- Configuration ---
const BATCH_SIZE = 400; // Limits for batch operations
const DRY_RUN = !process.argv.includes('--execute');

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};

async function initFirebase() {
    console.log(`${colors.blue}Initializing Firebase Admin SDK...${colors.reset}`);
    try {
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
            console.log(`${colors.green}✅ Firebase initialized with serviceAccountKey.json${colors.reset}`);
        } else {
            // Try env var fallback (simulating lib/firebase-admin logic)
            if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                console.log(`DEBUG: Found FIREBASE_SERVICE_ACCOUNT_KEY length: ${process.env.FIREBASE_SERVICE_ACCOUNT_KEY.length}`);
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                console.log(`DEBUG: Parsed service account. Project ID: ${serviceAccount.project_id}`);
                if (serviceAccount.private_key) {
                    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
                    console.log(`DEBUG: Private Key Start: ${serviceAccount.private_key.substring(0, 30)}...`);
                }

                // Write to temp file to ensure cert() handles it correctly
                const tempPath = path.join(process.cwd(), 'temp-creds.json');
                fs.writeFileSync(tempPath, JSON.stringify(serviceAccount));

                admin.initializeApp({
                    credential: admin.credential.cert(tempPath),
                    projectId: serviceAccount.project_id
                });
                console.log(`${colors.green}✅ Firebase initialized from ENV (via temp file)${colors.reset}`);

                // Clean up immediately
                try { fs.unlinkSync(tempPath); } catch (e) { }
            } else {
                throw new Error("No serviceAccountKey.json found and no FIREBASE_SERVICE_ACCOUNT_KEY env var.");
            }
        }
    } catch (error) {
        console.error(`${colors.red}❌ Failed to initialize Firebase:${colors.reset}`, error);
        process.exit(1);
    }
}

async function deleteCollection(db: admin.firestore.Firestore, collectionPath: string, batchSize: number) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: admin.firestore.Firestore, query: admin.firestore.Query, resolve: Function) {
    const snapshot = await query.get();

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    if (!DRY_RUN) {
        await batch.commit();
    } else {
        console.log(`   [DRY RUN] Would delete ${batchSize} docs from query.`);
    }

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function main() {
    await initFirebase();
    const db = admin.firestore();
    const auth = admin.auth();

    console.log(`\n${colors.cyan}--- STARTING USER DELETION PROCESS ---${colors.reset}`);
    if (DRY_RUN) {
        console.log(`${colors.yellow}⚠️  DRY RUN MODE: No changes will be made.${colors.reset}`);
        console.log(`${colors.yellow}Run with --execute to perform actual deletion.${colors.reset}\n`);
    } else {
        console.log(`${colors.red}🚨 EXECUTION MODE: Changes AR IRREVERSIBLE.${colors.reset}\n`);
    }

    // 1. Fetch all users from Firestore 'users' collection
    console.log("Fetching users from Firestore...");
    const usersSnap = await db.collection('users').get();
    console.log(`Found ${usersSnap.size} total user documents in Firestore.`);

    let usersToDelete: any[] = [];
    let adminsSkipped = 0;

    for (const doc of usersSnap.docs) {
        const data = doc.data();
        const uid = doc.id;

        // CHECK ROLES - SKIP ADMINS/SUPERADMINS
        const isAdmin = data.admin === true || data.admin === 'true' || data.role === 'admin';
        const isSuperAdmin = data.superadmin === true || data.role === 'superadmin';

        if (isAdmin || isSuperAdmin) {
            console.log(`${colors.green}Skipping Admin/Superadmin: ${data.fullName || uid} (${data.email})${colors.reset}`);
            adminsSkipped++;
            continue;
        }

        usersToDelete.push({ id: uid, data });
    }

    console.log(`\nSummary of candidates:`);
    console.log(`   Total Candidates to Delete: ${colors.red}${usersToDelete.length}${colors.reset}`);
    console.log(`   Admins/Superadmins Skipped: ${colors.green}${adminsSkipped}${colors.reset}`);

    if (usersToDelete.length === 0) {
        console.log("No users to delete. Exiting.");
        return;
    }

    console.log(`\n${colors.cyan}--- Processing Deletions ---${colors.reset}`);

    for (const user of usersToDelete) {
        const uid = user.id;
        const email = user.data.email || 'No Email';
        const name = user.data.fullName || 'Unknown';

        console.log(`Processing User: ${name} (${email}) [${uid}]`);

        // A. DELETE RELATED DATA (Queries)
        // 1. Tasks (assignedTo)
        const tasksQuery = db.collection('tasks').where('assignedTo', '==', uid);
        const tasksSnap = await tasksQuery.get();
        if (!tasksSnap.empty) {
            console.log(`   Found ${tasksSnap.size} tasks assigned.`);
            if (!DRY_RUN) {
                const batch = db.batch();
                tasksSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`   Deleted tasks.`);
            }
        }

        // 2. Forum Posts (authorId)
        const forumQuery = db.collection('forum_posts').where('authorId', '==', uid);
        const forumSnap = await forumQuery.get();
        if (!forumSnap.empty) {
            console.log(`   Found ${forumSnap.size} forum posts.`);
            if (!DRY_RUN) {
                const batch = db.batch();
                forumSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`   Deleted forum posts.`);
            }
        }

        // 3. Enrollments (studentId)
        const enrollQuery = db.collection('enrollments').where('studentId', '==', uid);
        const enrollSnap = await enrollQuery.get();
        if (!enrollSnap.empty) {
            console.log(`   Found ${enrollSnap.size} enrollments.`);
            if (!DRY_RUN) {
                const batch = db.batch();
                enrollSnap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                console.log(`   Deleted enrollments.`);
            }
        }

        // 4. User Quizzes (created by user?) - Assuming 'user-quizzes' uses ID mapped to something or has author field?
        // In user-results/page.tsx: db.collection('users', user.uid, 'user-quizattempts')
        // And there is a root collection 'user-quizzes' ? Let's check if they have ownerId
        // The codebase scan showed 'user-quizzes' might store metadata. 
        // For now, let's look for 'user-quizzes' where 'userId' or 'createdBy' is uid.
        // It's safer to just rely on subcollections for now unless confirmed.

        // B. DELETE SUBCOLLECTIONS & MAIN DOC
        const userRef = db.collection('users').doc(uid);

        // Subcollections: 'quizAttempts', 'user-quizattempts'
        // We can't list subcollections easily in client SDK (admin SDK can).
        const subcollections = await userRef.listCollections();
        if (subcollections.length > 0) {
            console.log(`   Found ${subcollections.length} subcollections (e.g. ${subcollections[0].id}).`);
            if (!DRY_RUN) {
                for (const subcol of subcollections) {
                    // Recursive delete of subcollection
                    // Simple batch delete for now (assuming not huge depth)
                    const subSnap = await subcol.get();
                    if (!subSnap.empty) {
                        const batch = db.batch();
                        subSnap.docs.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                    }
                }
                console.log(`   Deleted subcollections.`);
            }
        }

        if (!DRY_RUN) {
            await userRef.delete();
            console.log(`   Deleted Firestore User Doc.`);
        } else {
            console.log(`   [DRY RUN] Would delete Firestore User Doc.`);
        }

        // C. DELETE AUTH USER
        try {
            if (!DRY_RUN) {
                await auth.deleteUser(uid);
                console.log(`   Deleted Auth User.`);
            } else {
                console.log(`   [DRY RUN] Would delete Auth User.`);
            }
        } catch (e: any) {
            if (e.code === 'auth/user-not-found') {
                console.log(`   Auth user already missing.`);
            } else {
                console.error(`   ❌ Failed to delete Auth user:`, e.message);
            }
        }

        console.log(`   --------------------------------`);
    }

    console.log(`\n${colors.green}Done.${colors.reset}`);
}

main().catch(console.error);
