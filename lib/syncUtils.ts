/**
 * Sync Utilities for Question Bank Synchronization
 * Provides robust duplicate detection and field mapping
 */

/**
 * Normalize text for comparison - strips HTML, lowercases, removes extra whitespace
 */
export function normalizeText(html: string): string {
    if (!html) return '';

    // Create a temporary element to strip HTML
    const tmp = typeof document !== 'undefined'
        ? document.createElement('div')
        : { innerHTML: '', textContent: '' };
    tmp.innerHTML = html;
    const text = tmp.textContent || tmp.innerHTML || '';

    // Normalize: lowercase, remove extra whitespace, trim
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '') // Remove special characters
        .trim();
}

/**
 * Generate a simple hash for duplicate detection
 * Uses question text + correct answer for uniqueness
 */
export function generateQuestionHash(questionText: string, correctAnswer: string): string {
    const normalizedQuestion = normalizeText(questionText);
    const normalizedAnswer = (correctAnswer || '').toLowerCase().trim();
    const combined = `${normalizedQuestion}:::${normalizedAnswer}`;

    // Simple hash function (djb2)
    let hash = 5381;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
}

/**
 * Calculate similarity between two strings (Jaccard similarity)
 * Returns a value between 0 and 1
 */
export function calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(normalizeText(text1).split(' ').filter(Boolean));
    const words2 = new Set(normalizeText(text2).split(' ').filter(Boolean));

    if (words1.size === 0 && words2.size === 0) return 1;
    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
}

export interface DuplicateCheckResult {
    sourceId: string;
    status: 'new' | 'duplicate' | 'similar';
    matchedId?: string;
    similarityScore?: number;
}

/**
 * Check for duplicates between source and target questions
 * Optimized to limit similarity comparisons for performance
 */
export function findDuplicates(
    sourceQuestions: Array<{ id: string; questionText: string; correctAnswer: string }>,
    targetHashes: Map<string, string>, // hash -> id
    targetTexts: Map<string, { id: string; text: string }[]>, // normalized text -> id
    similarityThreshold: number = 0.85
): DuplicateCheckResult[] {
    const results: DuplicateCheckResult[] = [];

    // Pre-compute target texts array for faster iteration (limited to 500 for performance)
    const targetTextArray = [...targetTexts.values()].flat().slice(0, 500);

    for (const source of sourceQuestions) {
        const hash = generateQuestionHash(source.questionText, source.correctAnswer);

        // Check exact hash match first (O(1) lookup)
        if (targetHashes.has(hash)) {
            results.push({
                sourceId: source.id,
                status: 'duplicate',
                matchedId: targetHashes.get(hash),
                similarityScore: 1
            });
            continue;
        }

        // Check for similar questions (limited comparisons for performance)
        const normalizedSource = normalizeText(source.questionText);

        // Skip similarity check for very short questions (less reliable)
        if (normalizedSource.length < 20) {
            results.push({ sourceId: source.id, status: 'new' });
            continue;
        }

        let foundSimilar = false;
        let bestMatch: { id: string; score: number } | null = null;

        // Limit to checking first 100 targets for similarity to avoid O(n²)
        const targetsToCheck = targetTextArray.slice(0, 100);

        for (const target of targetsToCheck) {
            // Quick length heuristic - skip if lengths differ by more than 50%
            if (target.text.length < normalizedSource.length * 0.5 ||
                target.text.length > normalizedSource.length * 1.5) {
                continue;
            }

            const similarity = calculateSimilarity(normalizedSource, target.text);
            if (similarity >= similarityThreshold) {
                if (!bestMatch || similarity > bestMatch.score) {
                    bestMatch = { id: target.id, score: similarity };
                }
                foundSimilar = true;
            }
        }

        if (foundSimilar && bestMatch) {
            results.push({
                sourceId: source.id,
                status: 'similar',
                matchedId: bestMatch.id,
                similarityScore: bestMatch.score
            });
        } else {
            results.push({
                sourceId: source.id,
                status: 'new'
            });
        }
    }

    return results;
}

export interface SyncConfig {
    lastSyncDate: Date | null;
    lastSyncId: string | null;
    totalSynced: number;
    lastSyncSubjects: string[];
}

/**
 * Map question fields from source (questions) to target (mock-questions)
 */
export function mapQuestionFields(
    source: any,
    courseName: string,
    teacherName: string
): any {
    return {
        questionText: source.questionText || '',
        options: source.options || [],
        correctAnswer: source.correctAnswer || '',
        explanation: source.explanation || '',
        subject: source.subject || '',
        course: courseName || source.course || '',
        chapter: source.chapter || '',
        topic: source.topic || '',
        difficulty: source.difficulty || 'Medium',
        year: source.year || '',
        book: source.book || '',
        teacher: teacherName || '',
        enableExplanation: true,
        status: 'published',
        isDeleted: false,
        type: source.type || 'multiple-choice',

        // Sync metadata
        syncedFrom: source.id,
        syncedAt: new Date(),
        sourceCollection: 'questions'
    };
}

/**
 * Format date for display
 */
export function formatSyncDate(date: Date | null): string {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}
