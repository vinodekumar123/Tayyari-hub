'use client';

import { useEffect } from 'react';
import { monitorFirestoreError } from '@/lib/firestore-monitor';

export function IndexMonitorProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // 1. Listen for unhandled promise rejections (often where Firestore errors end up if not caught)
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            monitorFirestoreError(event.reason, 'Unhandled Rejection');
        };

        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        // 2. Intercept console.error to catch errors that are logged but not thrown
        // This is risky but necessary if the app swallows errors in try/catch blocks
        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            // Check args for index error patterns
            args.forEach(arg => {
                if (typeof arg === 'object' && arg !== null) {
                    monitorFirestoreError(arg, 'Console Error Log');
                } else if (typeof arg === 'string') {
                    if (arg.includes('The query requires an index') || arg.includes('failed-precondition')) {
                        monitorFirestoreError({ message: arg }, 'Console Error Log');
                    }
                }
            });

            // Always call original
            originalConsoleError.apply(console, args);
        };

        return () => {
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
            console.error = originalConsoleError;
        };
    }, []);

    return <>{children}</>;
}
