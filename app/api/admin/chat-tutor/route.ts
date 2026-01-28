import { NextRequest, NextResponse } from 'next/server';
import { geminiFlashModel, generateEmbedding } from '@/lib/gemini';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs'; // Required for Firebase Admin

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message required' }, { status: 400 });
        }

        // 1. Generate Embedding for Question
        const questionVector = await generateEmbedding(message);

        // 2. Vector Search (Using Firestore Native or Manual Cosine - Assuming Native for simplicity/production)
        // Note: Since Vector Search is preview/requires index, we assume it's enabled.
        // If exact vector search isn't set up yet, we might fail here.
        // We will simulate Retrieval if index is missing or use a basic query if vector search is strictly required.

        // For this implementation, we will use the standard Vector Query logic.
        // NOTE: This requires you to have created a Vector Index on `knowledge_base` collection for `embedding` field.

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

    Use the following retrieved context to answer.

    CONTEXT FROM BOOKS:
    ${bookContext}

    CONTEXT FROM PMDC SYLLABUS:
    ${syllabusContext}

    INSTRUCTIONS:
    1. Answer the question comprehensively using the BOOK context. Cite specific Book Names and Page Numbers if available.
    2. After the answer, create a section called "**Syllabus Check**". I Check if the user's topic is mentioned in the SYLLABUS context. 
       - If yes, say "✅ This topic is explicitly listed in the PMDC Syllabus."
       - If no, say "⚠️ Note: This topic was not found in the retrieved PMDC Syllabus sections."
    
    Keep the tone encouraging and academic.
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
