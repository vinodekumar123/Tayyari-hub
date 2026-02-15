'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export interface UserCreatedQuiz {
    id: string;
    name: string;
    subject: string;
    chapters: string[];
    createdBy: string;
    duration: number;
    questionCount: number;
    createdAt: any;
}

export interface QuizAttemptStatus {
    startedAt?: any;
    completed?: boolean;
}

export function useUserQuizzes() {
    const [user, setUser] = useState<User | null>(null);
    const [quizzes, setQuizzes] = useState<UserCreatedQuiz[]>([]);
    const [attempts, setAttempts] = useState<Record<string, QuizAttemptStatus>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                setLoading(false);
                return;
            }

            try {
                // 1. Fetch User's Created Quizzes
                const quizQuery = query(
                    collection(db, 'user-quizzes'),
                    where('createdBy', '==', u.uid)
                );

                // 2. Fetch User's All Attempts (Optimized: Single batch fetch instead of N+1)
                // We assume fetching all attempts for a user is performant enough.
                // If this grows too large, we might need to paginate or filter by specific IDs in batches.
                const attemptsRef = collection(db, 'users', u.uid, 'user-quizattempts');

                const [quizSnap, attemptsSnap] = await Promise.all([
                    getDocs(quizQuery),
                    getDocs(attemptsRef) // Fetching all attempts to avoid N+1 lookups
                ]);

                // Process Quizzes
                const list: UserCreatedQuiz[] = quizSnap.docs.map(doc => {
                    const d = doc.data();
                    return {
                        id: doc.id,
                        name: d.title || d.name || 'Untitled Quiz',
                        subject: d.subject,
                        chapters: d.chapters || [],
                        createdBy: d.createdBy,
                        duration: d.duration,
                        questionCount: d.questionCount,
                        createdAt: d.createdAt,
                    };
                });

                // Sort by CreatedAt Descending
                list.sort((a, b) => {
                    const dateA = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
                    const dateB = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
                    return dateB - dateA;
                });

                setQuizzes(list);

                // Process Attempts Map
                const attemptMap: Record<string, QuizAttemptStatus> = {};
                attemptsSnap.forEach(doc => {
                    // key is quizId (doc.id)
                    attemptMap[doc.id] = doc.data();
                });

                setAttempts(attemptMap);

            } catch (e) {
                console.error('Error loading user quizzes:', e);
            } finally {
                setLoading(false);
            }
        });

        return () => unsub();
    }, []);

    // Derived Stats
    const stats = {
        total: quizzes.length,
        completed: Object.values(attempts).filter(a => a.completed).length,
        inProgress: Object.values(attempts).filter(a => a.startedAt && !a.completed).length
    };

    return {
        user,
        loading,
        quizzes,
        attempts,
        stats
    };
}
