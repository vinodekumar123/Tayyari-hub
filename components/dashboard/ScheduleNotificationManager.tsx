'use client';

import { useEffect } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export function ScheduleNotificationManager() {
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) return;

            try {
                // 1. Fetch all upcoming or live quizzes
                // Optimization: In a real app with thousands of quizzes, we'd need better filtering (e.g. by enrolled course).
                // For now, we fetch quizzes that are either live or starting soon.
                // We'll fetch all quizzes and filter in memory for simplicity to ensure we catch everything, 
                // assuming reasonable dataset size for now.
                const quizzesSnap = await getDocs(collection(db, 'quizzes'));
                const now = new Date();
                const ONE_HOUR = 60 * 60 * 1000;
                const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

                const notifications = [];

                for (const qDoc of quizzesSnap.docs) {
                    const quiz = qDoc.data();
                    if (!quiz.startDate) continue;

                    const start = new Date(`${quiz.startDate}T${quiz.startTime || '00:00'}`);
                    const end = new Date(`${quiz.endDate}T${quiz.endTime || '23:59'}`);
                    const diff = start.getTime() - now.getTime();

                    // Live Notification
                    if (now >= start && now <= end) {
                        notifications.push({
                            id: `quiz_${qDoc.id}_live`,
                            title: `🔴 Live Now: ${quiz.title}`,
                            message: `The test "${quiz.title}" is currently live. Click to start!`,
                            type: 'warning',
                            link: `/quiz/start?id=${qDoc.id}`
                        });
                    }
                    // 1 Hour Warning (between 0 and 60 mins)
                    else if (diff > 0 && diff <= ONE_HOUR) {
                        notifications.push({
                            id: `quiz_${qDoc.id}_1h`,
                            title: `⏰ Starting Soon: ${quiz.title}`,
                            message: `The test "${quiz.title}" starts in less than 1 hour. Get ready!`,
                            type: 'info',
                            link: `/quiz/intro?id=${qDoc.id}`
                        });
                    }
                    // 24 Hour Warning (between 1h and 24h)
                    else if (diff > ONE_HOUR && diff <= TWENTY_FOUR_HOURS) {
                        notifications.push({
                            id: `quiz_${qDoc.id}_24h`,
                            title: `📅 Tomorrow: ${quiz.title}`,
                            message: `Reminder: The test "${quiz.title}" is scheduled for tomorrow at ${quiz.startTime || '00:00'}.`,
                            type: 'info',
                            link: `/dashboard/student`
                        });
                    }
                }

                // 2. batch write notifications if they don't exist
                // check existence one by one to avoid overwriting 'read' status if it exists
                // or just setDoc with merge: true but carefully.
                // Actually, if we setDoc every time, it might reset 'read' status if we are not careful.
                // We only want to create IF NOT EXISTS.

                for (const notif of notifications) {
                    const notifRef = doc(db, 'users', user.uid, 'notifications', notif.id);
                    const notifSnap = await getDoc(notifRef);

                    if (!notifSnap.exists()) {
                        await setDoc(notifRef, {
                            ...notif,
                            read: false,
                            createdAt: serverTimestamp()
                        });
                    }
                }

            } catch (err) {
                console.error("Error managing schedule notifications:", err);
            }
        });

        return () => unsub();
    }, []);

    return null; // Headless component
}
