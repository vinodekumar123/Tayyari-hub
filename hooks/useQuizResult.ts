'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/app/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';

export interface Question {
    id: string;
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    subject?: string;
    graceMark?: boolean;
}

export interface QuizData {
    title: string;
    subject?: string;
    resultVisibility: string;
    selectedQuestions: Question[];
}

export interface SubjectStats {
    subject: string;
    total: number;
    correct: number;
    wrong: number;
    skipped: number;
    percentage: number;
}

export function useQuizResult() {
    const searchParams = useSearchParams();
    const quizId = searchParams.get('id');
    const isMock = searchParams.get('mock') === 'true';
    const studentId = searchParams.get('studentId');

    const [user, setUser] = useState<User | null>(null);
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [score, setScore] = useState(0);
    const [accessDenied, setAccessDenied] = useState(false);
    const [wrongAnswers, setWrongAnswers] = useState(0);
    const [skippedQuestions, setSkippedQuestions] = useState(0);
    const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, u => setUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!quizId || !user || !studentId) return;

        const load = async () => {
            setLoading(true);
            try {
                const quizDocRef = isMock
                    ? doc(db, 'users', studentId, 'mock-quizzes', quizId)
                    : doc(db, 'quizzes', quizId);

                const resultDocRef = doc(
                    db,
                    'users',
                    studentId,
                    isMock ? 'mock-quizAttempts' : 'quizAttempts',
                    quizId,
                    'results',
                    quizId // In some legacy structures ID might be repeated or different, assuming based on analysis
                );

                const [quizSnap, resultSnap] = await Promise.all([
                    getDoc(quizDocRef),
                    getDoc(resultDocRef)
                ]);

                if (!quizSnap.exists() || !resultSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const quizData = quizSnap.data();
                const attemptData = resultSnap.data();

                // Visibility Check
                if (quizData.resultVisibility !== 'immediate') {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const userData = userDoc.exists() ? userDoc.data() : null;
                    const isAdmin = userData?.admin === true || userData?.role === 'admin'; // Robust check

                    if (!isAdmin) {
                        setAccessDenied(true);
                        setLoading(false);
                        return;
                    }
                }

                const questions: Question[] = quizData.selectedQuestions || [];
                const answers: Record<string, string> = attemptData.answers || {};

                setQuiz({
                    title: quizData.title || 'Untitled Quiz',
                    subject: quizData.subject || 'N/A',
                    resultVisibility: quizData.resultVisibility,
                    selectedQuestions: questions
                });

                setUserAnswers(answers);

                // Calculations
                let correct = 0;
                let wrong = 0;
                let skipped = 0;
                const subjectStatsMap: Record<string, SubjectStats> = {};

                questions.forEach(q => {
                    const userAnswer = answers[q.id];
                    const subject = q.subject || 'General';

                    if (!subjectStatsMap[subject]) {
                        subjectStatsMap[subject] = { subject, total: 0, correct: 0, wrong: 0, skipped: 0, percentage: 0 };
                    }
                    const stats = subjectStatsMap[subject];
                    stats.total++;

                    if (q.graceMark) {
                        correct++;
                        stats.correct++;
                    } else if (!userAnswer || userAnswer === '') {
                        skipped++;
                        stats.skipped++;
                    } else if (userAnswer === q.correctAnswer) {
                        correct++;
                        stats.correct++;
                    } else {
                        wrong++;
                        stats.wrong++;
                    }

                    stats.percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
                });

                setScore(correct);
                setWrongAnswers(wrong);
                setSkippedQuestions(skipped);
                setSubjectStats(Object.values(subjectStatsMap));

                if (questions.length > 0 && correct / questions.length >= 0.7) {
                    setShowConfetti(true);
                    setTimeout(() => setShowConfetti(false), 6000); // Hide after 6s
                }

            } catch (error) {
                console.error("Error loading result", error);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [quizId, user, isMock, studentId]);

    return {
        user,
        quiz,
        userAnswers,
        score,
        wrongAnswers,
        skippedQuestions,
        subjectStats,
        accessDenied,
        loading,
        showConfetti,
        studentId,
        quizId,
        isMock
    };
}
