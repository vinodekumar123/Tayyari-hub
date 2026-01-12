import { Timestamp } from 'firebase/firestore';

/**
 * Safely converts a Firestore Timestamp, string, number, or Date object into a native JavaScript Date object.
 * Returns the current date if parsing fails, ensuring the UI doesn't crash.
 * 
 * @param value - The input date value (Timestamp, string, number, Date, or null/undefined)
 * @returns Date object
 */
export function safeDate(value: any): Date {
    if (!value) return new Date(); // Fallback for null/undefined

    // Handle Firestore Timestamp (has .toDate() method)
    if (typeof value.toDate === 'function') {
        try {
            return value.toDate();
        } catch (e) {
            console.error("Error converting Timestamp:", e);
        }
    }

    // Handle Date object
    if (value instanceof Date) {
        return value;
    }

    // Handle String or Number (Timestamp millis)
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    console.warn("safeDate encountered invalid input:", value);
    return new Date(); // Safe fallback
}
