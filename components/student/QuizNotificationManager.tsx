'use client';

import { useEffect, useRef } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, doc, getDoc, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { useUserStore } from '@/stores/useUserStore';
import { differenceInHours, differenceInMinutes, isAfter } from 'date-fns';
import { toast } from 'sonner';

// Helper to check if we already notified this user about this quiz for this specific type of alert
// To avoid spamming, we could store "lastNotified" in localStorage or just rely on memoization if session persists.
// For robustness across reloads, we should check Firestore or localStorage.
// Let's use localStorage for client-side ephemeral checks to avoid DB spam.
const hasNotified = (quizId: string, type: '3day' | '24h' | '1h' | 'live') => {
    if (typeof window === 'undefined') return false;
    const key = `notified_${quizId}_${type}`;
    return localStorage.getItem(key) === 'true';
};

const markNotified = (quizId: string, type: '3day' | '24h' | '1h' | 'live') => {
    if (typeof window === 'undefined') return;
    const key = `notified_${quizId}_${type}`;
    localStorage.setItem(key, 'true');
};

export function QuizNotificationManager() {
    const { user } = useUserStore();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!user) return;

        const checkQuizzes = async () => {
            try {
                // 1. Get Enrolled Series
                // Optimization: Store this in a store or context to avoid refetching constantly.
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();
                const seriesIds: string[] = userData?.enrolledSeries || [];

                if (seriesIds.length === 0) return;

                // 2. Fetch Upcoming Quizzes (Published)
                // Filter by date > now ideally.
                const quizzesRef = collection(db, 'quizzes');
                const q = query(quizzesRef, where('published', '==', true));
                const snapshot = await getDocs(q);

                const now = new Date();

                for (const doc of snapshot.docs) {
                    const quiz = doc.data();
                    const quizId = doc.id;

                    // Filter by Series
                    if (!quiz.series || !quiz.series.some((s: string) => seriesIds.includes(s))) continue;

                    const startDate = new Date(quiz.startDate);
                    if (!isAfter(startDate, now)) {
                        // Check if live
                        // If started within last (duration) minutes
                        // ... logic for live notif
                        continue;
                    }

                    const hoursDiff = differenceInHours(startDate, now);
                    const minutesDiff = differenceInMinutes(startDate, now);

                    // 3 Days Reminder (Between 71 and 73 hours to capture it once)
                    if (hoursDiff >= 71 && hoursDiff <= 73 && !hasNotified(quizId, '3day')) {
                        await sendLocalNotification(user.uid, `Upcoming Quiz: ${quiz.title}`, `Get ready! Your quiz on ${quiz.subject} is in 3 days.`);
                        markNotified(quizId, '3day');
                    }

                    // 24 Hours Reminder
                    if (hoursDiff >= 23 && hoursDiff <= 25 && !hasNotified(quizId, '24h')) {
                        await sendLocalNotification(user.uid, `Quiz Tomorrow: ${quiz.title}`, `Don't forget to revise! ${quiz.chapter ? '- ' + quiz.chapter : ''}`);
                        markNotified(quizId, '24h');
                    }

                    // 1 Hour Reminder
                    if (minutesDiff >= 55 && minutesDiff <= 65 && !hasNotified(quizId, '1h')) {
                        await sendLocalNotification(user.uid, `Starting Soon: ${quiz.title}`, `Your quiz starts in 1 hour.`, 'warning');
                        markNotified(quizId, '1h');
                    }

                    // Live (If slightly past start date but within small window) or exact match
                    // Since loop runs periodically, we might miss exact second.
                    // Client side live check usually matches "now >= startDate"
                }

            } catch (error) {
                console.error("Notification check failed", error);
            }
        };

        // Run immediately
        checkQuizzes();

        // Run every 5 minutes
        intervalRef.current = setInterval(checkQuizzes, 5 * 60 * 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user]);

    const sendLocalNotification = async (userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        // 1. Show Toast
        toast(title, { description: message });

        // 2. Persist to Firestore Notifications
        try {
            await addDoc(collection(db, 'users', userId, 'notifications'), {
                title,
                message,
                type,
                read: false,
                createdAt: serverTimestamp(),
                link: '/dashboard/student/schedule'
            });
        } catch (e) {
            console.error("Failed to save notification", e);
        }
    };

    return null; // Headless component
}
