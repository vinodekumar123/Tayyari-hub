import { NextRequest, NextResponse } from 'next/server';
import { geminiFlashModel, generateEmbedding } from '@/lib/gemini';
import { adminDb } from '@/lib/firebase-admin';
import {
    generateCacheKey,
    getCachedResponse,
    setCachedResponse,
    getCachedEmbedding,
    setCachedEmbedding,
    detectSubject,
    classifyQueryIntent,
    getFormatInstructions,
    logConversation,
    calculateConfidence
} from '@/lib/ai-cache';

export const runtime = 'nodejs';

const STATUS_MESSAGES = {
    SEARCHING: 'data: {"status": "searching", "message": "🔍 Searching knowledge base..."}\n\n',
    FOUND: (count: number) => `data: {"status": "found", "message": "📚 Found ${count} relevant sources..."}\n\n`,
    WRITING: 'data: {"status": "writing", "message": "✍️ Writing response..."}\n\n',
    RESTRICTED: 'data: {"status": "error", "message": "⚠️ I cannot generate MCQs. Please use the Quiz Bank."}\n\n'
};

export async function POST(req: NextRequest) {
    const startTime = Date.now();

    try {
        const { message, streamStatus = true, userId, userName, userRole } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message required' }, { status: 400 });
        }

        // 1. Strict Restriction: Prevent MCQ/Practice generation
        const queryIntent = classifyQueryIntent(message);
        if (queryIntent === 'practice') {
            // Create a stream that just sends the error message and closes
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode("I apologize, but I cannot generate MCQs or practice quizzes. Please use the **Quiz Bank** or **Create Quiz** feature for practice questions. I can help explain concepts or solve specific problems instead."));
                    controller.close();
                }
            });

            // Log the blocked attempt
            logConversation({
                query: message,
                response: "BLOCKED: MCQ Request",
                sources: [],
                subject: null,
                intent: 'practice',
                responseTimeMs: Date.now() - startTime,
                wasFromCache: false,
                userId,
                userName,
                userRole
            });

            return new NextResponse(stream, {
                headers: { 'Content-Type': 'text/event-stream' }
            });
        }

        // Check cache first
        const cacheKey = generateCacheKey(message);
        const cachedResult = getCachedResponse(cacheKey);

        if (cachedResult) {
            const subject = detectSubject(message);

            // Log cached response
            // We need to await this inside the stream or before? 
            // Better to do it in the stream to keep response fast, but here we aren't using a complex stream loop.
            // Let's do it inside the stream start.

            const stream = new ReadableStream({
                async start(controller) {
                    controller.enqueue(new TextEncoder().encode(cachedResult.response));

                    const logId = await logConversation({
                        query: message,
                        response: cachedResult.response,
                        sources: cachedResult.sources,
                        subject,
                        intent: queryIntent,
                        responseTimeMs: Date.now() - startTime,
                        wasFromCache: true,
                        userId,
                        userName,
                        userRole
                    });

                    if (logId) {
                        controller.enqueue(new TextEncoder().encode(`\n\ndata: {"status": "log_id", "id": "${logId}"}\n\n`));
                    }

                    controller.close();
                }
            });
            return new NextResponse(stream, {
                headers: { 'Content-Type': 'text/event-stream' }
            });
        }

        // Detect subject
        const detectedSubject = detectSubject(message);
        const formatInstructions = getFormatInstructions(queryIntent);

        // Embedding
        let questionVector = getCachedEmbedding(message);
        if (!questionVector) {
            questionVector = await generateEmbedding(message);
            setCachedEmbedding(message, questionVector);
        }

        // RAG Search
        const knowledgeColl = adminDb.collection('knowledge_base');
        let bookQuery = knowledgeColl.where('metadata.type', '==', 'book');
        let syllabusQuery = knowledgeColl.where('metadata.type', '==', 'syllabus');

        if (detectedSubject) {
            bookQuery = bookQuery.where('metadata.subject', '==', detectedSubject);
            syllabusQuery = syllabusQuery.where('metadata.subject', '==', detectedSubject);
        }

        const bookVectorQuery = bookQuery.findNearest('embedding', questionVector, {
            limit: 5,
            distanceMeasure: 'COSINE'
        });

        const syllabusVectorQuery = syllabusQuery.findNearest('embedding', questionVector, {
            limit: 2,
            distanceMeasure: 'COSINE'
        });

        const [bookDocs, syllabusDocs] = await Promise.all([
            bookVectorQuery.get(),
            syllabusVectorQuery.get()
        ]);

        const confidence = calculateConfidence(bookDocs.docs, syllabusDocs.docs);

        const sources: any[] = [];
        const bookContext = bookDocs.docs.map((d, idx) => {
            const data = d.data();
            sources.push({
                type: 'book',
                bookName: data.metadata.bookName,
                page: data.metadata.page,
                chapter: data.metadata.chapter
            });
            return `[Source ${idx + 1}] Book: ${data.metadata.bookName} (Ch: ${data.metadata.chapter})\nContent: ${data.content}`;
        }).join('\n---\n');

        const syllabusContext = syllabusDocs.docs.map((d, idx) => {
            const data = d.data();
            sources.push({ type: 'syllabus', bookName: data.metadata.bookName });
            return `[Syllabus] ${data.metadata.bookName}\nContent: ${data.content}`;
        }).join('\n---\n');

        // Enhanced Prompt for Students
        const prompt = `
You are the **Official AI Tutor for Tayyari Hub** (MDCAT Prep Platform).
User Query: "${message}"
${detectedSubject ? `Subject: ${detectedSubject}` : ''}

CONTEXT:
${bookContext || 'No specific textbook content found.'}
${syllabusContext || 'No specific syllabus content found.'}

INSTRUCTIONS:
1. **Goal**: Explain concepts clearly to a student.
2. **Be Direct**: Start with the answer. No "Hello" or "Based on documents".
3. **Style**: ${formatInstructions}. **ADAPTABILITY**: If the user asks for a short answer, be very brief. If they ask for details, be comprehensive.
4. **Formatting**: Use **Bold** for key terms. Use LaTeX for math ($E=mc^2$).
5. **Confidence**: ${confidence.message}

IMPORTANT RESTRICTION:
- Do NOT generate MCQs or quizzes. If asked, politely refuse and suggest the Quiz Bank.
- If the question is about Fees, Dates, or Tech Support, answer using general knowledge or direct them to support (03237507673).

Suggest 1 related topic at the end: "💡 **Explore Key Topic**: [Topic Name]"
`;

        const result = await geminiFlashModel.generateContentStream(prompt);
        let fullResponse = '';

        const stream = new ReadableStream({
            async start(controller) {
                if (streamStatus) {
                    controller.enqueue(new TextEncoder().encode(STATUS_MESSAGES.FOUND(sources.length)));
                    await new Promise(r => setTimeout(r, 100)); // UX delay
                    controller.enqueue(new TextEncoder().encode(STATUS_MESSAGES.WRITING));
                }

                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    fullResponse += text;
                    controller.enqueue(new TextEncoder().encode(text));
                }

                setCachedResponse(cacheKey, fullResponse, sources);

                // Log with User Details
                const logId = await logConversation({
                    query: message,
                    response: fullResponse,
                    sources,
                    subject: detectedSubject,
                    intent: queryIntent,
                    responseTimeMs: Date.now() - startTime,
                    wasFromCache: false,
                    userId: userId || 'anonymous',
                    userName: userName || 'Student',
                    userRole: userRole || 'student'
                });

                // Send Log ID to client for feedback
                if (logId) {
                    controller.enqueue(new TextEncoder().encode(`data: {"status": "log_id", "id": "${logId}"}\n\n`));
                }

                controller.close();
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'X-Confidence': confidence.score,
                'X-Subject': detectedSubject || 'general',
                'X-Intent': queryIntent
            }
        });

    } catch (error: any) {
        console.error("Student Tutor API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
