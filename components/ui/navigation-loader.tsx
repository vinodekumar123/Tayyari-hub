'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/stores/useUIStore';

export function NavigationLoader() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isLoading, setLoading } = useUIStore();
    const [progress, setProgress] = useState(0);

    const isNavigating = isLoading('navigation');

    useEffect(() => {
        // Stop loading when path changes
        setLoading('navigation', false);
        setProgress(100);
        const t = setTimeout(() => setProgress(0), 500);
        return () => clearTimeout(t);
    }, [pathname, searchParams, setLoading]);

    useEffect(() => {
        if (isNavigating) {
            setProgress(30);
            const timer = setInterval(() => {
                setProgress((old) => {
                    if (old >= 90) return 90;
                    return old + Math.random() * 10;
                });
            }, 500);
            return () => clearInterval(timer);
        } else if (progress === 0 && !isNavigating) {
            // ensure progress resets if not navigating
            setProgress(0);
        }
    }, [isNavigating, progress]);

    // Simple top loader bar only (overlay handled by app/loading.tsx or global overlay component)
    if (!isNavigating && progress === 0) return null;

    return (
        <div className="fixed top-0 left-0 w-full h-1 z-[9999]" style={{ opacity: progress === 100 ? 0 : 1, transition: 'opacity 0.5s' }}>
            <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
