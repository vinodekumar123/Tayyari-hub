import { useUIStore } from '@/stores/useUIStore';
import { useCallback } from 'react';

/**
 * Hook to wrap an async function with UI loading state.
 * @param key Unique loading key (e.g., 'saveButton')
 * @param asyncFn Async function to execute
 * @returns Wrapped function that sets loading flag before/after execution
 */
export function useLoading(key: string, asyncFn: () => Promise<any>) {
    const { setLoading, isLoading } = useUIStore();
    const wrapped = useCallback(async () => {
        try {
            setLoading(key, true);
            await asyncFn();
        } finally {
            setLoading(key, false);
        }
    }, [key, asyncFn, setLoading]);

    return { wrapped, isLoading: isLoading(key) };
}
