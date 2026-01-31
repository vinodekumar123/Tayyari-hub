'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/app/firebase';
import { toast } from 'sonner';

import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';
import { useRouter } from 'next/navigation';

import {
    Card,
    CardHeader,
    CardTitle,
    CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import { Info, CheckCircle, XCircle, Circle, Clock, BarChart3, Target, BookOpen, Flag, Lock, Bookmark } from 'lucide-react';

interface Question {
    id: string;
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    subject?: string;
    graceMark?: boolean;
}

interface QuizData {
    title: string;
    subject?: string;
    resultVisibility: string;
    selectedQuestions: Question[];
}

interface SubjectStats {
    subject: string;
    total: number;
    correct: number;
    wrong: number;
    skipped: number;
    percentage: number;
}

const ResultPageContent: React.FC = () => {
    const searchParams = useSearchParams();
    const quizId = searchParams.get('id');
    const isMock = searchParams.get('mock') === 'true';
    const studentId = searchParams.get('studentId');
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
    const [score, setScore] = useState(0);
    const [accessDenied, setAccessDenied] = useState(false);
    const [wrongAnswers, setWrongAnswers] = useState(0);
    const [skippedQuestions, setSkippedQuestions] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);
    const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
    const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'wrong' | 'skipped'>('overview');
    const { width, height } = useWindowSize();

    // Report State
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [selectedQuestionForReport, setSelectedQuestionForReport] = useState<Question | null>(null);
    const [reportIssue, setReportIssue] = useState('');
    const [isReporting, setIsReporting] = useState(false);
    const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());

    // Enrollment / Upgrade State
    const [hasPaidEnrollment, setHasPaidEnrollment] = useState(false);
    const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
    const [enrollmentCheckDone, setEnrollmentCheckDone] = useState(false);

    useEffect(() => {
        onAuthStateChanged(auth, u => setUser(u));
    }, []);

    // Check Enrollment Status - Any enrolled student (free or paid) is considered premium
    useEffect(() => {
        if (!user) return;
        const checkEnrollments = async () => {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                // If Admin/Superadmin, allow immediately
                if (userDoc.exists() && (userDoc.data().admin === true || userDoc.data().superadmin === true)) {
                    setHasPaidEnrollment(true);
                    setEnrollmentCheckDone(true);
                    return;
                }

                // Check for enrollments with any valid status (active, paid, enrolled)
                const q = query(
                    collection(db, 'enrollments'),
                    where('studentId', '==', user.uid),
                    where('status', 'in', ['active', 'paid', 'enrolled'])
                );
                const snapshot = await getDocs(q);
                // Any enrollment counts - student is premium if enrolled in ANY series
                const isEnrolledUser = snapshot.docs.length > 0;

                setHasPaidEnrollment(isEnrolledUser);
            } catch (error) {
                console.error("Error checking enrollments:", error);
            } finally {
                setEnrollmentCheckDone(true);
            }
        };
        checkEnrollments();
    }, [user]);

    useEffect(() => {
        if (!quizId || !user || !studentId) return;

        const load = async () => {
            const quizDoc = isMock
                ? doc(db, 'users', studentId, 'mock-quizzes', quizId)
                : doc(db, 'quizzes', quizId);

            const resultDoc = doc(
                db,
                'users',
                studentId,
                isMock ? 'mock-quizAttempts' : 'quizAttempts',
                quizId,
                'results',
                quizId
            );

            const [quizSnap, resultSnap] = await Promise.all([
                getDoc(quizDoc),
                getDoc(resultDoc)
            ]);

            if (!quizSnap.exists() || !resultSnap.exists()) return;

            const quizData = quizSnap.data();
            const attemptData = resultSnap.data();

            // result visibility logic
            if (quizData.resultVisibility !== 'immediate') {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : null;
                const isAdmin = userData?.admin === true;

                if (!isAdmin) {
                    setAccessDenied(true);
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

            // Calculate stats
            let correct = 0;
            let wrong = 0;
            let skipped = 0;

            questions.forEach(q => {
                const userAnswer = answers[q.id];
                // Grace mark logic: if graceMark is true, count as correct regardless of answer
                if (q.graceMark) {
                    correct++;
                } else if (!userAnswer || userAnswer === '') {
                    skipped++;
                } else if (userAnswer === q.correctAnswer) {
                    correct++;
                } else {
                    wrong++;
                }
            });

            setScore(correct);
            setWrongAnswers(wrong);
            setSkippedQuestions(skipped);

            // Calculate subject-wise stats
            const subjectStatsMap: Record<string, SubjectStats> = {};
            questions.forEach(q => {
                const subject = q.subject || 'General';
                if (!subjectStatsMap[subject]) {
                    subjectStatsMap[subject] = {
                        subject,
                        total: 0,
                        correct: 0,
                        wrong: 0,
                        skipped: 0,
                        percentage: 0
                    };
                }

                const stats = subjectStatsMap[subject];
                stats.total++;

                const userAnswer = answers[q.id];
                if (q.graceMark) {
                    stats.correct++;
                } else if (!userAnswer || userAnswer === '') {
                    stats.skipped++;
                } else if (userAnswer === q.correctAnswer) {
                    stats.correct++;
                } else {
                    stats.wrong++;
                }

                stats.percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
            });

            setSubjectStats(Object.values(subjectStatsMap));

            if (correct / questions.length >= 0.7) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 6000);
            }
        };

        load();
    }, [quizId, user, isMock, studentId]);

    const openReportModal = (q: Question) => {
        if (!enrollmentCheckDone) {
            toast.info("Checking permission...");
            return;
        }

        if (!hasPaidEnrollment) {
            setUpgradeDialogOpen(true);
            return;
        }

        setSelectedQuestionForReport(q);
        setReportIssue('');
        setReportModalOpen(true);
    };

    const handleReportSubmit = async () => {
        if (!selectedQuestionForReport || !user || !quizId || !reportIssue.trim()) return;
        setIsReporting(true);
        try {
            await addDoc(collection(db, 'reported_questions'), {
                quizId,
                questionId: selectedQuestionForReport.id,
                questionText: selectedQuestionForReport.questionText,
                studentId: user.uid,
                studentName: user.displayName || user.email || 'Student',
                issue: reportIssue,
                status: 'pending',
                createdAt: serverTimestamp(),
                type: 'quiz_result_report'
            });
            toast.success("Report Submitted", { description: "Admins will review this question." });
            setReportModalOpen(false);
        } catch (e) {
            toast.error("Failed to submit report");
        } finally {
            setIsReporting(false);
        }
    };

    const handleSaveToFlashcards = async (question: Question) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid, 'flashcards', question.id), {
                id: question.id,
                questionText: question.questionText || '',
                options: question.options || [],
                correctAnswer: question.correctAnswer || '',
                explanation: question.explanation || '',
                subject: question.subject || 'General',
                savedAt: serverTimestamp(),
                isDeleted: false
            });
            setSavedQuestions((prev) => {
                const newSet = new Set(prev);
                newSet.add(question.id);
                return newSet;
            });
            toast.success("Saved to Flashcards");
        } catch (e) {
            console.error(e);
            toast.error("Failed to save flashcard");
        }
    };

    if (accessDenied) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center p-8 bg-card rounded-xl shadow-lg border border-border">
                    <p className="text-lg text-destructive font-semibold">
                        🚫 Responses for this quiz are not available yet.
                    </p>
                </div>
            </div>
        );
    }

    if (!quiz) return (
        <div className="flex justify-center items-center min-h-screen bg-background">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    const groupedBySubject = quiz.selectedQuestions.reduce((acc, q) => {
        const subj = q.subject || 'General';
        if (!acc[subj]) acc[subj] = [];
        acc[subj].push(q);
        return acc;
    }, {} as Record<string, Question[]>);

    const wrongQuestions = quiz.selectedQuestions.filter(q => {
        const userAnswer = userAnswers[q.id];
        return !q.graceMark && userAnswer && userAnswer !== q.correctAnswer;
    });

    const skippedQuestionsList = quiz.selectedQuestions.filter(q => {
        const userAnswer = userAnswers[q.id];
        return !q.graceMark && (!userAnswer || userAnswer === '');
    });

    const totalQuestions = quiz.selectedQuestions.length;
    const percentage = (score / totalQuestions) * 100;
    let remark = 'Needs Improvement';
    let remarkColor = 'bg-red-500';
    if (percentage === 100) { remark = '🏆 Perfect Score! Outstanding!'; remarkColor = 'bg-indigo-600'; }
    else if (percentage >= 90) { remark = '🔥 Excellent Performance!'; remarkColor = 'bg-emerald-600'; }
    else if (percentage >= 70) { remark = '🎉 Great Job!'; remarkColor = 'bg-blue-600'; }
    else if (percentage >= 50) { remark = '👍 Good Effort'; remarkColor = 'bg-yellow-500'; }

    const renderQuestionCard = (q: Question, idx: number, showSubject: boolean = false) => {
        const userAnswer = userAnswers[q.id];
        const isSkipped = !userAnswer || userAnswer === '';

        return (
            <Card key={q.id} className="mb-6 shadow-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                <CardHeader className="dir-ltr rounded-t-lg bg-muted/30 border-b border-border/50 pb-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <CardTitle className="text-lg font-semibold text-foreground flex gap-2 items-start leading-relaxed w-full min-w-0">
                            <span className="text-primary font-bold min-w-[2.5rem] shrink-0">Q{idx + 1}.</span>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="break-words" dangerouslySetInnerHTML={{ __html: q.questionText }} />
                                {q.graceMark && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200 font-normal inline-block">Grace Mark Awarded</span>}
                            </div>
                        </CardTitle>
                        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                            {isSkipped && !q.graceMark && (
                                <Badge variant="secondary" className="bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Skipped
                                </Badge>
                            )}
                            {showSubject && q.subject && (
                                <Badge variant="outline" className="text-xs">
                                    {q.subject}
                                </Badge>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 dark:bg-red-900/10 dark:hover:bg-red-900/30 dark:text-red-400 h-8 px-2"
                                onClick={() => openReportModal(q)}
                                title="Report Mistake"
                            >
                                <Flag className="w-4 h-4 mr-1.5" />
                                Report
                            </Button>
                            {savedQuestions.has(q.id) ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled
                                    className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 h-8 px-2 ml-2"
                                >
                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                    Saved
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 dark:bg-indigo-900/10 dark:hover:bg-indigo-900/30 dark:text-indigo-400 h-8 px-2 ml-2"
                                    onClick={() => handleSaveToFlashcards(q)}
                                    title="Save to Flashcards"
                                >
                                    <Bookmark className="w-4 h-4 mr-1.5" />
                                    Save
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="grid grid-cols-1 gap-3">
                        {q.options.map((opt, i) => {
                            const isSelected = opt === userAnswer;
                            const isAnswer = opt === q.correctAnswer;

                            let style = 'border-border bg-card hover:bg-accent/40 text-foreground';
                            let icon = <Circle className="text-muted-foreground w-4 h-4 mr-3" />;

                            if (q.graceMark) {
                                if (isAnswer) {
                                    style = 'border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100';
                                    icon = <CheckCircle className="text-yellow-500 w-5 h-5 mr-3" />;
                                }
                            } else {
                                if (isAnswer) {
                                    style = 'border-green-500/50 bg-green-50/50 dark:bg-green-900/20 text-green-900 dark:text-green-100 shadow-[0_0_0_1px_rgba(34,197,94,0.2)]';
                                    icon = <CheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 mr-3" />;
                                } else if (isSelected && !isAnswer) {
                                    style = 'border-red-500/50 bg-red-50/50 dark:bg-red-900/20 text-red-900 dark:text-red-100 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]';
                                    icon = <XCircle className="text-red-600 dark:text-red-400 w-5 h-5 mr-3" />;
                                }
                            }

                            return (
                                <div
                                    key={i}
                                    className={`flex items-center p-4 rounded-xl border text-base font-medium transition-colors duration-200 ${style}`}
                                >
                                    {icon}
                                    <span className="flex-1">{String.fromCharCode(65 + i)}. {opt}</span>
                                </div>
                            );
                        })}
                    </div>

                    {q.explanation && (
                        <div className="mt-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
                            <Info className="h-5 w-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                            <div className="leading-relaxed min-w-0 flex-1">
                                <span className="font-semibold block mb-1">Explanation:</span>
                                <div className="break-words" dangerouslySetInnerHTML={{ __html: q.explanation }} />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="min-h-screen bg-background dark:bg-[#020817] p-4 md:p-8 transition-colors duration-300">
            {/* Dynamic Background */}
            <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] dark:bg-[url('/grid-dark.svg')] opacity-50 pointer-events-none" />

            <div className="relative max-w-7xl mx-auto space-y-8">
                {showConfetti && (
                    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                        <Confetti width={width} height={height} numberOfPieces={500} recycle={false} />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl md:text-7xl font-bold animate-bounce text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 drop-shadow-2xl">
                            🎉 Congratulations! 🎉
                        </div>
                    </div>
                )}

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">{quiz.title}</h1>
                        <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wide">
                            {quiz.subject} &bull; Result Analysis
                        </p>
                    </div>
                    <Badge className={`text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg ${remarkColor} text-white hover:${remarkColor}`}>
                        {remark}
                    </Badge>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 overflow-hidden">
                    {[
                        { label: 'Score', value: `${score}/${totalQuestions}`, color: 'text-primary', bg: 'bg-primary/10', icon: Target },
                        { label: 'Percentage', value: `${percentage.toFixed(1)}%`, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100/50 dark:bg-purple-900/20', icon: BarChart3 },
                        { label: 'Correct', value: score, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100/50 dark:bg-green-900/20', icon: CheckCircle },
                        { label: 'Wrong', value: wrongAnswers, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100/50 dark:bg-red-900/20', icon: XCircle },
                        { label: 'Skipped', value: skippedQuestions, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100/50 dark:bg-yellow-900/20', icon: Clock },
                    ].map((stat, i) => (
                        <Card key={i} className="border-border/60 bg-card/60 backdrop-blur-sm hover:translate-y-[-2px] transition-transform duration-200 shadow-sm min-w-0">
                            <CardContent className="p-3 md:p-4 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs md:text-sm font-medium text-muted-foreground truncate">{stat.label}</p>
                                    <p className={`text-lg md:text-2xl font-bold mt-0.5 md:mt-1 ${stat.color} truncate`}>{stat.value}</p>
                                </div>
                                <div className={`p-2 md:p-2.5 rounded-xl ${stat.bg} shrink-0`}>
                                    <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Grace Mark Notice */}
                {quiz.selectedQuestions.some(q => q.graceMark) && (
                    <div className="p-4 bg-yellow-50/80 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-200 flex items-center gap-3 shadow-sm backdrop-blur-sm">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-full">
                            <Info className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <p className="font-medium text-sm">Grace marks were awarded for flagged questions to ensure fair scoring.</p>
                    </div>
                )}

                {/* Navigation Tabs */}
                <div className="bg-muted p-1 rounded-xl inline-flex flex-wrap gap-1 shadow-inner">
                    {[
                        { id: 'overview', icon: BookOpen, label: 'All Questions' },
                        { id: 'subjects', icon: BarChart3, label: 'Subject Analysis' },
                        { id: 'wrong', icon: XCircle, label: `Wrong (${wrongAnswers})` },
                        { id: 'skipped', icon: Clock, label: `Skipped (${skippedQuestions})` },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200
                ${activeTab === tab.id
                                    ? 'bg-background text-foreground shadow-sm scale-[1.02]'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}
              `}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            {Object.entries(groupedBySubject).map(([subject, questions]) => (
                                <div key={subject}>
                                    <div className="flex items-center gap-3 mb-4 pl-1">
                                        <div className="h-8 w-1 bg-primary rounded-full" />
                                        <h2 className="text-xl font-bold text-foreground">
                                            {subject}
                                        </h2>
                                        <Badge variant="secondary" className="text-xs font-normal">
                                            {questions.length} Questions
                                        </Badge>
                                    </div>
                                    {questions.map((q, idx) => renderQuestionCard(q, idx))}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'subjects' && (
                        <div className="grid gap-6 md:grid-cols-2">
                            {subjectStats.map((stats) => (
                                <Card key={stats.subject} className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300">
                                    <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
                                        <div className="flex justify-between items-center">
                                            <CardTitle className="text-lg font-bold">{stats.subject}</CardTitle>
                                            <Badge
                                                className={`px-3 py-1 font-bold ${stats.percentage >= 70
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : stats.percentage >= 50
                                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}
                                            >
                                                {stats.percentage.toFixed(1)}%
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-4 gap-2 text-center mb-6">
                                            {[
                                                { label: 'Total', value: stats.total, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                                { label: 'Correct', value: stats.correct, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                                                { label: 'Wrong', value: stats.wrong, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                                                { label: 'Skip', value: stats.skipped, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                                            ].map((item, idx) => (
                                                <div key={idx} className={`p-2.5 rounded-lg ${item.bg}`}>
                                                    <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                                                    <p className="text-xs text-muted-foreground font-medium uppercase mt-1">{item.label}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Stacked Progress Bar */}
                                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                                            <div style={{ width: `${(stats.correct / stats.total) * 100}%` }} className="h-full bg-green-500" />
                                            <div style={{ width: `${(stats.wrong / stats.total) * 100}%` }} className="h-full bg-red-500" />
                                            <div style={{ width: `${(stats.skipped / stats.total) * 100}%` }} className="h-full bg-yellow-400" />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-medium">
                                            <span>Correct</span>
                                            <span>Wrong</span>
                                            <span>Skipped</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {activeTab === 'wrong' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-destructive mb-4 flex items-center gap-2">
                                <XCircle className="w-6 h-6" />
                                Wrong Answers ({wrongAnswers})
                            </h2>
                            {wrongQuestions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 bg-card/40 border border-dashed border-border rounded-xl text-center">
                                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Perfect Score on Attempted!</h3>
                                    <p className="text-muted-foreground max-w-sm">
                                        You didn&apos;t get any questions wrong. That&apos;s an outstanding achievement!
                                    </p>
                                </div>
                            ) : (
                                wrongQuestions.map((q, idx) => renderQuestionCard(q, idx, true))
                            )}
                        </div>
                    )}

                    {activeTab === 'skipped' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mb-4 flex items-center gap-2">
                                <Clock className="w-6 h-6" />
                                Skipped Questions ({skippedQuestions})
                            </h2>
                            {skippedQuestionsList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 bg-card/40 border border-dashed border-border rounded-xl text-center">
                                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
                                        <Target className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Full Attempt!</h3>
                                    <p className="text-muted-foreground max-w-sm">
                                        You attempted every single question. Way to go!
                                    </p>
                                </div>
                            ) : (
                                skippedQuestionsList.map((q, idx) => renderQuestionCard(q, idx, true))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Report Dialog */}
            <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Flag className="w-5 h-5" /> Report Question Issue
                        </DialogTitle>
                        <DialogDescription>
                            Describe the issue (e.g., wrong answer, typo, formatting).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-foreground/80 italic font-medium">
                            <span className="text-muted-foreground not-italic block text-xs mb-1 font-bold uppercase">Selected Question:</span>
                            &quot;{selectedQuestionForReport?.questionText.replace(/<[^>]+>/g, '').substring(0, 150)}{selectedQuestionForReport?.questionText && selectedQuestionForReport.questionText.length > 150 ? '...' : ''}&quot;
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground">Issue Description</label>
                            <Textarea
                                placeholder="Please describe the mistake or issue in detail..."
                                value={reportIssue}
                                onChange={(e) => setReportIssue(e.target.value)}
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReportModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleReportSubmit} disabled={isReporting} className="bg-destructive hover:bg-destructive/90 text-white">
                            {isReporting ? 'Submitting...' : 'Submit Report'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upgrade Required Dialog */}
            <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-indigo-600">
                            <Lock className="w-5 h-5" /> Feature Locked
                        </DialogTitle>
                        <DialogDescription className="text-base pt-2">
                            Reporting questions is a premium feature available only to paid users.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 text-center">
                        <p className="text-muted-foreground mb-4">
                            Please enroll in any <strong>Paid Series</strong> to unlock question reporting and other premium benefits.
                        </p>
                    </div>
                    <DialogFooter className="sm:justify-center">
                        <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>Close</Button>
                        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white" onClick={() => router.push('/dashboard/student')}>
                            Explore Paid Series
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const ResultPage = () => {
    return (
        <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
            <ResultPageContent />
        </React.Suspense>
    );
};

export default ResultPage;
