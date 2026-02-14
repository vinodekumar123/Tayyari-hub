'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from '@/app/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, XCircle, Info, BarChart3, Clock, Award, TrendingUp, ArrowLeft, Sparkles, Bookmark, Flag, Target, Circle, Lock, User as UserIcon, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from '@/components/ui/badge';

interface DetailedResponse {
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

interface QuizAttempt {
    answers: Record<string, string>;
    flags: Record<string, boolean>;
    completed: boolean;
    attemptNumber: number;
    detailed: DetailedResponse[];
    score: number;
    total: number;
    submittedAt?: any;
    startedAt?: any; // Added for Time Spent Fallback
    quizType?: string;
    timeTaken?: number;
}

interface UserQuizDoc {
    name?: string;
    title?: string;
    subject?: string; // legacy
    subjects?: string[]; // multi-subject
    chapters?: string[];
    duration?: number;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const TABS = [
    { key: 'all', label: 'All Questions', icon: BookOpen },
    { key: 'correct', label: 'Correct', icon: CheckCircle },
    { key: 'wrong', label: 'Wrong', icon: XCircle },
    { key: 'skipped', label: 'Skipped', icon: Info },
];

const UserResponsesPageContent: React.FC = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get('id') as string;
    const studentIdParam = searchParams.get('studentId') as string;

    const [user, setUser] = useState<User | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [profileLoaded, setProfileLoaded] = useState(false); // New state to prevent race conditions
    const [quiz, setQuiz] = useState<UserQuizDoc | null>(null);
    const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
    const [studentProfile, setStudentProfile] = useState<any>(null); // New State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'wrong' | 'skipped'>('overview');
    const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());

