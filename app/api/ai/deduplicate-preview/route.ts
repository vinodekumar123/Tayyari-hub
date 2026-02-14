
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const { questions } = await req.json();

        if (!questions || !Array.isArray(questions)) {
            return NextResponse.json({ error: 'Questions array is required' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
            You are an AI assistant helping an administrator clean up a question bank.
            Identify questions that are conceptually or semantically identical (at least 90% matching concept).
            
            Questions to analyze (ID and Text):
            ${JSON.stringify(questions, null, 2)}
            
            OUTPUT RULES:
            1. Return ONLY valid JSON.
            2. Identify groups of IDs that are CONCEPTUAL duplicates. 
            3. A conceptual duplicate means the core question is the same, even if worded differently.
            4. Format: { "duplicateGroups": [ [1, 2], [4, 5, 6] ] }
            5. Use the numeric IDs provided in the input.
            6. If no duplicates are found, return { "duplicateGroups": [] }.
        `;

        const result = await model.generateContent(prompt);
        const response = result.response;
        let text = response.text();

        if (text.includes('```')) {
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        }

        return NextResponse.json(JSON.parse(text));

    } catch (error: any) {
        console.error('Deduplication API Error:', error);
        return NextResponse.json({ error: 'Failed to analyze duplicates', details: error.message }, { status: 500 });
    }
}
