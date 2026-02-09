'use server';

import { geminiFlashModel } from '@/lib/gemini';
import { SchemaType } from '@google/generative-ai';

interface ChapterDetectionResult {
    isStart: boolean;
    title?: string;
    confidence: number;
}

export async function detectChapterStart(base64Image: string, mimeType: string): Promise<{ success: boolean; data?: ChapterDetectionResult; error?: string }> {
    try {
        const prompt = `Analyze this page from a textbook.
        Does this page look like the START of a new Chapter or Unit?
        Look for large headings like "Chapter 1", "Unit 3", "1. Introduction", etc.
        
        Return JSON:
        {
            "isStart": boolean,
            "title": string (The chapter title if found, else null),
            "confidence": number (0 to 1)
        }`;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType
            }
        };

        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    isStart: { type: SchemaType.BOOLEAN, description: "Is this the start of a chapter?" },
                    title: { type: SchemaType.STRING, description: "Chapter Title", nullable: true },
                    confidence: { type: SchemaType.NUMBER, description: "Confidence score 0-1" }
                },
                required: ["isStart", "confidence"]
            }
        };

        const result = await geminiFlashModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
            generationConfig: generationConfig as any
        });

        const response = await result.response;
        const text = response.text();
        const data = JSON.parse(text);

        return { success: true, data };

    } catch (error: any) {
        console.error("Chapter Detection Error:", error);
        return { success: false, error: error.message };
    }
}
