import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateRequest } from '@/lib/auth-middleware';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    console.log("AI Route Hit");

    // 1. Authenticate Request (Security Fix)
    const authResult = await authenticateRequest(req);
    if (!authResult.authenticated) {
        console.warn(`Unauthorized AI access attempt: ${authResult.error}`);
        return NextResponse.json({ error: 'Unauthorized', details: authResult.error }, { status: 401 });
    }

    let promptText = "";
    let subjectText = "";
    let difficultyText = "Medium";

    try {
        const body = await req.json();
        promptText = body.prompt;
        subjectText = body.subject;
        difficultyText = body.difficulty;

        // Log payload selectively if needed, or remove for privacy

        // Check Key
        if (!process.env.GEMINI_API_KEY) {
            console.error("Missing GEMINI_API_KEY in process.env");
            return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
        }

        console.log("API Key Present (length):", process.env.GEMINI_API_KEY.length);

        if (!promptText) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        // Detailed prompt to ensure structured JSON output
        const systemInstruction = `
      You are an expert teacher. Create multiple-choice questions (MCQs) based on the user's prompt.
      
      Prompt: "${promptText}"
      Target Subject: ${subjectText || 'General'}
      Difficulty: ${difficultyText || 'Medium'}

      Output MUST be valid JSON format only, with no markdown code blocks.
      
      IMPORTANT:
      - If the question involves "Match the following", "Compare", or tabular data, use valid HTML <table>, <tr>, <th>, <td> tags within the "questionText" field.
      - Apply class="w-full border-collapse border border-gray-300" to the <table>.
      - Apply class="border border-gray-300 p-2" to <th> and <td>.
      - Use <br/> for line breaks and <strong> for bold text.
      - Do NOT refer to phrases like "in the text", "according to the prompt", or "as requested". The questions must be standalone.

      Structure:
      {
        "questions": [
          {
            "questionText": "HTML string for the question (use <p>, <strong>, <table>, etc)",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctAnswer": "The content of the correct option string exactly matching one of the options",
            "explanation": "Detailed explanation of why the answer is correct",
            "topic": "A specific sub-topic for this question",
            "difficulty": "${difficultyText || 'Medium'}",
            "tags": ["tag1", "tag2"]
          }
        ]
      }
    `;
        console.log("Sending request to Gemini...");
        const result = await model.generateContent(systemInstruction);
        const response = result.response;

        // Log Safety / Blocking Info
        if (response.promptFeedback) {
            console.log("Prompt Feedback:", JSON.stringify(response.promptFeedback));
        }

        const candidates = response.candidates;
        if (!candidates || candidates.length === 0) {
            console.error("No candidates returned from Gemini. Possibly blocked.");
            return NextResponse.json({
                error: 'AI did not provide an answer. This usually happens due to safety filters or regional restrictions.',
                detail: response.promptFeedback
            }, { status: 500 });
        }

        const text = response.text();
        console.log("Gemini Response:", text);

        // Clean up potential markdown code blocks if the AI adds them
        let cleanJson = text;
        if (text.includes('```')) {
            cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        // Parse JSON
        try {
            const data = JSON.parse(cleanJson);
            // Verify structure
            if (!data.questions && Array.isArray(data)) {
                return NextResponse.json({ questions: data });
            } else if (!data.questions && data.questionText) {
                return NextResponse.json({ questions: [data] });
            }
            return NextResponse.json(data);
        } catch (parseError) {
            console.error("JSON Parse Error. Raw Text:", text);
            return NextResponse.json({ error: 'AI returned non-JSON text. Please try again.' }, { status: 500 });
        }

    } catch (error: any) {
        console.error('AI Generation Error Full Object:', JSON.stringify(error, null, 2));

        // If it's a quota error, return a "Smart Mock" response so the user isn't blocked
        if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('limit')) {
            console.log("Quota/Limit issue. Returning Smart Mock response.");
            return NextResponse.json({
                questions: [{
                    questionText: `<p>Explain the core concept of <strong>${promptText}</strong> and its importance.</p>`,
                    options: ["Option A (Example)", "Option B (Example)", "Option C (Example)", "Option D (Example)"],
                    correctAnswer: "Option A (Example)",
                    explanation: `This is a template question for "${promptText}" because your AI API quota is currently limited (Limit: 0). Please check your Google AI Studio billing/plan.`,
                    topic: promptText,
                    difficulty: difficultyText || "Medium",
                    isMock: true
                }]
            });
        }

        return NextResponse.json({ error: 'Failed to generate question: ' + error.message }, { status: 500 });
    }
}
