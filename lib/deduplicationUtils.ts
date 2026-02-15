
/**
 * Deduplicates a list of questions based on exact text matching.
 */
export function findExactDuplicates(questions: any[]) {
    const normalize = (text: string) => (text || '').replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();

    const seen = new Map<string, number[]>();
    const duplicateGroups: number[][] = [];

    questions.forEach((q, idx) => {
        const key = normalize(q.question);
        if (seen.has(key)) {
            seen.get(key)!.push(idx);
        } else {
            seen.set(key, [idx]);
        }
    });

    seen.forEach((indices) => {
        if (indices.length > 1) duplicateGroups.push(indices);
    });

    return duplicateGroups;
}

/**
 * Uses AI to find semantically similar questions in a list.
 */
export async function findSemanticDuplicatesWithAI(questions: any[], idToken?: string) {
    // Process in batches of 20 to fit in model context and avoid timeouts
    const BATCH_SIZE = 20;
    const allDuplicateGroups: number[][] = [];

    if (!idToken) {
        throw new Error('Authentication required for AI deduplication');
    }

    // We compare questions in overlapping or full list batches?
    // For 500 questions, an N^2 comparison is impossible.
    // Instead, we'll ask the AI to identify clusters in the current list.

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        if (batch.length < 2) continue;

        const response = await fetch('/api/ai/deduplicate-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ questions: batch.map((q, idx) => ({ id: i + idx, text: q.question })) })
        });

        const data = await response.json();
        if (data.duplicateGroups) {
            allDuplicateGroups.push(...data.duplicateGroups);
        }
    }

    return allDuplicateGroups;
}
