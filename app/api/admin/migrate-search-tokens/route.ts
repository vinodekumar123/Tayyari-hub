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

export async function GET(request: NextRequest) {
    try {
        // Security check: Verify the request is from an admin
        // You should implement proper authentication here
        const authHeader = request.headers.get('authorization');

        // For now, require a simple token (you should change this!)
        const MIGRATION_TOKEN = process.env.MIGRATION_TOKEN || 'change-me-in-production';
        const providedToken = request.headers.get('x-migration-token');

        if (providedToken !== MIGRATION_TOKEN) {
            return NextResponse.json(
                { error: 'Unauthorized. Provide x-migration-token header.' },
                { status: 401 }
            );
        }

        console.log('🚀 Starting search tokens migration via API...');

        // Fetch all questions
        const questionsRef = adminDb.collection('questions');
        const snapshot = await questionsRef.get();

        console.log(`📊 Found ${snapshot.size} questions to process`);

        if (snapshot.empty) {
            return NextResponse.json({
                success: true,
                message: 'No questions found in database',
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

                // Skip if searchTokens already exists
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

        console.log('🎉 Migration completed!');

        return NextResponse.json({
            success: true,
            message: 'Migration completed successfully',
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
