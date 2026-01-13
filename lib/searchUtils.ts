/**
 * Generate search tokens from text for Firestore array-contains queries
 * Strips HTML, converts to lowercase, and extracts unique words
 * @param text - The text to tokenize (can include HTML)
 * @returns Array of unique lowercase words (min 2 characters)
 */
export function generateSearchTokens(text: string): string[] {
    if (!text || typeof text !== 'string') return [];

    // Remove HTML tags
    const plainText = text.replace(/<[^>]*>/g, ' ');

    // Convert to lowercase, remove punctuation, split into words
    const words = plainText
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
        .split(' ')
        .filter(word => word.length >= 2); // Minimum 2 characters

    // Remove duplicates and return
    return Array.from(new Set(words));
}

/**
 * Strip HTML tags from text
 * @param html - HTML string
 * @returns Plain text without HTML tags
 */
export function stripHtml(html: string): string {
    if (!html || typeof html !== 'string') return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
