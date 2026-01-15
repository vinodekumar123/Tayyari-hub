'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { User } from 'firebase/auth';

// --- Types ---
export interface AutoSaveState {
    status: 'idle' | 'saving' | 'saved' | 'error';
    lastSavedAt: Date | null;
    error: string | null;
}

export interface QuizProgress {
    answers: Record<string, string>;
    flags: Record<string, boolean>;
    currentIndex: number;
    remainingTime: number;
}

interface UseAutoSaveOptions {
    user: User | null;
    quizId: string;
    isAdmin: boolean;
    debounceMs?: number;
    timerSyncIntervalMs?: number;
}

// --- Hook ---
export function useAutoSave({
    user,
    quizId,
    isAdmin,
    debounceMs = 500,
    timerSyncIntervalMs = 30000,
}: UseAutoSaveOptions) {
    const [saveState, setSaveState] = useState<AutoSaveState>({
        status: 'idle',
        lastSavedAt: null,
        error: null,
    });

    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastProgressRef = useRef<QuizProgress | null>(null);
    const pendingSaveRef = useRef<boolean>(false);
    const retryCountRef = useRef<number>(0);
    const maxRetries = 3;

    // Core Firestore save function
    const saveToFirestore = useCallback(
        async (progress: Partial<QuizProgress>, isTimerSync = false): Promise<boolean> => {
            // Skip for admins or if no user/quiz
            if (!user || !quizId || isAdmin) return true;

            // Only show UI indicator for user-triggered saves
            if (!isTimerSync) {
                setSaveState((prev) => ({ ...prev, status: 'saving', error: null }));
            }

            try {
                // Sanitize data (remove undefined, preserve Firestore sentinels)
                let cleanProgress = { ...progress };
                try {
                    cleanProgress = JSON.parse(JSON.stringify(progress));
                } catch {
                    // Fallback to shallow clone
                }

                const payload = {
                    ...cleanProgress,
                    updatedAt: serverTimestamp(),
                };

                await setDoc(
                    doc(db, 'users', user.uid, 'quizAttempts', quizId),
                    payload,
                    { merge: true }
                );

                // Update UI only for user-triggered saves
                if (!isTimerSync) {
                    setSaveState({
                        status: 'saved',
                        lastSavedAt: new Date(),
                        error: null,
                    });

                    // Reset to idle after 3 seconds
                    setTimeout(() => {
                        setSaveState((prev) =>
                            prev.status === 'saved' ? { ...prev, status: 'idle' } : prev
                        );
                    }, 3000);
                }

                retryCountRef.current = 0;
                pendingSaveRef.current = false;
                return true;
            } catch (error: any) {
                console.error('Auto-save failed:', error);

                // Retry with exponential backoff
                if (retryCountRef.current < maxRetries) {
                    retryCountRef.current++;
                    await new Promise((resolve) =>
                        setTimeout(resolve, Math.pow(2, retryCountRef.current) * 500)
                    );
                    return saveToFirestore(progress, isTimerSync);
                }

                // Show error only for user-triggered saves
                if (!isTimerSync) {
                    setSaveState({
                        status: 'error',
                        lastSavedAt: saveState.lastSavedAt,
                        error: error.message || 'Failed to save progress',
                    });
                }

                pendingSaveRef.current = true;
                return false;
            }
        },
        [user, quizId, isAdmin, saveState.lastSavedAt]
    );

    // Debounced save for answers/flags
    const debouncedSave = useCallback(
        (progress: QuizProgress) => {
            lastProgressRef.current = progress;

            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }

            debounceRef.current = setTimeout(() => {
                saveToFirestore({
                    answers: progress.answers,
                    flags: progress.flags,
                    currentIndex: progress.currentIndex,
                    remainingTime: progress.remainingTime,
                });
            }, debounceMs);
        },
        [saveToFirestore, debounceMs]
    );

    // Immediate save for critical operations (submit, page close)
    const saveImmediately = useCallback(
        async (progress: QuizProgress): Promise<boolean> => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            return saveToFirestore({
                answers: progress.answers,
                flags: progress.flags,
                currentIndex: progress.currentIndex,
                remainingTime: progress.remainingTime,
            });
        },
        [saveToFirestore]
    );

    // Timer sync - save remaining time periodically
    const startTimerSync = useCallback(
        (getProgress: () => QuizProgress) => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }

            timerIntervalRef.current = setInterval(() => {
                const progress = getProgress();
                saveToFirestore({ remainingTime: progress.remainingTime }, true);
            }, timerSyncIntervalMs);
        },
        [saveToFirestore, timerSyncIntervalMs]
    );

    const stopTimerSync = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    }, []);

    // Retry failed save
    const retrySave = useCallback(() => {
        if (lastProgressRef.current) {
            retryCountRef.current = 0;
            saveToFirestore(lastProgressRef.current);
        }
    }, [saveToFirestore]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, []);

    return {
        saveState,
        debouncedSave,
        saveImmediately,
        startTimerSync,
        stopTimerSync,
        retrySave,
        hasPendingSave: pendingSaveRef.current,
    };
}
