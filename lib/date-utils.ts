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

/**
 * Determines the status of a quiz based on its start/end dates and times.
 * Handles timezone logic robustly by comparing ISO strings or timestamps properly.
 * 
 * @param startDate - YYYY-MM-DD string
 * @param endDate - YYYY-MM-DD string
 * @param startTime - HH:MM string (optional)
 * @param endTime - HH:MM string (optional)
 * @returns 'active' | 'upcoming' | 'ended'
 */
export function getQuizStatus(startDate: string, endDate: string, startTime?: string, endTime?: string): 'active' | 'upcoming' | 'ended' {
    try {
        if (!startDate || !endDate) return 'ended';

        // Get current time in Pakistan (PKT)
        // We use the Intl API to get the current time in the target timezone
        const nowString = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" });
        const now = new Date(nowString);

        // Helper to construct a Date object that effectively represents the target time 
        // relative to the "shifted" 'now' object.
        const createTargetDate = (dateStr: string, timeStr: string) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const [h, min] = timeStr.split(':').map(Number);
            return new Date(y, m - 1, d, h, min);
        };

        let start: Date;
        if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
            start = createTargetDate(startDate, startTime);
        } else {
            // Default start of day (00:00)
            start = createTargetDate(startDate, "00:00");
        }

        let end: Date;
        if (endTime && /^\d{2}:\d{2}$/.test(endTime)) {
            end = createTargetDate(endDate, endTime);
        } else {
            // Default end of day (23:59:59)
            const [y, m, d] = endDate.split('-').map(Number);
            end = new Date(y, m - 1, d, 23, 59, 59, 999);
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'ended';

        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'ended';
    } catch (error) {
        console.error("Error in getQuizStatus", error);
        return 'ended';
    }
}
