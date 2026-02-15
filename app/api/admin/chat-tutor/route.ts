import { NextRequest, NextResponse } from 'next/server';
import { geminiFlashModel, generateEmbedding } from '@/lib/gemini';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth-middleware';
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
    calculateConfidence,
    QueryIntent
} from '@/lib/ai-cache';

export const runtime = 'nodejs'; // Required for Firebase Admin

// Streaming status messages for better UX
const STATUS_MESSAGES = {
    SEARCHING: 'data: {"status": "searching", "message": "🔍 Searching knowledge base..."}\n\n',
    FOUND: (count: number) => `data: {"status": "found", "message": "📚 Found ${count} relevant sources..."}\n\n`,
    WRITING: 'data: {"status": "writing", "message": "✍️ Writing response..."}\n\n',
};

export async function POST(req: NextRequest) {
    const startTime = Date.now();

    try {
        const authResult = await requireAdmin(req);
        if (!authResult.authorized) {
            return NextResponse.json({ error: 'Unauthorized', details: authResult.error }, { status: authResult.status ?? 401 });
        }

        const { message, history = [], streamStatus = true } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message required' }, { status: 400 });
        }

        // Check cache first for speed
        const cacheKey = generateCacheKey(message);
        const cachedResult = getCachedResponse(cacheKey);

        if (cachedResult) {
            // Log cached response
            const subject = detectSubject(message);
            const intent = classifyQueryIntent(message);
            logConversation({
                query: message,
                response: cachedResult.response,
                sources: cachedResult.sources,
                subject,
                intent,
                responseTimeMs: Date.now() - startTime,
                wasFromCache: true
            });

            // Return cached response as stream
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode(cachedResult.response));
                    controller.close();
                }
            });
            return new NextResponse(stream, {
                headers: { 'Content-Type': 'text/event-stream' }
            });
        }

        // Detect subject for filtered search
        const detectedSubject = detectSubject(message);
        const queryIntent = classifyQueryIntent(message);
        const formatInstructions = getFormatInstructions(queryIntent);

        // Generate or get cached embedding
        let questionVector = getCachedEmbedding(message);
        if (!questionVector) {
            questionVector = await generateEmbedding(message);
            setCachedEmbedding(message, questionVector);
        }

        // Build queries - subject-aware if possible
        const knowledgeColl = adminDb.collection('knowledge_base');

        let bookQuery = knowledgeColl.where('metadata.type', '==', 'book');
        let syllabusQuery = knowledgeColl.where('metadata.type', '==', 'syllabus');

        // Apply subject filter if detected
        if (detectedSubject) {
            bookQuery = bookQuery.where('metadata.subject', '==', detectedSubject);
            syllabusQuery = syllabusQuery.where('metadata.subject', '==', detectedSubject);
        }

        // Vector search with increased limit for better coverage
        const bookVectorQuery = bookQuery.findNearest('embedding', questionVector, {
            limit: 5, // Increased from 3
            distanceMeasure: 'COSINE'
        });

        const syllabusVectorQuery = syllabusQuery.findNearest('embedding', questionVector, {
            limit: 2, // Increased from 1
            distanceMeasure: 'COSINE'
        });

        const [bookDocs, syllabusDocs] = await Promise.all([
            bookVectorQuery.get(),
            syllabusVectorQuery.get()
        ]);

        // Calculate confidence
        const confidence = calculateConfidence(bookDocs.docs, syllabusDocs.docs);

        // Build context with source citations
        const sources: any[] = [];

        const bookContext = bookDocs.docs.map((d, idx) => {
            const data = d.data();
            sources.push({
                type: 'book',
                bookName: data.metadata.bookName,
                page: data.metadata.page,
                chapter: data.metadata.chapter
            });
            return `
[Source ${idx + 1}] Book: ${data.metadata.bookName} (Chapter: ${data.metadata.chapter}, Page ${data.metadata.page || '?'})
Content: ${data.content}
Visuals: ${data.visual_description || 'None'}`;
        }).join('\n---\n');

        const syllabusContext = syllabusDocs.docs.map((d, idx) => {
            const data = d.data();
            sources.push({
                type: 'syllabus',
                bookName: data.metadata.bookName
            });
            return `
[Syllabus] ${data.metadata.bookName}
Content: ${data.content}`;
        }).join('\n---\n');

        // Build enhanced prompt with intent-specific formatting
        const contextHistory = (history || []).slice(-10).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const prompt = `
You are an expert AI Tutor for Tayyari Hub (MDCAT Platform).

### CORE IDENTITY:
- **Tone**: Professional, encouraging, and deeply knowledgeable.
- **Bot Behavior**: Function as a comprehensive conversational partner (like ChatGPT/Gemini).
- **Hybrid Knowledge**: Use provided context first, then fallback to internal knowledge. Always aim to be accurate and helpful.

### CONTEXT HISTORY:
${contextHistory || 'No previous conversation.'}

### USER REQUEST:
Current Query: "${message}"
Detected Subject: ${detectedSubject || 'Scientific General'}
Query Type: ${queryIntent}

### CONTEXT FROM BOOKS:
${bookContext || 'No specific book content found.'}

### CONTEXT FROM PMDC SYLLABUS:
${syllabusContext || 'No specific syllabus content found.'}

### INSTRUCTIONS:
1. **Goal**: Provide a detailed, accurate, and context-aware answer.
2. **Behavior**: 
   - Be conversational and warm.
   - For out-of-syllabus topics, provide the answer but anchor it to a relevant MDCAT concept mapping.
   - **Citation**: Naturally mention sources (e.g., "In the Biology textbook...").
3. **Answering Style**:
   - **${formatInstructions}**
   - Use **LaTeX** for all math, units, and chemical formulas.
   - Use **Markdown Tables** for comparisons.
   - Use **Bold** for key terms.

### WRAP-UP:
Suggest 1-2 related questions or "Deep Dives" at the end.
`;

        // Stream Response with status updates
        const result = await geminiFlashModel.generateContentStream(prompt);

        let fullResponse = '';

        const stream = new ReadableStream({
            async start(controller) {
                // Send status updates if enabled
                if (streamStatus) {
                    controller.enqueue(new TextEncoder().encode(STATUS_MESSAGES.FOUND(sources.length)));
                    await new Promise(r => setTimeout(r, 100)); // Small delay for UX
                    controller.enqueue(new TextEncoder().encode(STATUS_MESSAGES.WRITING));
                }

                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    fullResponse += text;
                    controller.enqueue(new TextEncoder().encode(text));
                }

                // Cache the complete response
                setCachedResponse(cacheKey, fullResponse, sources);

                // Log for analytics
                logConversation({
                    query: message,
                    response: fullResponse,
                    sources,
                    subject: detectedSubject,
                    intent: queryIntent,
                    responseTimeMs: Date.now() - startTime,
                    wasFromCache: false
                });

                controller.close();
            }
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'X-Confidence': confidence.score,
                'X-Subject': detectedSubject || 'general',
                'X-Intent': queryIntent,
                'X-Sources-Count': sources.length.toString()
            }
        });

    } catch (error: any) {
        console.error("Chat Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
