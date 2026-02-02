import { NextResponse } from 'next/server';
import { adminDb, isAdminInitialized, getInitializationError } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            courseId,
            subject,
            model,
            batchSize = 15,
            syllabusContext,
            validChapters,
            processingMode = 'pending',
            userId
        } = body;

        if (!courseId || !subject || !validChapters?.length) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!isAdminInitialized()) {
            return NextResponse.json({
                error: 'Firebase Admin not initialized',
                details: getInitializationError()?.message
            }, { status: 500 });
        }

        const db = adminDb;

        // Check for existing running job for this subject
        const existingJobsSnapshot = await db.collection('tagging_jobs')
            .where('subject', '==', subject)
            .where('status', 'in', ['pending', 'running'])
            .limit(1)
            .get();

        if (!existingJobsSnapshot.empty) {
            const existingJob = existingJobsSnapshot.docs[0];
            return NextResponse.json({
                error: 'Job already exists',
                jobId: existingJob.id,
                status: existingJob.data().status,
                message: 'A job is already running for this subject. Resume or cancel it first.'
            }, { status: 409 });
        }

        // Fetch all question IDs to process
        let questionsQuery = db.collection('questions')
            .where('subject', '==', subject);

        const questionsSnapshot = await questionsQuery.get();

        if (questionsSnapshot.empty) {
            return NextResponse.json({ error: 'No questions found for this subject' }, { status: 404 });
        }

        // Filter based on processing mode (client-side filtering since Firestore can't do complex queries)
        let questionIds: string[] = [];
        questionsSnapshot.docs.forEach(doc => {
            const data = doc.data();

            // Safety: Don't touch questions belonging to other courses (prevent stealing)
            if (data.courseId && data.courseId !== courseId) {
                return;
            }

            if (processingMode === 'pending') {
                // Only include questions that are TRULY untagged (no chapter assigned)
                // We check for absence of valid chapter, rather than just the aiTagged flag
                if (!data.chapter || data.chapter === '') {
                    questionIds.push(doc.id);
                }
            } else {
                // Include all questions for re-tagging
                questionIds.push(doc.id);
            }
        });

        if (questionIds.length === 0) {
            return NextResponse.json({
                error: 'No questions to process',
                message: processingMode === 'pending'
                    ? 'All questions are already tagged!'
                    : 'No questions found'
            }, { status: 404 });
        }

        // Create the job document
        const jobData = {
            status: 'pending',
            courseId,
            subject,
            model: model || 'gemini-3-flash-preview',
            batchSize: Math.min(Math.max(batchSize, 5), 50), // Clamp between 5-50
            syllabusContext: syllabusContext || '',
            validChapters,
            processingMode,

            // Progress tracking
            totalQuestions: questionIds.length,
            processedCount: 0,
            failedCount: 0,
            currentBatchIndex: 0,
            questionIds,

            // Logs
            logs: [],

            // Timestamps
            createdAt: new Date(),
            updatedAt: new Date(),

            // User
            createdBy: userId || 'anonymous'
        };

        const jobRef = await db.collection('tagging_jobs').add(jobData);
        const jobId = jobRef.id;

        console.log(`[Auto-Tag] Created job ${jobId} with ${questionIds.length} questions`);

        // Trigger the first batch processing
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000');

        // Start processing asynchronously (fire and forget)
        fetch(`${baseUrl}/api/ai/auto-tag/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId })
        }).catch(err => console.error('[Auto-Tag] Failed to trigger process:', err));

        // Update job status to running
        await jobRef.update({ status: 'running', updatedAt: new Date() });

        return NextResponse.json({
            success: true,
            jobId,
            totalQuestions: questionIds.length,
            batchSize: jobData.batchSize,
            message: `Job started! Processing ${questionIds.length} questions in batches of ${jobData.batchSize}`
        });

    } catch (error: any) {
        console.error('[Auto-Tag Start] Error:', error);
        return NextResponse.json({
            error: 'Failed to start job',
            details: error.message
        }, { status: 500 });
    }
}
