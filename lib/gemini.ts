export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

import { GoogleGenerativeAI } from "@google/generative-ai";

if (!GEMINI_API_KEY) {
    console.warn("Missing GEMINI_API_KEY environment variable.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

// Models
export const geminiFlashModel = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
export const geminiEmbeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

export async function generateEmbedding(text: string) {
    if (!text) return [];
    const result = await geminiEmbeddingModel.embedContent(text);
    // Truncate to 2048 dimensions (Firestore limit) - gemini-embedding-001 outputs 3072
    return result.embedding.values.slice(0, 2048);
}