    // Report states
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportIssue, setReportIssue] = useState('');
    const [selectedQuestionForReport, setSelectedQuestionForReport] = useState<DetailedResponse | null>(null);
    const [isReporting, setIsReporting] = useState(false);
    const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

    const { width, height } = useWindowSize();
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                setProfileLoaded(true); // Profile loading "done" (failed/none)
                router.push('/login');
                return;
            }

            // Check if admin
            try {
                const userSnap = await getDoc(doc(db, 'users', u.uid));
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setIsAdmin(data.admin === true || data.superadmin === true);
                }
            } catch (e) {
                console.error("Profile load error", e);
            } finally {
                setProfileLoaded(true); // Mark profile as loaded regardless of result
            }
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!quizId || !user) return;
        if (!profileLoaded) return; // Wait for admin check to complete

        const load = async () => {
            setError(null); // Clear previous errors
            try {
                // Determine whose results we are viewing
                const targetStudentId = studentIdParam || user.uid;

                if (studentIdParam && studentIdParam !== user.uid && !isAdmin) {
                    setError('You do not have permission to view this result.');
                    setLoading(false);
                    return;
                }

                // If Admin viewing another student, fetch their profile
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

                // ... rest of load logic ...
                const attemptSnap = await getDoc(doc(db, 'users', targetStudentId, 'user-quizattempts', quizId));
                if (!attemptSnap.exists()) {
                    setError('Attempt not found.');
                    setLoading(false);
                    return;
                }

                const attemptData = attemptSnap.data() as QuizAttempt;
                setAttempt(attemptData);

                // Load quiz meta from user-quizzes collection
                const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
                let quizTitle = 'Quiz Results';
                if (quizSnap.exists()) {
                    const quizData = quizSnap.data() as UserQuizDoc;
                    setQuiz(quizData);
                    quizTitle = quizData.title || quizData.name || 'Quiz Results';
                } else {
                    setQuiz({
                        name: attemptData.quizType || 'Quiz Results',
                        title: attemptData.quizType || 'Quiz Results',
                        subjects: attemptData.detailed
                            .map((q) => q.subject)
                            .filter((v, i, arr) => !!v && arr.indexOf(v) === i) as string[]
                    });
                }

                // Confetti trigger
                const score = attemptData.score;
                const total = attemptData.total || 1;
                const percentage = Math.round((score / total) * 100);
                if (percentage >= 80) setShowConfetti(true);

                setLoading(false);
            } catch (err: any) {
                setError('Error loading quiz result: ' + (err?.message || String(err)));
                setLoading(false);
            }
        };
        load();
    }, [quizId, user, isAdmin, studentIdParam, router, profileLoaded]);

    const handleSaveToFlashcards = async (question: DetailedResponse, cardIndex: number) => {
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
            setSavedQuestions((prev) => {
                const newSet = new Set(prev);
                newSet.add(question.questionId);
                return newSet;
            });
            toast.success("Saved to Flashcards");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save flashcard");
        }
    };

    if (error) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
            <div className="text-red-600 dark:text-red-400 text-center py-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg rounded-2xl px-8 border border-red-200 dark:border-red-900 shadow-xl">{error}</div>
        </div>
    );

    const handleReportSubmit = async () => {
        if (!reportIssue.trim() || !selectedQuestionForReport || !user) return;
        setIsReporting(true);

        try {
            await addDoc(collection(db, 'reported_questions'), {
                questionId: selectedQuestionForReport.questionId,
                questionText: selectedQuestionForReport.questionText,
                options: selectedQuestionForReport.options || [],
                correctAnswer: selectedQuestionForReport.correct || '',
                subject: selectedQuestionForReport.subject || 'General',
                studentId: user.uid,
                studentName: user.displayName || user.email || 'Student',
                issue: reportIssue,
                status: 'pending',
                createdAt: serverTimestamp(),
                quizId: quizId,
                source: 'mock_question'
            });

            toast.success("Report submitted successfully.");
            setReportModalOpen(false);
            setReportIssue('');
        } catch (e) {
            console.error("Error submitting report:", e);
            toast.error("Failed to submit report. Please try again.");
        } finally {
            setIsReporting(false);
        }
    };

    const openReportModal = (question: DetailedResponse) => {
        setSelectedQuestionForReport(question);
        setReportModalOpen(true);
    };

    if (error) return (
        <div className="min-h-screen bg-background dark:bg-[#020817] flex items-center justify-center p-4">
            <div className="text-red-500 text-center py-10 bg-card rounded-2xl px-8 border border-destructive/20 shadow-xl max-w-md">
                <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold mb-2">Error Loading Results</h3>
                <p className="text-muted-foreground">{error}</p>
                <Button variant="outline" className="mt-6" onClick={() => router.back()}>Go Back</Button>
            </div>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen bg-background dark:bg-[#020817] flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground text-lg font-medium">Crunching your performance data...</p>
            </div>
        </div>
    );

    if (!attempt || !quiz) return (
        <div className="min-h-screen bg-background dark:bg-[#020817] flex items-center justify-center">
            <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No results found for this attempt.</p>
            </div>
        </div>
    );

    const score = attempt.score;
    const totalQuestions = attempt.total || 0;
    const percentage = Math.round((score / (totalQuestions || 1)) * 100);

    let correctAnswers = 0, wrongAnswers = 0, skippedQuestions = 0;
    const groupedBySubject: Record<string, DetailedResponse[]> = {};
    const subStats: Record<string, { subject: string; correct: number; wrong: number; skipped: number; total: number; percentage: number }> = {};

    attempt.detailed.forEach((q) => {
        let subject = q.subject || 'General';
        // Fallback: If subject is Uncategorized/General but quiz has only 1 subject defined, use that.
        if ((subject === 'Uncategorized' || subject === 'General') && quiz?.subjects?.length === 1) {
            subject = quiz.subjects[0];
        }
        if (!groupedBySubject[subject]) groupedBySubject[subject] = [];
        groupedBySubject[subject].push(q);

        if (!subStats[subject]) subStats[subject] = { subject, correct: 0, wrong: 0, skipped: 0, total: 0, percentage: 0 };
        subStats[subject].total++;

        if (!q.selected || q.selected === '') {
            skippedQuestions++;
            subStats[subject].skipped++;
        } else if (q.isCorrect) {
            correctAnswers++;
            subStats[subject].correct++;
        } else {
            wrongAnswers++;
            subStats[subject].wrong++;
        }
    });

    // Finalize subject percentages
    Object.values(subStats).forEach(s => {
        s.percentage = s.total > 0 ? (s.correct / s.total) * 100 : 0;
    });

    const subjectStatsArray = Object.values(subStats).sort((a, b) => b.percentage - a.percentage);

    const getRemark = (p: number) => {
        if (p >= 90) return { text: 'Outstanding', color: 'bg-emerald-500' };
        if (p >= 75) return { text: 'Excellent', color: 'bg-green-500' };
        if (p >= 60) return { text: 'Good Performance', color: 'bg-blue-500' };
        if (p >= 45) return { text: 'Average', color: 'bg-yellow-500' };
        return { text: 'Needs More Practice', color: 'bg-red-500' };
    };

    const { text: remark, color: remarkColor } = getRemark(percentage);

    const wrongQuestionsList = attempt.detailed.filter(q => q.selected && !q.isCorrect);
    const skippedQuestionsList = attempt.detailed.filter(q => !q.selected || q.selected === '');

    const analyticsData = [
        { name: 'Correct', value: correctAnswers },
        { name: 'Wrong', value: wrongAnswers },
        { name: 'Skipped', value: skippedQuestions },
    ];

    const subjectData = subjectStatsArray.map((stats) => ({
        subject: stats.subject.length > 15 ? stats.subject.substring(0, 12) + '...' : stats.subject,
        accuracy: stats.percentage,
        correct: stats.correct,
        wrong: stats.wrong,
        skipped: stats.skipped,
    }));

    const renderQuestionCard = (q: DetailedResponse, idx: number, showSubject: boolean = false) => {
        const userAnswer = q.selected;
        const isSkipped = !userAnswer || userAnswer === '';

        return (
            <Card key={q.questionId} className="mb-6 shadow-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                <CardHeader className="dir-ltr rounded-t-lg bg-muted/30 border-b border-border/50 pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <CardTitle className="text-base md:text-lg font-semibold text-foreground flex gap-2 items-start leading-relaxed w-full min-w-0">
                            <span className="text-primary font-bold min-w-[2rem] md:min-w-[2.5rem] shrink-0">Q{idx + 1}.</span>
                            <div className="flex-1 min-w-0 overflow-hidden break-words">
                                <div className="break-words overflow-x-auto no-scrollbar question-content" dangerouslySetInnerHTML={{ __html: q.questionText }} />
                            </div>
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2 mt-3 md:mt-0 w-full md:w-auto md:self-auto shrink-0">
                            {isSkipped && (
                                <Badge variant="secondary" className="bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 text-[10px] md:text-xs">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Skipped
                                </Badge>
                            )}
                            {showSubject && q.subject && (
                                <Badge variant="outline" className="text-[10px] md:text-xs">
                                    {q.subject}
                                </Badge>
                            )}
                            <div className="flex items-center gap-2 ml-auto md:ml-0">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 dark:bg-red-900/10 dark:hover:bg-red-900/30 dark:text-red-400 h-8 px-2 text-xs md:text-sm"
                                    onClick={() => openReportModal(q)}
                                    title="Report Mistake"
                                >
                                    <Flag className="w-3.5 h-3.5 mr-1" />
                                    <span className="hidden xs:inline">Report</span>
                                </Button>
                                {savedQuestions.has(q.questionId) ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled
                                        className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 h-8 px-2 text-xs md:text-sm"
                                    >
                                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                        <span className="hidden xs:inline">Saved</span>
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 dark:bg-indigo-900/10 dark:hover:bg-indigo-900/30 dark:text-indigo-400 h-8 px-2 text-xs md:text-sm"
                                        onClick={() => handleSaveToFlashcards(q, idx)}
                                        title="Save to Flashcards"
                                    >
                                        <Bookmark className="w-3.5 h-3.5 mr-1" />
                                        <span className="hidden xs:inline">Save</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid grid-cols-1 gap-3">
                        {q.options.map((opt, i) => {
                            const isSelected = opt === userAnswer;
                            const isAnswer = opt === q.correct;

                            let style = 'border-border bg-card hover:bg-accent/40 text-foreground';
                            let icon = <Circle className="text-muted-foreground w-4 h-4 mr-3" />;

                            if (isAnswer) {
                                style = 'border-green-500/50 bg-green-50/50 dark:bg-green-900/20 text-green-900 dark:text-green-100 shadow-[0_0_0_1px_rgba(34,197,94,0.2)]';
                                icon = <CheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 mr-3" />;
                            } else if (isSelected && !isAnswer) {
                                style = 'border-red-500/50 bg-red-50/50 dark:bg-red-900/20 text-red-900 dark:text-red-100 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]';
                                icon = <XCircle className="text-red-600 dark:text-red-400 w-5 h-5 mr-3" />;
                            }

                            return (
                                <div
                                    key={i}
                                    className={`flex items-start p-3 md:p-4 rounded-xl border text-sm md:text-base font-medium transition-colors duration-200 ${style}`}
                                >
                                    <div className="shrink-0">{icon}</div>
                                    <div className="flex-1 min-w-0 break-words overflow-x-auto no-scrollbar">
                                        <span className="mr-1 inline-block shrink-0">{String.fromCharCode(65 + i)}.</span>
                                        <span className="inline" dangerouslySetInnerHTML={{ __html: opt }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {q.explanation && (
                        <div className="mt-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
                            <Info className="h-5 w-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <div className="leading-relaxed min-w-0 flex-1 break-words overflow-x-auto no-scrollbar">
                                <span className="font-semibold block mb-1">Explanation:</span>
                                <div dangerouslySetInnerHTML={{ __html: q.explanation }} />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    let filteredQuestions = attempt.detailed;
    if (activeTab === 'wrong') {
        filteredQuestions = wrongQuestionsList;
    } else if (activeTab === 'skipped') {
        filteredQuestions = skippedQuestionsList;
    }

    return (
        <div className="min-h-screen bg-background dark:bg-[#020817] relative">
            {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} gravity={0.15} colors={['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b']} />}

            {/* Premium Background Pattern */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 35c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm57 43c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm-23-1gl1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM46 9c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm24 76c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zM32 74c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm36-40c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM44 70c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z' fill='%239C92AC' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                {/* Enhanced Hero Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        {studentProfile && (
                            <div className="mb-4 p-3 md:p-4 bg-muted/30 border border-primary/10 rounded-xl flex flex-row gap-3 md:gap-4 items-center animate-in fade-in slide-in-from-top-4 overflow-hidden">
                                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <UserIcon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                                </div>
                                <div className="space-y-0.5 md:space-y-1 min-w-0">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <h2 className="text-base md:text-lg font-bold truncate">
                                            {studentProfile.displayName || studentProfile.fullName || studentProfile.name || studentProfile.email || 'Unknown Student'}
                                        </h2>
                                        <Badge variant="outline" className="text-[10px] h-4 md:h-5 px-1 shrink-0">Student</Badge>
                                    </div>
                                    <div className="flex flex-col xs:flex-row xs:flex-wrap gap-x-3 gap-y-0.5 text-[10px] md:text-sm text-muted-foreground truncate">
                                        {studentProfile.email && (
                                            <div className="flex items-center gap-1 truncate">
                                                <Mail className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" /> <span className="truncate">{studentProfile.email}</span>
                                            </div>
                                        )}
                                        {studentProfile.phoneNumber && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Phone className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" /> {studentProfile.phoneNumber}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{(quiz.title || quiz.name)}</h1>
                        <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wide">
                            {(quiz.subjects && quiz.subjects[0]) || quiz.subject || 'General'} &bull; Result Analysis
                        </p>
                    </div>
                </div>

                {/* Action Row */}
                <div className="flex flex-wrap items-center gap-3 mb-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-muted group text-muted-foreground hover:text-foreground transition-all"
                        onClick={() => router.push(isAdmin && studentIdParam ? `/admin/students/foradmin?id=${studentIdParam}` : '/dashboard/student/results')}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                        <span className="inline">Back to History</span>
                    </Button>
                    <Badge className={`text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg ${remarkColor} text-white ml-auto`}>
                        {remark}
                    </Badge>
                </div>

                {/* 6-Column Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
                    {[
                        { label: 'Accuracy', value: `${percentage}%`, icon: Target, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                        {
                            label: 'Time Spent',
                            value: (() => {
                                const t = attempt.timeTaken || (attempt.submittedAt && attempt.startedAt ? (attempt.submittedAt.seconds - attempt.startedAt.seconds) : 0);
                                if (!t || t <= 0) return 'N/A';
                                return `${Math.floor(t / 60)}m ${Math.floor(t % 60)}s`;
                            })(),
                            icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20'
                        },
                        { label: 'Total Questions', value: attempt.total || attempt.detailed.length, icon: BookOpen, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' }, // New Card
                        { label: 'Correct', value: correctAnswers, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                        { label: 'Wrong', value: wrongAnswers, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                        { label: 'Skipped', value: skippedQuestions, icon: Circle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                    ].map((stat, i) => (
                        <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4 md:p-6">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-2 md:mb-4 ring-1 ring-inset ring-white/10`}>
                                    <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <p className="text-xl md:text-2xl font-bold text-foreground truncate">{stat.value}</p>
                                <p className="text-[10px] md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5 md:mt-1 truncate">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Main Tabs Navigation - Scrollable on mobile */}
                <div className="w-full overflow-x-auto no-scrollbar mb-8">
                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-2xl w-max border border-border/50 backdrop-blur-sm min-w-full md:min-w-0">
                        {[
                            { id: 'overview', label: 'All Questions', icon: BookOpen },
                            { id: 'subjects', label: 'Subject Analysis', icon: BarChart3 },
                            { id: 'wrong', label: 'Wrong', icon: XCircle },
                            { id: 'skipped', label: 'Skipped', icon: Clock },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-medium transition-all duration-200 whitespace-nowrap text-sm md:text-base ${activeTab === tab.id
                                    ? 'bg-background text-primary shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                                    }`}
                            >
                                <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary' : ''}`} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {activeTab === 'subjects' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {subjectStatsArray.map((stats, i) => (
                                <Card key={i} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50">
                                    <div className={`h-1.5 w-full ${stats.percentage >= 70 ? 'bg-green-500' : stats.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">{stats.subject}</h3>
                                            <Badge variant="secondary" className="font-bold text-base px-2.5">
                                                {Math.round(stats.percentage)}%
                                            </Badge>
                                        </div>
                                        <div className="space-y-4">
                                            <Progress value={stats.percentage} className="h-2 rounded-full" />
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="text-center p-2 bg-green-50 dark:bg-green-900/10 rounded-lg">
                                                    <p className="text-xs text-green-600 font-bold mb-0.5">{stats.correct}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Correct</p>
                                                </div>
                                                <div className="text-center p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                                                    <p className="text-xs text-red-600 font-bold mb-0.5">{stats.wrong}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Wrong</p>
                                                </div>
                                                <div className="text-center p-2 bg-muted rounded-lg">
                                                    <p className="text-xs text-foreground font-bold mb-0.5">{stats.skipped}</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Skip</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {filteredQuestions.length > 0 ? (
                                filteredQuestions.map((q, idx) => renderQuestionCard(q, idx, true))
                            ) : (
                                <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border/50">
                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Info className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">No questions found</h3>
                                    <p className="text-muted-foreground">Try selecting a different filter above.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Support Modals */}
            <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Flag className="w-5 h-5 text-red-500" />
                            Report an Issue
                        </DialogTitle>
                        <DialogDescription>
                            Found a mistake in this question? Let us know and we'll fix it immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="Describe what's wrong (e.g., wrong answer, spelling mistake...)"
                            value={reportIssue}
                            onChange={(e) => setReportIssue(e.target.value)}
                            className="min-h-[120px] resize-none"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReportModalOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleReportSubmit}
                            disabled={!reportIssue.trim() || isReporting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isReporting ? "Sending..." : "Submit Report"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
                <DialogContent className="sm:max-w-[425px] overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Award className="w-32 h-32 rotate-12" />
                    </div>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                            <Sparkles className="w-6 h-6 text-purple-600" />
                            Premium Feature
                        </DialogTitle>
                        <DialogDescription className="text-base pt-2">
                            Reporting mistakes and detailed content reviews are available for <span className="text-primary font-bold">Plus & Pro</span> members.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        {[
                            "Direct access to subject experts",
                            "Priority mistake fixes within 24h",
                            "Explanation review on demand"
                        ].map((feat, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="p-1 bg-green-100 dark:bg-green-900/40 rounded-full">
                                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                                </div>
                                <span className="text-sm font-medium">{feat}</span>
                            </div>
                        ))}
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setUpgradeDialogOpen(false)}>Maybe Later</Button>
                        <Button className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/20" onClick={() => window.open('/subscription', '_blank')}>
                            Upgrade Now
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const UserResponsesPage = () => {
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return null;

    return (
        <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen bg-background"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <UserResponsesPageContent />
        </React.Suspense>
    );
};

export default UserResponsesPage;
