import { reportMissingIndex } from '@/app/actions/index-reporting';

/**
 * Parses a Firestore error to check if it's a missing index error.
 * If verified, it reports it to the server.
 */
export async function monitorFirestoreError(error: any, context?: string) {
    if (!error) return;

    const message = error.message || error.toString();

    // Check for the specific Firestore error code or message pattern
    // "failed-precondition" is the code, "The query requires an index" is the message text.
    const isIndexError =
        error?.code === 'failed-precondition' ||
        message.includes('The query requires an index') ||
        message.includes('create_composite_index');

    if (isIndexError) {
        console.warn('🚨 Missing Index Detected! Reporting to admin system...', context);

        try {
            await reportMissingIndex({
                message: message,
                queryInfo: context || 'Unknown Query',
                path: window.location.pathname
            });
        } catch (reportErr) {
            // checking console is safe here as this is a background monitoring task
            console.error('Failed to report index error:', reportErr);
        }
    }
}

import { getDocs, Query, DocumentData, QuerySnapshot } from 'firebase/firestore';

/**
 * A drop-in replacement for getDocs that monitors for index errors.
 */
export async function safeGetDocs<T = DocumentData>(
    query: Query<T>,
    context?: string
): Promise<QuerySnapshot<T>> {
    return safeFirestore(
        () => getDocs(query),
        context || 'getDocs'
    );
}

/**
 * A wrapper for Firestore getDocs/onSnapshot/etc that automatically monitors for index errors.
 * Use this to wrap your query execution.
 * 
 * Example:
 * const snapshot = await safeFirestore(async () => await getDocs(q), 'fetchCommunityPosts');
 */
export async function safeFirestore<T>(
    operation: () => Promise<T>,
    contextName: string
): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        // Monitor the error
        monitorFirestoreError(error, contextName);
        // Re-throw so the app handles it (or doesn't) as usual
        throw error;
    }
}
