'use server';

import { geminiFlashModel, geminiEmbeddingModel } from '@/lib/gemini';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { SchemaType } from '@google/generative-ai';

interface IngestionMetadata {
    subject: string;
    bookName: string;
    province: string;
    year: string;
    type: 'book' | 'syllabus';
}

interface AnalysisRequest {
    fileData: string; // Base64
    mimeType: string;
}

interface SaveRequest {
    text: string;
    description: string;
    chapter: string;
    page_number: string;
    fileName: string;
    metadata: IngestionMetadata;
}

export async function analyzeDocument(data: AnalysisRequest) {
    try {
        const { fileData, mimeType } = data;

        // Basic Validation
        // Gemini Inline Data Limit is ~20MB. 
        // Base64 is ~33% larger than binary. So ~26MB Base64 string is the limit.
        if (fileData.length > 27 * 1024 * 1024) {
            return { success: false, error: "File too large for inline processing (Limit 20MB). Please split the PDF." };
        }

        const prompt = `Analyze this textbook page or document. 
    1. Extract the MAIN visible text. If the document is very long, summarize the key content instead of full transcription.
    2. If there are diagrams, describe them in detail (visual description).
    3. Look for the "Chapter Number/Name" and "Page Number" on the page.
    
    IMPORTANT: Do not exceed the JSON response limit. Be concise if the page is dense.`;

        const imagePart = {
            inlineData: {
                data: fileData,
                mimeType: mimeType
            }
        };

        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    text: { type: SchemaType.STRING, description: "Extracted text or summary." },
                    description: { type: SchemaType.STRING, description: "Visual description of diagrams." },
                    chapter: { type: SchemaType.STRING, description: "Chapter Number and Name." },
                    page_number: { type: SchemaType.STRING, description: "Page Number." },
                },
                required: ["text", "description", "chapter", "page_number"],
            },
            // Maximize output tokens to prevent truncation
            maxOutputTokens: 8192,
        };

        const result = await geminiFlashModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
            generationConfig: generationConfig as any
        });

        const response = await result.response;
        const textResponse = response.text();

        console.log("Gemini Response Length:", textResponse.length);
        if (textResponse.length > 5000000) {
            console.warn("Response is dangerously large!");
        }

        let parsed;
        try {
            parsed = JSON.parse(textResponse);
        } catch (e) {
            console.error("JSON Parse Fail. Raw Response Preview:", textResponse.slice(0, 500));
            console.error("Raw Response End:", textResponse.slice(-200));

            // Try fundamental repair (sometimes quotes aren't closed)
            if (e instanceof SyntaxError && e.message.includes("Unterminated string")) {
                try {
                    // Extremely naive repair: Close the quote and the object
                    const repaired = textResponse + '"}';
                    parsed = JSON.parse(repaired);
                } catch (e2) {
                    return { success: false, error: "AI Response Truncated: " + (e as Error).message };
                }
            } else {
                return { success: false, error: "Invalid JSON from AI: " + (e as Error).message };
            }
        }

        return { success: true, data: parsed };

    } catch (error: any) {
        console.error("Analysis Error:", error);
        return { success: false, error: "AI Processing Failed: " + error.message };
    }
}

export async function saveToKnowledgeBase(data: SaveRequest) {
    try {
        const { text, description, chapter, page_number, fileName, metadata } = data;

        const textToEmbed = `
      Subject: ${metadata.subject}
      Book: ${metadata.bookName}
      Chapter: ${chapter}
      Content: ${text}
      Visuals: ${description}
    `.trim();

        const embeddingResult = await geminiEmbeddingModel.embedContent(textToEmbed);
        const vector = embeddingResult.embedding.values;

        const docRef = await adminDb.collection('knowledge_base').add({
            content: text,
            visual_description: description,
            embedding: FieldValue.vector(vector),
            metadata: {
                ...metadata,
                chapter: chapter || "Unknown",
                page: page_number || "Unknown",
                fileName: fileName,
                uploadedAt: new Date()
            }
        });

        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error("Save Error:", error);
        return { success: false, error: "Database Save Failed: " + error.message };
    }
}
