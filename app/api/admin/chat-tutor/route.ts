import { NextRequest, NextResponse } from 'next/server';
import { geminiFlashModel, generateEmbedding } from '@/lib/gemini';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs'; // Required for Firebase Admin

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message required' }, { status: 400 });
        }

        // 1. Generate Embedding for Question
        const questionVector = await generateEmbedding(message);

        // 2. Vector Search (Using Firestore Native)
        const knowledgeColl = adminDb.collection('knowledge_base');

        // Search for Books
        const bookQuery = knowledgeColl
            .where('metadata.type', '==', 'book')
            .findNearest('embedding', questionVector, {
                limit: 3,
                distanceMeasure: 'COSINE'
            });

        const syllabusQuery = knowledgeColl
            .where('metadata.type', '==', 'syllabus')
            .findNearest('embedding', questionVector, {
                limit: 1,
                distanceMeasure: 'COSINE'
            });

        const [bookDocs, syllabusDocs] = await Promise.all([bookQuery.get(), syllabusQuery.get()]);

        const bookContext = bookDocs.docs.map(d => {
            const data = d.data();
            return `
Book: ${data.metadata.bookName} (Page ${data.metadata.page || '?'})
Content: ${data.content}
Visuals: ${data.visual_description || 'None'}`;
        }).join('\n---\n');

        const syllabusContext = syllabusDocs.docs.map(d => {
            const data = d.data();
            return `
Syllabus: ${data.metadata.bookName}
Content: ${data.content}`;
        }).join('\n---\n');

        // 3. Construct Prompt
        const prompt = `
    You are an expert AI Tutor for MDCAT students.
    
    User Question: "${message}"

    CONTEXT FROM BOOKS:
    ${bookContext}

    CONTEXT FROM PMDC SYLLABUS:
    ${syllabusContext}

    INSTRUCTIONS:
    1. **Analyze the Input:**
       - If it's a greeting ("hi", "thanks"), reply naturally and briefly without academic fluff.
       - If it's a question, answer it directly.

    2. **Answering Style:**
       - **Be direct:** Start immediately with the answer. Do NOT say "Based on the provided documents" or "Hello I am your AI Tutor".
       - **Be natural:** Integrate citations smoothly.
       - **Explain efficiently:** Explain the concept clearly as a teacher would.
       - **FORMATTING RULES:**
         - Use **LaTeX** for ALL math, chemical formulas ($H_2O$), and units ($mol/L$). Wrap inline math in single dollar signs like $E=mc^2$ and block math in double dollar signs.
         - Use **Markdown Tables** when listing properties, differences, or steps.
         - Use **Bold** for key terms and Lists for steps.

    3. **Syllabus Check:**
       - If the topic appears in the SYLLABUS context, mention it: "✅ This is explicitly in the PMDC Syllabus."
       - If NOT found, simply add a small note at the very bottom: "_Note: Exact syllabus match not retrieved for this specific query._" rather than a big warning.
    
    Keep the tone encouraging, professional, and helpful.
    `;

        // 4. Stream Response
        const result = await geminiFlashModel.generateContentStream(prompt);

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    controller.enqueue(new TextEncoder().encode(text));
                }
                controller.close();
            }
        });

        return new NextResponse(stream, {
            headers: { 'Content-Type': 'text/event-stream' }
        });

    } catch (error: any) {
        console.error("Chat Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
