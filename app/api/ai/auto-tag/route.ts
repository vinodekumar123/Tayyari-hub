import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { questions, validChapters, subject } = body;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
        }

        if (!validChapters || !Array.isArray(validChapters) || validChapters.length === 0) {
            return NextResponse.json({ error: 'No valid chapters provided' }, { status: 400 });
        }

        // Use standard gemini-2.5-flash as per available models
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Construct the prompt
        // Simplified prompt to avoid markdown code blocks if possible, though flash usually handles it well.
        // We instruct it to be raw JSON.
        const prompt = `
        You are an educational assistant. 
        Subject: "${subject}"
        
        Task:
        1. Read ${questions.length} questions.
        2. Assign each to ONE chapter from the "Valid Chapters" list.
        3. Assign difficulty (Easy, Medium, Hard).

        Valid Chapters:
        ${JSON.stringify(validChapters)}

        Questions:
        ${JSON.stringify(questions.map((q: any) => ({ id: q.id, text: q.questionText || q.text })))}

        Output:
        Return ONLY valid JSON. No markdown formatting. No \`\`\`json wrappers.
        Format:
        {
            "results": [
                { "id": "q_id", "chapter": "Name", "difficulty": "Level" }
            ]
        }
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.log("AI Raw Response:", text.substring(0, 100) + "...");

        // Clean and parse
        let data;
        try {
            // Remove any potential markdown wrappers just in case
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            data = JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            console.error("Offending Text:", text);
            return NextResponse.json({ error: "Failed to parse AI response: " + text.substring(0, 100) }, { status: 502 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Auto-Tag API Error Details:', error);

        // Extract inner error message if available
        const msg = error?.message || "Unknown Error";
        const details = JSON.stringify(error);

        return NextResponse.json({
            error: `AI Error: ${msg}`,
            details: details
        }, { status: 500 });
    }
}
