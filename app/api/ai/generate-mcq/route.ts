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
        contentToProcess = contentToProcess.substring(0, 100000); // Increased limit for larger contexts

        // 2. Parse Requested Types
        let selectedTypes: string[] = ['single_correct'];
        try {
            if (typesJson) selectedTypes = JSON.parse(typesJson);
        } catch (e) {
            console.error("Failed to parse types", e);
        }

        // 3. Construct Advanced Prompt with 15 Types
        const typeInstructions = selectedTypes.map(t => {
            switch (t) {
                case 'single_correct': return '- Single Best Option (SBA): Standard conceptual question.';
                case 'multiple_correct': return '- Multiple Correct: Questions where more than one option is correct. (Label options A,B,C,D)';
                case 'assertion_reason': return '- Assertion-Reason (A/R): Provide two statements (Assertion and Reason). Options: A) Both true & R explains A, B) Both true but R does not explain A, C) A true R false, D) A false R true.';
                case 'true_false': return '- True / False: Mark correct biological statement. Options: A) True, B) False.';
                case 'fill_blanks': return '- Fill in the Blank: Correct biological term or name. Options must be the terms.';
                case 'match_following': return '- Match the Following: You MUST provide the two lists (List I and List II) clearly WITHIN the question text field using an HTML table. Options must be combinations of these lists (e.g., A-1, B-2, C-3, D-4).';
                case 'chronological': return '- Sequence / Process Order: Steps of biological process (e.g., mitosis). Options are sequences.';
                case 'case_study': return '- Case Study: A short clinical or scenario vignette provided in the question text.';
                case 'statement_based': return '- Statement Based: "Consider statements I, II, III". Options: "Only I and II are correct", etc.';
                case 'negation': return '- Except / Not Correct: All options correct except one.';
                case 'error_spotting': return '- Error Spotting / Statement Correction: Identify the incorrect statement.';
                case 'analogy': return '- Analogy: "Mitochondria : Powerhouse :: Ribosome : ?"';
                case 'odd_one_out': return '- Odd One Out: Which option does not belong to the group?';
                case 'best_explanation': return '- Best Explanation: "Which option best explains the phenomenon?"';
                case 'definition': return '- Definition Based: Direct recall of definitions.';
                default: return '- Single Best Option (SBA).';
            }
        }).join('\n');

        const systemPrompt = `You are an elite exam designer, philosopher, and master educator combined. Your mission is to generate a set of multiple-choice questions (MCQs) that are so diverse, challenging, and conceptually rich that they squeeze every possible insight from the given topic/book/PDF.

Guidelines:
1. **Genres of Questions**:
   - Recall: test definitions, facts, and basic concepts.
   - Application: real-world scenarios, problem-solving, experiments.
   - Analysis: compare/contrast, cause-effect, data interpretation.
   - Synthesis: combine ideas, predict outcomes, design solutions.
   - Evaluation: judge validity, critique arguments, spot flaws.
   - Misconception-busting: expose common student errors.
   - Creative twist: unusual angles, riddles, or analogies.

2. **Question Design**:
   - Each MCQ must have 4 options (A–D).
   - Only one correct answer, but distractors must be plausible.
   - Vary difficulty: easy → moderate → advanced → mind-blowing.

3. **Coverage / Instructions**:
   - Generate exactly ${count} questions.
   - Difficulty Level: ${difficulty}.
   - You MUST include the following types in your set:
     ${typeInstructions}
   - Ensure every subtopic is tested.
   - Include hidden details, subtle nuances, and cross-links between concepts.

4. **Output Format (STRICT JSON)**:
   You must output ONLY valid JSON. No other text. The JSON must match this schema:
   {
     "questions": [
       {
         "question": "Question text here (include lists/scenarios if needed)",
         "options": ["Option A", "Option B", "Option C", "Option D"],
         "answer": "The text of the correct option (must match one of the options exactly)",
         "explanation": "Detailed explanation including why the answer is correct and distractors are wrong.",
         "type": "The specific type key (e.g. 'assertion_reason')",
         "tags": ["Topic", "Subtopic"]
       }
     ]
   }

Tone:
- Make the questions feel like puzzles or intellectual challenges.
- Push students to “aha!” moments where they connect ideas in new ways.

Formatting Instructions:
- **Keys**: Wrap keys like "List I:", "Statement 1:" in <strong> tags (e.g., <strong>List I:</strong>).
- **Match the Following**: You MUST use HTML <table> tags for matching lists.
  Example:
  <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
    <thead>
      <tr><th style="border: 1px solid #ddd; padding: 8px;">List I</th><th style="border: 1px solid #ddd; padding: 8px;">List II</th></tr>
    </thead>
    <tbody>
      <tr><td style="border: 1px solid #ddd; padding: 8px;">(i) Mitochondria</td><td style="border: 1px solid #ddd; padding: 8px;">(a) ATP production</td></tr>
    </tbody>
  </table>
- **Lists/Sequences**: Use <ul> or <ol> for lists and <li> for each item. 
- **Newlines**: Use <br/> for standard line breaks.
- Note: The platform uses HTML rendering (dangerouslySetInnerHTML) in student quizzes, so strictly use HTML tags for formatting. Do not use Markdown.

5. **Negative Constraints (CRITICAL)**:
   - **Do NOT** refer to the input text as "the document", "the passage", "the text", or "the provided content".
   - **Do NOT** use phrases like "According to the passage", "As mentioned in the text", "Based on the document", or "In the provided material".
   - **Do NOT** mention the source file or author unless explicitly asked.
   - The questions must stand alone as general knowledge or context-independent problems (even though they are based on the text).`;

        const userPrompt = `Content to generate from:\n\n${contentToProcess}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_tokens: 4096,
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
