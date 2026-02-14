/**
 * Scrub Personal Identifiable Information (PII) from text.
 * Replaces sensitive information with placeholders.
 */
export function scrubPII(text: string): string {
    if (!text) return text;

    let scrubbed = text;

    // 1. Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    scrubbed = scrubbed.replace(emailRegex, '[EMAIL]');

    // 2. Phone Numbers (Basic international and local formats)
    // We avoid scrubbing the support number mentioned in the prompt
    const supportNumber = '03237507673';
    const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,6}/g;

    scrubbed = scrubbed.replace(phoneRegex, (match) => {
        // Keep the support number if it matches exactly (ignoring formatting)
        const digitsOnly = match.replace(/\D/g, '');
        if (digitsOnly === supportNumber) return match;
        return '[PHONE]';
    });

    // 3. Common ID patterns (Optional, can be expanded)
    // e.g., CNIC (Pakistan)
    const cnicRegex = /\d{5}-\d{7}-\d{1}/g;
    scrubbed = scrubbed.replace(cnicRegex, '[ID]');

    return scrubbed;
}
