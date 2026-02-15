/**
 * API Route: Migrate Search Tokens
 * 
 * Call this endpoint ONCE to backfill searchTokens for all existing questions.
 * 
 * Usage:
 *   GET http://localhost:3000/api/admin/migrate-search-tokens
 * 
 * Security: Only accessible to superadmin users
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generateSearchTokens } from '@/lib/searchUtils';
import { requireSuperadmin } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const targetCollection = searchParams.get('collection') || 'questions';

        const migrationToken = process.env.MIGRATION_TOKEN;
        const providedToken = request.headers.get('x-migration-token');
        const hasMigrationToken = !!(migrationToken && providedToken === migrationToken);

        if (!hasMigrationToken) {
            const authResult = await requireSuperadmin(request);
            if (!authResult.authorized) {
                return NextResponse.json(
                    { error: 'Unauthorized', details: authResult.error },
                    { status: authResult.status ?? 401 }
                );
            }
        }

        if (!['questions', 'mock-questions'].includes(targetCollection)) {
            return NextResponse.json({ error: 'Invalid collection specified' }, { status: 400 });
        }

        console.log(`🚀 Starting search tokens migration for ${targetCollection} via API...`);

        // Fetch all questions from target collection
        const questionsRef = adminDb.collection(targetCollection);
        const snapshot = await questionsRef.get();

        console.log(`📊 Found ${snapshot.size} items in ${targetCollection} to process`);

        if (snapshot.empty) {
            return NextResponse.json({
                success: true,
                message: `No items found in ${targetCollection}`,
                stats: { total: 0, updated: 0, skipped: 0, errors: 0 }
            });
        }

        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        const errors: string[] = [];

        // Process in batches of 500 (Firestore limit)
        const BATCH_SIZE = 500;
        let batch = adminDb.batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            try {
                const data = doc.data();

                // Skip if searchTokens already exists and is not empty
                if (data.searchTokens && Array.isArray(data.searchTokens) && data.searchTokens.length > 0) {
                    skippedCount++;
                    continue;
                }

                // Generate search tokens from questionText
                const questionText = data.questionText || '';
                const searchTokens = generateSearchTokens(questionText);

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
                    batch = adminDb.batch(); // Create new batch
                    batchCount = 0;
                }

            } catch (error: any) {
                errorCount++;
                errors.push(`Error processing ${doc.id}: ${error.message}`);
                console.error(`❌ Error processing ${doc.id}:`, error);
            }
        }

        // Commit any remaining updates
        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchCount} updates`);
        }

        console.log(`🎉 Migration for ${targetCollection} completed!`);

        return NextResponse.json({
            success: true,
            message: `Migration for ${targetCollection} completed successfully`,
            stats: {
                total: snapshot.size,
                updated: successCount,
                skipped: skippedCount,
                errors: errorCount
            },
            errorDetails: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        return NextResponse.json(
            {
                error: 'Migration failed',
                details: error.message
            },
            { status: 500 }
        );
    }
}
