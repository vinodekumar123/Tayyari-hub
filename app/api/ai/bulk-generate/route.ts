
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireStaff } from '@/lib/auth-middleware';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const maxDuration = 300; // Allow 5 minutes for generation

export async function POST(req: NextRequest) {
    try {
        const authResult = await requireStaff(req);
        if (!authResult.authorized) {
            return NextResponse.json({ error: 'Unauthorized', details: authResult.error }, { status: authResult.status ?? 401 });
        }

        const { prompt, count, metadata, strictMode, correctGrammar, strictPreservation, enableFormatting = true, validChapters, action = 'generate' } = await req.json();

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
        }

        // Using Gemini 3 Flash (Preview)
        const model = genAI.getGenerativeModel({
            model: 'gemini-3-flash-preview',
            generationConfig: { responseMimeType: 'application/json' }
        });

        let finalPrompt = '';

        if (action === 'parse') {
            finalPrompt = `
           You are an expert data extraction AI.
           Your task is to PARSE, STRUCTURE, and CLASSIFY the following raw text containing multiple - choice questions.

           CRITICAL INSTRUCTIONS FOR NOISE REMOVAL:
            1. ** Ignore Page Numbers **: The text contains page numbers like "2 / 50", "3 / 50".COMPLETELY IGNORE THESE.
           2. ** Remove Numbering **: Remove leading question numbers(e.g., "1.", "2.").The "questionText" should start with the actual question content.
           3. ** Remove Option Labels **: Remove leading option labels(e.g., "a)", "b)", "A.", "B.").The "option1", "option2", etc., should contain ONLY the answer text.
           4. ** Extract Answer Key **: Look for "KEY", "Answer:", or similar indicators at the end of each question to identify the correct answer.
           5. ** Ignore Formatting Noise **: Ignore random headers like "FORCE AND MOTION" unless they are part of a question.

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
           Generate ${count} multiple - choice questions on the topic: "${prompt}".
           
           Output format MUST be a strict JSON Array of objects.
           `;
        }

        finalPrompt += `
      Each object must have:
            - questionText(string)
                - option1(string)
                - option2(string)
                - option3(string)
                - option4(string)
                - correctAnswer(string) - MUST be exactly equal to one of the options.
      - explanation(string) - Brief explanation.
      - difficulty(string) - Detect from text or default to "Medium".
      - chapter(string) - MUST be selected from the valid chapters list below.
      - subject(string) - The subject of the content.

                Constraints:
            1. Ensure options are distinct.
      2. Ensure correctAnswer matches one option exactly.
      3. No Markdown formatting in the explanation.
            4. HTML FORMATTING(STRICT):
         ${enableFormatting ? `
         - ** Tables **: For "Match the following", "Compare", or any tabular data, you MUST use HTML < table > tags.
                Example:
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;" >
                <thead>
                <tr><th style="border: 1px solid #ddd; padding: 8px;" > List I < /th><th style="border: 1px solid #ddd; padding: 8px;">List II</th > </tr>
                    </thead>
                    < tbody >
                    <tr><td style="border: 1px solid #ddd; padding: 8px;" > A < /td><td style="border: 1px solid #ddd; padding: 8px;">1</td > </tr>
                        </tbody>
                        </table>
                        - ** Lists **: Use < ul > or<ol> for lists of items.Use<li> for each item.
           **CRITICAL**: If the input text has inline lists like "1. Item A 2. Item B", you MUST convert them to a proper list structure.
         - ** Keys / Labeling **: Wrap keys like "Statement 1:", "List I:", "Reason:" in <strong>tags(e.g., <strong>Statement 1: </strong>).
         - ** Newlines **: Use < br /> for line breaks where lists or paragraphs are not used.
         ` : `
         - ** NO HTML **: Do NOT use any HTML tags like <table>, <ul>, <li>, <br/>, <strong>.
         - ** Lists **: Use simple text numbering (1., 2.) or bullet points (-).
         - ** Newlines **: Use standard newline characters (\\n).
         `}

      8. NEGATIVE CONSTRAINTS(CRITICAL):
         - ** Do NOT ** refer to the input text as "the document", "the passage", "the text", or "the provided content".
         - ** Do NOT ** use phrases like "According to the passage", "As mentioned in the text", "Based on the document", or "In the provided material".
         - ** Do NOT ** mention the source file or author unless explicitly asked.
         - The questions must stand alone as general knowledge or context - independent problems.
    `;

        if (validChapters && Array.isArray(validChapters) && validChapters.length > 0) {
            finalPrompt += `
            4. CHAPTER SELECTION(CRITICAL):
         You MUST categorize each question into one of the following chapters.
         Do NOT invent new chapters.Use the closest match from this list:
         VALID CHAPTERS: ${JSON.stringify(validChapters)}
            `;
        }

        if (strictPreservation) {
            finalPrompt += `
            5. STRICT PRESERVATION MODE(CRITICAL):
            - DO NOT MODIFY THE QUESTION TEXT OR OPTIONS.
          - DO NOT CORRECT GRAMMAR OR SPELLING.
          - EXTRACT EXACTLY AS PROVIDED.
          - **EXCEPTION**: You MUST still apply HTML formatting (bolding, lists, tables) as instructed in Section 4 if enableFormatting is true, to ensure proper structure.
          - IGNORE ANY INSTRUCTIONS TO MODIFY OR GENERATE CONTENT.
         - ACT AS A DUMB PARSER ONLY.
      `;
        }

        // Unified Metadata Handling
        finalPrompt += `
            6. METADATA HANDLING:
            - Subject: "${metadata.subject}"(Set 'subject' field to this value for ALL questions).
      `;

        if (metadata.chapter && metadata.chapter !== 'All Chapters' && metadata.chapter !== 'All') {
            finalPrompt += `   - Chapter: "${metadata.chapter}" (CRITICAL: Set 'chapter' field to EXACTLY this value for ALL questions. Do not auto-detect).\n`;
        } else {
            finalPrompt += `   - Chapter: Auto-detect the most appropriate 'chapter' based on the question content. Choose ONLY from the valid chapters list provided above.\n`;
        }

        if (strictMode) {
            finalPrompt += `   - Difficulty: "${metadata.difficulty}" (Force this difficulty).\n`;
        } else {
            finalPrompt += `   - Difficulty: Auto-detect based on content.\n`;
        }

        if (correctGrammar && !strictPreservation) {
            finalPrompt += `
            7. GRAMMAR: Ensure strict academic English.
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
