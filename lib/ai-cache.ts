import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

// In-memory cache for query results (resets on cold start)
const memoryCache = new Map<string, { response: string; timestamp: number; sources: any[] }>();
const MEMORY_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

// Embedding cache for common terms
const embeddingCache = new Map<string, number[]>();

/**
 * Generate a cache key from a query string
 */
export function generateCacheKey(query: string): string {
    const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('md5').update(normalized).digest('hex');
}

/**
 * Check if a cached response exists
 */
export function getCachedResponse(cacheKey: string): { response: string; sources: any[] } | null {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MEMORY_CACHE_TTL) {
        return { response: cached.response, sources: cached.sources };
    }
    memoryCache.delete(cacheKey);
    return null;
}

/**
 * Store a response in cache
 */
export function setCachedResponse(cacheKey: string, response: string, sources: any[]) {
    memoryCache.set(cacheKey, {
        response,
        sources,
        timestamp: Date.now()
    });

    // Limit cache size to prevent memory bloat
    if (memoryCache.size > 500) {
        const oldestKey = memoryCache.keys().next().value;
        if (oldestKey) memoryCache.delete(oldestKey);
    }
}

/**
 * Get cached embedding
 */
export function getCachedEmbedding(text: string): number[] | null {
    const key = text.toLowerCase().trim();
    return embeddingCache.get(key) || null;
}

/**
 * Store embedding in cache
 */
export function setCachedEmbedding(text: string, embedding: number[]) {
    const key = text.toLowerCase().trim();
    embeddingCache.set(key, embedding);

    // Limit embedding cache size
    if (embeddingCache.size > 200) {
        const oldestKey = embeddingCache.keys().next().value;
        if (oldestKey) embeddingCache.delete(oldestKey);
    }
}

/**
 * Detect subject from query using keyword matching
 */
export function detectSubject(query: string): string | null {
    const lowerQuery = query.toLowerCase();

    const subjectKeywords: Record<string, string[]> = {
        'Biology': ['cell', 'dna', 'rna', 'protein', 'mitosis', 'meiosis', 'enzyme', 'photosynthesis', 'respiration', 'gene', 'chromosome', 'tissue', 'organ', 'blood', 'heart', 'nerve', 'muscle', 'bacteria', 'virus', 'plant', 'animal', 'ecology', 'evolution', 'taxonomy'],
        'Chemistry': ['atom', 'molecule', 'element', 'compound', 'reaction', 'acid', 'base', 'salt', 'ion', 'bond', 'organic', 'inorganic', 'periodic', 'oxidation', 'reduction', 'molar', 'solution', 'equilibrium', 'thermodynamic'],
        'Physics': ['force', 'motion', 'velocity', 'acceleration', 'energy', 'work', 'power', 'wave', 'light', 'sound', 'electric', 'magnetic', 'current', 'voltage', 'resistance', 'momentum', 'gravity', 'newton', 'quantum', 'nuclear'],
        'English': ['grammar', 'vocabulary', 'reading', 'comprehension', 'essay', 'writing', 'literature', 'poetry', 'prose', 'tense', 'verb', 'noun', 'adjective', 'synonym', 'antonym'],
    };

    let bestMatch: string | null = null;
    let maxHits = 0;

    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
        const hits = keywords.filter(kw => lowerQuery.includes(kw)).length;
        if (hits > maxHits) {
            maxHits = hits;
            bestMatch = subject;
        }
    }

    return maxHits > 0 ? bestMatch : null;
}

/**
 * Classify query intent
 */
export type QueryIntent = 'factual' | 'procedural' | 'comparative' | 'practice' | 'general';

export function classifyQueryIntent(query: string): QueryIntent {
    const lowerQuery = query.toLowerCase();

    // Procedural: How to, steps, process
    if (/how (to|do|does|can|should)|step|process|procedure|method/i.test(lowerQuery)) {
        return 'procedural';
    }

    // Comparative: difference, compare, contrast, vs
    if (/difference|compare|contrast|vs\.?|versus|between .* and/i.test(lowerQuery)) {
        return 'comparative';
    }

    // Practice: MCQ, quiz, question, test, practice
    if (/mcq|quiz|question|test|practice|example problem/i.test(lowerQuery)) {
        return 'practice';
    }

    // Factual: What is, define, explain, describe
    if (/what (is|are)|define|explain|describe|tell me about/i.test(lowerQuery)) {
        return 'factual';
    }

    return 'general';
}

/**
 * Get format instructions based on query intent
 */
export function getFormatInstructions(intent: QueryIntent): string {
    switch (intent) {
        case 'procedural':
            return 'Provide a clear step-by-step explanation with numbered steps.';
        case 'comparative':
            return 'Use a table to compare and contrast the items. Highlight key differences.';
        case 'practice':
            return 'Provide 2-3 MCQ-style practice questions with answers and brief explanations.';
        case 'factual':
            return 'Give a direct, concise definition followed by key points.';
        default:
            return 'Explain clearly and concisely.';
    }
}

/**
 * Log AI conversation for analytics
 */
export async function logConversation(data: {
    query: string;
    response: string;
    sources: any[];
    subject: string | null;
    intent: QueryIntent;
    responseTimeMs: number;
    wasFromCache: boolean;
}) {
    try {
        await adminDb.collection('ai_tutor_logs').add({
            ...data,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Failed to log conversation:', error);
    }
}

/**
 * Calculate confidence score based on retrieval results
 */
export function calculateConfidence(bookDocs: any[], syllabusDocs: any[]): {
    score: 'high' | 'medium' | 'low';
    message: string;
} {
    const hasBookMatch = bookDocs.length > 0;
    const hasSyllabusMatch = syllabusDocs.length > 0;

    if (hasSyllabusMatch && hasBookMatch) {
        return { score: 'high', message: '✅ This topic is in your syllabus with supporting textbook content.' };
    } else if (hasBookMatch) {
        return { score: 'medium', message: '📚 Found in textbook materials.' };
    } else if (hasSyllabusMatch) {
        return { score: 'medium', message: '📋 This topic is mentioned in the syllabus.' };
    }
    return { score: 'low', message: '⚠️ Limited sources found. This is a general answer.' };
}
