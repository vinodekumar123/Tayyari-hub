import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const maxDuration = 60; // Allow 60 seconds for generation

export async function POST(req: Request) {
    try {
        const { text, count = 5, difficulty = 'Medium', type = 'multiple_choice' } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
        }

        const systemPrompt = `You are an expert educational content creator. Your task is to generate high-quality ${difficulty} level multiple-choice questions (MCQs) based strictly on the provided text.
        
        Output must be a valid JSON object with a "questions" array. Each question object must have:
        - "question": The question text.
        - "options": An array of 4 options (strings).
        - "answer": The correct option (string, must be one of the options).
        - "explanation": A brief explanation of why the answer is correct.
        
        Ensure distractors (wrong options) are plausible but clearly incorrect. Do not include questions that cannot be answered from the text provided.`;

        const userPrompt = `Generate ${count} MCQs from the following text:\n\n${text.substring(0, 100000)}`; // Limit input to avoid token limits if massive

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;
        if (!content) {
            throw new Error("No content received from OpenAI");
        }

        const result = JSON.parse(content);
        return NextResponse.json({ questions: result.questions });

    } catch (error: any) {
        console.error('AI Generation formatting error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate questions' }, { status: 500 });
    }
}
