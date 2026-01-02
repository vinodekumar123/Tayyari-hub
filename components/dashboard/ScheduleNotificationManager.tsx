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
                // 1. Fetch User Profile to get Course/Enrolled Series
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) return;
                const userData = userDoc.data();
                const userCourseId = userData.course; // Assuming course ID is stored here

                // 2. Fetch quizzes strictly for this course to avoid leaks
                // We fetch all "published" quizzes and filter in memory for complex matchers (string vs object course)
                // In production, ensure 'course' is standardized to ID string for 'where' queries.
                const quizzesRef = collection(db, 'quizzes');
                const quizzesSnap = await getDocs(quizzesRef);

                const now = new Date();
                const ONE_HOUR = 60 * 60 * 1000;
                const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

                const notifications = [];

                for (const qDoc of quizzesSnap.docs) {
                    const quiz = qDoc.data();

                    // FILTER: Check if quiz belongs to user's course
                    const quizCourseId = typeof quiz.course === 'object' ? quiz.course.id : quiz.course;

                    // Strict filtering: Only show if course matches OR if it's a "General" quiz (optional logic)
                    if (quizCourseId !== userCourseId) continue;

                    if (!quiz.startDate) continue;

                    let start: Date, end: Date;
                    try {
                        start = new Date(`${quiz.startDate}T${quiz.startTime || '00:00:00'}`);
                        end = new Date(`${quiz.endDate}T${quiz.endTime || '23:59:59'}`);
                    } catch (e) {
                        console.warn(`Invalid date for quiz ${qDoc.id}`, e);
                        continue;
                    }

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

                // 3. batch write notifications if they don't exist
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
