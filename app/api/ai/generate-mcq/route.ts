import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import PDFParser from 'pdf2json';

export const runtime = 'nodejs';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'dummy_key_for_build', // Fallback for build time
});

// Configure 2MB limit for Vercel/Next.js body parsing if needed, 
// though generally handled by runtime. 
export const maxDuration = 60;

// Helper to parse PDF buffer
const parsePDF = async (buffer: Buffer): Promise<string> => {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true); // 1 = text only

        pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));

        pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
            // Extract raw text content
            const rawText = pdfParser.getRawTextContent();
            resolve(rawText);
        });

        pdfParser.parseBuffer(buffer);
    });
};

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const textInput = formData.get('text') as string;
        const file = formData.get('file') as File;
        const count = formData.get('count') || '5';
        const difficulty = formData.get('difficulty') || 'Medium';
        const typesJson = formData.get('types') as string;

        let contentToProcess = '';

        // 1. Extract Text
        if (textInput) {
            contentToProcess = textInput;
        } else if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            try {
                contentToProcess = await parsePDF(buffer);
            } catch (pdfError) {
                console.error("PDF Parsing failed:", pdfError);
                return NextResponse.json(
                    { error: 'Failed to parse PDF. Please try a different file or paste text.' },
                    { status: 400 }
                );
            }
        }

        if (!contentToProcess || contentToProcess.trim().length < 50) {
            return NextResponse.json(
                { error: 'Could not extract sufficient text. If this is a scanned PDF, please convert to text-searchable PDF.' },
                { status: 400 }
            );
        }

        // Limit tokens
        contentToProcess = contentToProcess.substring(0, 50000);

        // 2. Parse Requested Types
        let selectedTypes: string[] = ['single_correct'];
        try {
            if (typesJson) selectedTypes = JSON.parse(typesJson);
        } catch (e) {
            console.error("Failed to parse types", e);
        }

        // 3. Construct Advanced Prompt
        const typeInstructions = selectedTypes.map(t => {
            switch (t) {
                case 'multiple_correct': return '- Multiple Correct: Questions where more than one option is correct. (Label options A,B,C,D)';
                case 'true_false': return '- True/False: Evaluate a statement.';
                case 'assertion_reason': return '- Assertion-Reason: Provide two statements (Assertion and Reason). Options should be: A) Both true & R explains A, B) Both true but R does not explain A, C) A true R false, D) A false R true.';
                case 'match_following': return '- Match the Following: Present two lists in the question text. Options should be combinations (e.g. A-1, B-2).';
                case 'chronological': return '- Chronological: Arrange events in order.';
                case 'statement_based': return '- Statement Based: "Consider statements I and II". Options: Only I follows, etc.';
                case 'case_study': return '- Case Study: A short scenario provided in the question text.';
                case 'negation': return '- Negation: "Which of the following is NOT..."';
                case 'fill_blanks': return '- Fill in the Blanks: Question with a missing word.';
                default: return '- Single Correct: Standard MCQ.';
            }
        }).join('\n');

        const systemPrompt = `You are an expert AI Exam Creator. Generate ${count} high-quality MCQs based on the provided text.
        Difficulty: ${difficulty}.
        
        REQUIRED QUESTION TYPES (Mix these):
        ${typeInstructions}
        
        OUTPUT FORMAT (JSON):
        {
          "questions": [
            {
              "question": "Question text here (include lists/scenarios if needed)",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "answer": "The text of the correct option (must match one of the options exactly)",
              "explanation": "Detailed explanation",
              "type": "The specific type key (e.g. 'assertion_reason')",
              "tags": ["Topic", "Subtopic"]
            }
          ]
        }
        
        RULES:
        1. Distractors must be plausible.
        2. "answer" field MUST be the exact string of the correct option.
        3. For "True/False", options must be ["True", "False"].
        4. Generate appropriate "tags" for each question based on its content.`;

        const userPrompt = `Content to generate from:\n\n${contentToProcess}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.5,
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("No content from OpenAI");

        const result = JSON.parse(content);
        return NextResponse.json({ questions: result.questions });

    } catch (error: any) {
        console.error('AI Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
    }
}
