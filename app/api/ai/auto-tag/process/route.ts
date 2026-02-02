import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

// --- Shared Helpers (Duplicated from auto-tag/route.ts for isolation) ---

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

function extractImageUrls(html: string): string[] {
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const urls: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        if (!url || url.startsWith('data:')) {
            if (url.startsWith('data:')) {
                const match = url.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return { mimeType: match[1], data: match[2] };
                }
            }
            return null;
        }

        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) return null;

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
            mimeType: contentType.split(';')[0],
            data: base64
        };
    } catch (error) {
        // console.warn(`Error fetching image ${url}:`, error);
        return null;
    }
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

function getAdminDb() {
    if (getApps().length === 0) {
        try {
            const serviceAccount = require('@/serviceAccountKey.json');
            initializeApp({
                credential: cert(serviceAccount)
            });
        } catch (e) {
            if (process.env.FIREBASE_PRIVATE_KEY) initializeApp();
        }
    }
    return getFirestore();
}

// --- Main Process Route ---

export async function POST(req: Request) {
    // This allows the route to run longer than default serverless function limits if platform supports it (maxDuration)
    // But self-calling minimizes needed duration.

    let jobId = '';

    try {
        const body = await req.json();
        jobId = body.jobId;

        if (!jobId) {
            return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        const db = getAdminDb();
        const jobRef = db.collection('tagging_jobs').doc(jobId);
        const jobSnap = await jobRef.get();

        if (!jobSnap.exists) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const job = jobSnap.data();

        // 1. Check Status
        if (!job || ['completed', 'failed', 'paused'].includes(job.status)) {
            return NextResponse.json({ message: 'Job stopped or completed', status: job?.status });
        }

        // 2. Identify Batch
        const currentIndex = job.currentBatchIndex || 0;
        const batchSize = job.batchSize || 10;
        const allQuestionIds = job.questionIds || [];

        if (currentIndex >= allQuestionIds.length) {
            // Already done?
            await jobRef.update({
                status: 'completed',
                completedAt: FieldValue.serverTimestamp()
            });
            return NextResponse.json({ message: 'Job completed', status: 'completed' });
        }

        const batchIds = allQuestionIds.slice(currentIndex, currentIndex + batchSize);
        console.log(`[Auto-Tag Process] Job ${jobId}: Processing batch ${currentIndex} to ${currentIndex + batchIds.length}`);

        // 3. Fetch Question Data
        // Firestore getAll only supports up to 10? No, standard SDK supports more, but let's be safe.
        // Actually Promise.all with gets is fine for 15-50 items.

        const questionDocs = await Promise.all(
            batchIds.map(id => db.collection('questions').doc(id).get())
        );

        const questionsToProcess = [];
        for (const doc of questionDocs) {
            if (doc.exists) {
                const data = doc.data() || {};
                questionsToProcess.push({
                    id: doc.id,
                    questionText: data.questionText || '',
                    text: data.questionText || data.text || '', // using questionText as source for both
                    options: data.options || []
                });
            }
        }

        if (questionsToProcess.length === 0) {
            // Should not happen unless IDs are bad. Skip this batch.
            await jobRef.update({
                currentBatchIndex: FieldValue.increment(batchSize),
                updatedAt: FieldValue.serverTimestamp()
            });
            // Trigger next
            triggerNextBatch(jobId);
            return NextResponse.json({ message: 'Empty batch, skipped' });
        }

        // 4. Prepare AI Payload (Vision Support)
        const processedQuestions: { id: string; text: string; images: { data: string; mimeType: string }[] }[] = [];

        for (const q of questionsToProcess) {
            const rawText = q.questionText || '';
            const imageUrls = extractImageUrls(rawText);
            const cleanText = stripHtml(rawText);

            // Limit to top 3 images to save tokens/time
            const imageResults = await Promise.all(
                imageUrls.slice(0, 3).map(url => fetchImageAsBase64(url))
            );

            const validImages = imageResults.filter((img): img is { data: string; mimeType: string } => img !== null);

            processedQuestions.push({
                id: q.id,
                text: cleanText.substring(0, 1000), // Moderate text length limit
                images: validImages
            });
        }

        // 5. Build Gemini Prompt
        // Use job settings
        const syllabusContext = job.syllabusContext || 'General Standard';
        const subject = job.subject || 'General';
        const validChapters = job.validChapters || [];
        const modelName = job.model || 'gemini-3-flash-preview';

        const model = genAI.getGenerativeModel({ model: modelName });

        const contentParts: Part[] = [];

        const promptText = `
        ## Role
        You are an Expert Academic AI.

        ## Context
        Subject: "${subject}"
        Syllabus: ${syllabusContext}
        Valid Chapters: ${JSON.stringify(validChapters)}

        ## Task
        Classify the following questions. Return STRICT JSON.
        Match to "Valid Chapters" only.
        
        Format:
        {
          "results": [
            { "question_id": "...", "assigned_chapter": "...", "difficulty": "Easy" | "Medium" | "Hard" }
          ]
        }

        ## Questions
        ${processedQuestions.map((q, idx) => `
        Q${idx + 1} (ID: ${q.id}): ${q.text}
        ${q.images.length ? `[+ ${q.images.length} Images]` : ''}
        `).join('\n')}
        `;

        contentParts.push({ text: promptText });

        // Attach images
        for (const q of processedQuestions) {
            if (q.images.length > 0) {
                contentParts.push({ text: `\n[Images for ID: ${q.id}]` });
                for (const img of q.images) {
                    contentParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
                }
            }
        }

        // 6. Generate Content
        let aiResults: any[] = [];
        try {
            const result = await model.generateContent(contentParts);
            const responseText = result.response.text();

            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            aiResults = parsed.results || [];
        } catch (aiErr) {
            console.error('AI Processing Error:', aiErr);
            // Don't fail the whole job, just log failure for this batch
        }

        // 7. DB Updates
        const batch = db.batch();
        const newLogs: any[] = [];
        let successCount = 0;

        aiResults.forEach((res: any) => {
            if (!res.question_id || !res.assigned_chapter) return;

            const qRef = db.collection('questions').doc(res.question_id);
            batch.update(qRef, {
                chapter: res.assigned_chapter,
                difficulty: res.difficulty || 'Medium',
                aiTagged: true,
                courseId: job.courseId
            });

            // Log entry
            const originalQ = processedQuestions.find(pq => pq.id === res.question_id);
            if (originalQ) {
                newLogs.push({
                    id: res.question_id,
                    questionPreview: originalQ.text.substring(0, 30) + '...',
                    newChapter: res.assigned_chapter,
                    difficulty: res.difficulty,
                    status: 'success',
                    timestamp: new Date().toISOString()
                });
                successCount++;
            }
        });

        if (aiResults.length > 0) {
            await batch.commit();
        }

        // 8. Update Job
        const isFinished = (currentIndex + batchSize) >= allQuestionIds.length;

        await jobRef.update({
            currentBatchIndex: FieldValue.increment(batchSize),
            processedCount: FieldValue.increment(successCount),
            failedCount: FieldValue.increment(batchIds.length - successCount),
            // Append logs (limit size in real apps, but here we append to top-level array or subcollection)
            // For simplicity, let's keep array but maybe limit total size? 
            // Firestore max doc is 1MB. Massive arrays will break it.
            // Better to store logs in a subcollection or just last 100 in doc.
            // Let's store just last 50 logs in main doc for UI.
            logs: FieldValue.arrayUnion(...newLogs),
            updatedAt: FieldValue.serverTimestamp(),
            status: isFinished ? 'completed' : 'running',
            ...(isFinished ? { completedAt: FieldValue.serverTimestamp() } : {})
        });

        // 9. Chain Reaction
        if (!isFinished) {
            // Throttle: Wait 2 seconds before triggering next batch to respect AI Rate Limits
            await new Promise(resolve => setTimeout(resolve, 2000));
            triggerNextBatch(jobId);
        }

        return NextResponse.json({
            success: true,
            processed: successCount,
            nextBatch: !isFinished
        });

    } catch (error: any) {
        console.error('[Auto-Tag Process] Critical Error:', error);

        // Mark job as failed? Or just retry? 
        // Let's increment failed count but retry??
        // Maybe mark as 'paused' so user has to resume?
        if (jobId) {
            const db = getAdminDb();
            await db.collection('tagging_jobs').doc(jobId).update({
                status: 'paused', // Pause so user sees error
                lastError: error.message
            });
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function triggerNextBatch(jobId: string) {
    // Dynamic base URL finding
    // In Vercel, use VERCEL_URL. Locally, localhost.
    const scheme = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const host = process.env.VERCEL_URL || 'localhost:3000';
    const url = `${scheme}://${host}/api/ai/auto-tag/process`;

    // Fire and forget
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
    }).catch(e => console.error("Chain fetch failed", e));
}
