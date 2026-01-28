import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is missing in server environment variables");
            return NextResponse.json({ error: 'Server Misconfiguration: GEMINI_API_KEY is missing' }, { status: 500 });
        }

        const body = await req.json();
        const { questions, validChapters, subject, model: selectedModel, syllabusContext } = body;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
        }

        if (!validChapters || !Array.isArray(validChapters) || validChapters.length === 0) {
            return NextResponse.json({ error: 'No valid chapters provided' }, { status: 400 });
        }

        // Use selected model or default
        const model = genAI.getGenerativeModel({ model: selectedModel || 'gemini-3-pro-preview' });

        // Construct the prompt
        // Simplified prompt to avoid markdown code blocks if possible, though flash usually handles it well.
        // We instruct it to be raw JSON.
        // Construct the prompt with specialized role
        const prompt = `
        ## Role
        You are an **Expert Academic AI** specialized in **Competitive Exam Question Analysis (MDCAT / NEET-style)**.
        
        ## Instruction
        Classify the provided questions based strictly on the **${syllabusContext || 'General Standard'}** curriculum.

        ## Input Context
        Subject: "${subject}"
        Syllabus Scope: ${syllabusContext || 'General'}
        Valid Chapters: ${JSON.stringify(validChapters)}

        ## Questions to Analyze
        ${JSON.stringify(questions.map((q: any) => ({
            id: q.id,
            text: q.questionText || q.text,
            options: q.options || []
        })))}

        ## AI Tasks
        1. **Chapter Mapping**: Match question to the most relevant chapter from "Valid Chapters". If overlap, choose primary. Never guess randomly.
        2. **Difficulty Classification**:
           - **Easy**: Direct fact/definition.
           - **Medium**: Conceptual understanding.
           - **Hard**: Multi-step reasoning/traps.

        ## Output Format (STRICT JSON)
        Return ONLY valid JSON. No markdown formatting. No \`\`\`json wrappers.
        Structure:
        {
          "results": [
            {
              "question_id": "id",
              "subject": "${subject}",
              "assigned_chapter": "Chapter Name",
              "difficulty": "Easy" | "Medium" | "Hard"
            }
          ]
        }

        ## Quality Rules
        - ❌ No random guessing
        - ❌ No hallucinated chapters (Must be from Valid Chapters list)
        - ✅ Prefer syllabus-aligned logic
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

        // Serialize full error object including non-enumerable properties like stack
        const details = JSON.stringify(error, Object.getOwnPropertyNames(error));

        return NextResponse.json({
            error: `AI Error: ${msg}`,
            details: details
        }, { status: 500 });
    }
}
