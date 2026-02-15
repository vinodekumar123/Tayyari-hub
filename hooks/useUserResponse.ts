'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from '@/app/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { toast } from 'sonner';

export interface DetailedResponse {
    questionId: string;
    questionText: string;
    selected: string | null;
    correct: string | null;
    isCorrect: boolean;
    explanation?: string | null;
    options: string[];
    chapter?: string | null;
    subject?: string | null;
    difficulty?: string | null;
}

export interface QuizAttempt {
    answers: Record<string, string>;
    flags: Record<string, boolean>;
    completed: boolean;
    attemptNumber: number;
    detailed: DetailedResponse[];
    score: number;
    total: number;
    submittedAt?: any;
    startedAt?: any;
    quizType?: string;
    timeTaken?: number;
}

export interface UserQuizDoc {
    name?: string;
    title?: string;
    subject?: string;
    subjects?: string[];
    chapters?: string[];
    duration?: number;
}

export function useUserResponse() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get('id') as string;
    const studentIdParam = searchParams.get('studentId') as string;

    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [profileLoaded, setProfileLoaded] = useState(false);

    const [quiz, setQuiz] = useState<UserQuizDoc | null>(null);
    const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
    const [studentProfile, setStudentProfile] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                setProfileLoaded(true);
                router.push('/login');
                return;
            }
            try {
                const userSnap = await getDoc(doc(db, 'users', u.uid));
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setIsAdmin(data.admin === true || data.superadmin === true);
                }
            } catch (e) {
                console.error("Profile load error", e);
            } finally {
                setProfileLoaded(true);
            }
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!quizId || !user || !profileLoaded) return;

        const load = async () => {
            setError(null);
            try {
                const targetStudentId = studentIdParam || user.uid;

                if (studentIdParam && studentIdParam !== user.uid && !isAdmin) {
                    setError('You do not have permission to view this result.');
                    setLoading(false);
                    return;
                }

                if (isAdmin && targetStudentId !== user.uid) {
                    try {
                        const studentSnap = await getDoc(doc(db, 'users', targetStudentId));
                        if (studentSnap.exists()) {
                            setStudentProfile(studentSnap.data());
                        }
                    } catch (e) {
                        console.error("Failed to load student profile", e);
                    }
                }

                const attemptSnap = await getDoc(doc(db, 'users', targetStudentId, 'user-quizattempts', quizId));
                if (!attemptSnap.exists()) {
                    setError('Attempt not found.');
                    setLoading(false);
                    return;
                }

                const attemptData = attemptSnap.data() as QuizAttempt;
                setAttempt(attemptData);

                const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
                if (quizSnap.exists()) {
                    setQuiz(quizSnap.data() as UserQuizDoc);
                } else {
                    setQuiz({
                        name: attemptData.quizType || 'Quiz Results',
                        subjects: attemptData.detailed
                            .map((q) => q.subject)
                            .filter((v, i, arr) => !!v && arr.indexOf(v) === i) as string[]
                    });
                }

                setLoading(false);
            } catch (err: any) {
                setError('Error loading quiz result: ' + (err?.message || String(err)));
                setLoading(false);
            }
        };
        load();
    }, [quizId, user, isAdmin, studentIdParam, router, profileLoaded]);

    const stats = useMemo(() => {
        if (!attempt) return null;

        const score = attempt.score;
        const total = attempt.total || 0;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

        let correct = 0, wrong = 0, skipped = 0;
        const subStats: Record<string, { subject: string; correct: number; wrong: number; skipped: number; total: number; percentage: number }> = {};

        attempt.detailed.forEach(q => {
            let subject = q.subject || 'General';
            if ((subject === 'Uncategorized' || subject === 'General') && quiz?.subjects?.length === 1) {
                subject = quiz.subjects[0];
            }

            if (!subStats[subject]) subStats[subject] = { subject, correct: 0, wrong: 0, skipped: 0, total: 0, percentage: 0 };
            subStats[subject].total++;

            if (!q.selected) {
                skipped++;
                subStats[subject].skipped++;
            } else if (q.isCorrect) {
                correct++;
                subStats[subject].correct++;
            } else {
                wrong++;
                subStats[subject].wrong++;
            }
        });

        Object.values(subStats).forEach(s => {
            s.percentage = s.total > 0 ? (s.correct / s.total) * 100 : 0;
        });

        const timeTaken = attempt.timeTaken || (attempt.submittedAt && attempt.startedAt ? (attempt.submittedAt.seconds - attempt.startedAt.seconds) : 0);

        return {
            score,
            total,
            percentage,
            correct,
            wrong,
            skipped,
            timeTaken,
            subjectAnalysis: Object.values(subStats).sort((a, b) => b.percentage - a.percentage)
        };
    }, [attempt, quiz]);

    const handleSaveToFlashcards = async (question: DetailedResponse) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid, 'flashcards', question.questionId), {
                id: question.questionId,
                questionText: question.questionText,
                options: question.options || [],
                correctAnswer: question.correct || '',
                explanation: question.explanation || '',
                subject: question.subject || 'General',
                savedAt: serverTimestamp(),
                isDeleted: false
            });
            setSavedQuestions(prev => new Set(prev).add(question.questionId));
            toast.success("Saved to Flashcards");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save flashcard");
        }
    };

    return {
        user,
        loading,
        error,
        quiz,
        attempt,
        studentProfile,
        stats,
        isAdmin,
        studentIdParam,
        savedQuestions,
        handleSaveToFlashcards
    };
}
