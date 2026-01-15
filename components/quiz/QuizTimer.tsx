'use client';

import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import { Clock } from 'lucide-react';

interface QuizTimerProps {
    initialTime: number;
    onTimeUp: () => void;
    timeRef: React.MutableRefObject<number>;
    isAdmin: boolean;
    isPaused?: boolean;
}

// Format seconds to MM:SS or HH:MM:SS
const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Get timer color based on remaining time
const getTimerColor = (seconds: number): string => {
    if (seconds <= 60) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (seconds <= 300) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
    return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
};

export const QuizTimer = memo(function QuizTimer({
    initialTime,
    onTimeUp,
    timeRef,
    isAdmin,
    isPaused = false,
}: QuizTimerProps) {
    const [displayTime, setDisplayTime] = useState(initialTime);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const onTimeUpRef = useRef(onTimeUp);

    // Keep callback ref updated
    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    // Initialize display time from ref
    useEffect(() => {
        if (timeRef.current > 0) {
            setDisplayTime(timeRef.current);
        } else if (initialTime > 0) {
            setDisplayTime(initialTime);
            timeRef.current = initialTime;
        }
    }, [initialTime, timeRef]);

    // Main countdown effect
    useEffect(() => {
        // Skip timer for admins
        if (isAdmin) return;

        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        // Don't start if paused or no time
        if (isPaused || displayTime <= 0) return;

        intervalRef.current = setInterval(() => {
            setDisplayTime((prev) => {
                const newTime = prev - 1;
                timeRef.current = newTime;

                if (newTime <= 0) {
                    clearInterval(intervalRef.current!);
                    onTimeUpRef.current();
                    return 0;
                }

                return newTime;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isAdmin, isPaused, timeRef, displayTime]);

    // Admin mode: no timer display
    if (isAdmin) {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                <Clock className="w-4 h-4" />
                <span className="font-medium text-sm">No Timer</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono font-bold border transition-colors ${getTimerColor(displayTime)}`}
        >
            <Clock className={`w-4 h-4 ${displayTime <= 60 ? 'animate-pulse' : ''}`} />
            <span className="text-sm">{formatTime(displayTime)}</span>
        </div>
    );
});
