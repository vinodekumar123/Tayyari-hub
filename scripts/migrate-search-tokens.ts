/**
 * Migration Script: Add searchTokens to Existing Questions
 * 
 * This script backfills the searchTokens field for all existing questions
 * in the Firestore database to enable server-side search.
 * 
 * Run this ONCE after deploying the search tokens feature.
 * 
 * Usage (in terminal):
 *   npx ts-node scripts/migrate-search-tokens.ts
 * 
 * Or create an API route and call it once from the browser.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { generateSearchTokens } from '../lib/searchUtils';

// Initialize Firebase Admin (only if not already initialized)
if (getApps().length === 0) {
    // You'll need to set up your service account credentials
    // Option 1: Use environment variable
    // initializeApp({
    //   credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!))
    // });

    // Option 2: Use service account file
    // initializeApp({
    //   credential: cert(require('../path/to/serviceAccountKey.json'))
    // });

    // For this example, we'll use default credentials
    initializeApp();
}

const db = getFirestore();

async function migrateSearchTokens() {
    console.log('🚀 Starting search tokens migration...\n');

    try {
        // Fetch all questions
        const questionsRef = db.collection('questions');
        const snapshot = await questionsRef.get();

        console.log(`📊 Found ${snapshot.size} questions to process\n`);

        if (snapshot.empty) {
            console.log('❌ No questions found in database');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const batch = db.batch();
        let batchCount = 0;
        const BATCH_SIZE = 500; // Firestore batch limit

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Skip if searchTokens already exists
            if (data.searchTokens && Array.isArray(data.searchTokens) && data.searchTokens.length > 0) {
                skippedCount++;
                console.log(`⏭️  Skipping ${doc.id} (already has searchTokens)`);
                continue;
            }

            // Generate search tokens from questionText
            const questionText = data.questionText || '';
            const searchTokens = generateSearchTokens(questionText);

            if (searchTokens.length === 0) {
                console.log(`⚠️  Warning: No tokens generated for ${doc.id}`);
            }

            // Update the document
            batch.update(doc.ref, {
                searchTokens,
                updatedAt: new Date()
            });

            batchCount++;
            successCount++;

            // Commit batch if we reach the limit
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`✅ Committed batch of ${batchCount} updates`);
                batchCount = 0;
            }
        }

        // Commit any remaining updates
        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchCount} updates`);
        }

        console.log('\n🎉 Migration completed!');
        console.log(`✅ Successfully updated: ${successCount}`);
        console.log(`⏭️  Skipped (already had tokens): ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Run the migration if this file is executed directly
if (require.main === module) {
    migrateSearchTokens()
        .then(() => {
            console.log('\n✨ Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Migration script failed:', error);
            process.exit(1);
        });
}

export { migrateSearchTokens };
