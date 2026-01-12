
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const { prompt, count, metadata, strictMode, correctGrammar, action = 'generate' } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
        }

        // Using 2.0 Flash for speed and improved logic
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        let finalPrompt = '';

        if (action === 'parse') {
            finalPrompt = `
           You are an expert data extraction AI.
           Your task is to PARSE AND STRUCTURE the following raw text containing multiple-choice questions.

           RAW TEXT:
           """
           ${prompt}
           """

           Output format MUST be a strict JSON Array of objects.
           Extract as many valid questions as found in the text.
           `;
        } else {
            finalPrompt = `
           You are an expert exam question generator.
           Generate ${count} multiple-choice questions on the topic: "${prompt}".
           
           Output format MUST be a strict JSON Array of objects.
           `;
        }

        finalPrompt += `
      Each object must have:
      - questionText (string)
      - option1 (string)
      - option2 (string)
      - option3 (string)
      - option4 (string)
      - correctAnswer (string) - MUST be exactly equal to one of the options.
      - explanation (string) - Brief explanation (if found in text, otherwise infer it).
      - difficulty (string) - Detect from text or default to "Medium".
      - topic (string) - Detect main topic.

      Constraints:
      1. Ensure options are distinct.
      2. Ensure correctAnswer matches one option exactly (case-sensitive).
      3. No Markdown formatting in the explanation.
    `;

        if (strictMode) {
            finalPrompt += `
      4. STRICTLY RESPECT CONTEXT:
         - Subject: ${metadata.subject}
         - Chapter: ${metadata.chapter}
         - Difficulty Level: ${metadata.difficulty} (Make ALL questions this difficulty).
      `;
        } else {
            finalPrompt += `
      4. Auto-detect and assign appropriate 'difficulty' (Easy/Medium/Hard) and 'topic' for each question based on its content.
      `;
        }

        if (correctGrammar) {
            finalPrompt += `
      5. GRAMMAR & SPELLING: Ensure all questions and explanations follow strict academic English standards. Proofread carefully.
      `;
        }

        const result = await model.generateContent(finalPrompt);
        const responseText = result.response.text();

        console.log("Raw AI Response:", responseText.substring(0, 200) + "...");

        // Clean up potential markdown formatting if model ignores instruction
        let jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse
        let questions;
        try {
            questions = JSON.parse(jsonStr);
        } catch (e) {
            // Fallback: Try to find array bracket
            const start = jsonStr.indexOf('[');
            const end = jsonStr.lastIndexOf(']');
            if (start !== -1 && end !== -1) {
                jsonStr = jsonStr.substring(start, end + 1);
                questions = JSON.parse(jsonStr);
            } else {
                throw new Error("Failed to parse AI response as JSON");
            }
        }

        if (!Array.isArray(questions)) {
            throw new Error("AI did not return an array");
        }

        return NextResponse.json({ questions });

    } catch (error: any) {
        console.error('AI Bulk Gen Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate questions' },
            { status: 500 }
        );
    }
}
