'use client';

import React, { useState, useEffect, lazy, Suspense } from 'react';
import useWindowSize from 'react-use/lib/useWindowSize';
import { toast } from 'sonner';
import { db } from '@/app/firebase';
import { addDoc, collection, serverTimestamp, setDoc, doc, getDoc, query, where, getDocs } from 'firebase/firestore';

// Components & Hooks
import { useQuizResult, Question } from '@/hooks/useQuizResult';
import { ResponseHeader } from '@/components/responses/ResponseHeader';
import { ResponseStats } from '@/components/responses/ResponseStats';
import { QuestionCard } from '@/components/responses/QuestionCard';
import { SubjectAnalysis } from '@/components/responses/SubjectAnalysis';
import { ReportIssueDialog } from '@/components/responses/ReportIssueDialog';
import { generateResultPDF } from '@/lib/pdf-utils';
import { BookOpen, BarChart3, XCircle, Clock, Info, CheckCircle, Target } from 'lucide-react';

// Lazy load confetti (~25KB) - only needed for high scores
const Confetti = lazy(() => import('react-confetti'));
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function ResultPageContent() {
    const {
        user, quiz, userAnswers, score, wrongAnswers, skippedQuestions,
        subjectStats, accessDenied, loading, showConfetti: initialConfetti,
        studentId, quizId
    } = useQuizResult();

    const { width, height } = useWindowSize();
    const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'wrong' | 'skipped'>('overview');

    // Reporting
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [selectedQuestionForReport, setSelectedQuestionForReport] = useState<Question | null>(null);
    const [reportIssue, setReportIssue] = useState('');
    const [isReporting, setIsReporting] = useState(false);

    // Enrollment
    const [enrollmentCheckDone, setEnrollmentCheckDone] = useState(false);
    const [hasPaidEnrollment, setHasPaidEnrollment] = useState(false);
    const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

    // Flashcards
    const [savedQuestions, setSavedQuestions] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);

    // Check Enrollment Status
    useEffect(() => {
        if (!user) return;
        const checkEnrollments = async () => {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists() && (userDoc.data().admin === true || userDoc.data().role === 'admin')) {
                    setHasPaidEnrollment(true);
                    setEnrollmentCheckDone(true);
                    return;
                }
                const q = query(
                    collection(db, 'enrollments'),
                    where('studentId', '==', user.uid),
                    where('status', 'in', ['active', 'paid', 'enrolled'])
                );
                const snapshot = await getDocs(q);
                setHasPaidEnrollment(snapshot.docs.length > 0);
            } catch (error) {
                console.error("Error checking enrollments:", error);
            } finally {
                setEnrollmentCheckDone(true);
            }
        };
        checkEnrollments();
    }, [user]);

    // Actions
    const handleDownload = async () => {
        if (!quiz || !user) return;
        setIsExporting(true);
        try {
            const total = quiz.selectedQuestions.length;
            const pct = (score / total) * 100;
            // Remark Logic
            let remark = 'Needs Improvement';
            if (pct === 100) remark = '🏆 Perfect Score!';
            else if (pct >= 90) remark = '🔥 Excellent!';
            else if (pct >= 70) remark = '🎉 Great Job!';
            else if (pct >= 50) remark = '👍 Good Effort';

            generateResultPDF({
                title: quiz.title,
                studentName: user.displayName || user.email || 'Student',
                totalQuestions: total,
                score,
                wrongAnswers,
                skippedQuestions,
                percentage: pct,
                remark,
                subjectStats
            });
            toast.success("Result Card downloaded!");
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate PDF");
        } finally {
            setIsExporting(false);
        }
    };

    const handleReportOpen = (q: Question) => {
        if (!enrollmentCheckDone) { toast.info("Checking permission..."); return; }
        if (!hasPaidEnrollment) { setUpgradeDialogOpen(true); return; }
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
                type: 'quiz_result_report',
                source: 'question_bank'
            });
            toast.success("Report Submitted");
            setReportModalOpen(false);
        } catch (e) {
            toast.error("Failed to submit report");
        } finally {
            setIsReporting(false);
        }
    };

    const handleSave = async (question: Question) => {
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
            setSavedQuestions(prev => new Set(prev).add(question.id));
            toast.success("Saved to Flashcards");
        } catch (e) {
            toast.error("Failed to save flashcard");
        }
    };

    if (accessDenied) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center p-8 bg-card rounded-xl shadow-lg border border-border">
                    <p className="text-lg text-destructive font-semibold">🚫 Responses for this quiz are not available yet.</p>
                </div>
            </div>
        );
    }

    if (loading || !quiz) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-background">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Prepare Data
    const totalQuestions = quiz.selectedQuestions.length;
    const percentage = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

    let remark = 'Needs Improvement';
    let remarkColor = 'bg-red-500';
    if (percentage === 100) { remark = '🏆 Perfect Score!'; remarkColor = 'bg-indigo-600'; }
    else if (percentage >= 90) { remark = '🔥 Excellent!'; remarkColor = 'bg-emerald-600'; }
    else if (percentage >= 70) { remark = '🎉 Fast Learner!'; remarkColor = 'bg-blue-600'; }
    else if (percentage >= 50) { remark = '👍 Good Effort'; remarkColor = 'bg-yellow-500'; }

    const groupedQuestions = quiz.selectedQuestions.reduce((acc, q) => {
        const s = q.subject || 'General';
        if (!acc[s]) acc[s] = [];
        acc[s].push(q);
        return acc;
    }, {} as Record<string, Question[]>);

    const wrongList = quiz.selectedQuestions.filter(q => {
        const ans = userAnswers[q.id];
        return !q.graceMark && ans && ans !== q.correctAnswer;
    });

    const skippedList = quiz.selectedQuestions.filter(q => {
        const ans = userAnswers[q.id];
        return !q.graceMark && (!ans || ans === '');
    });

    return (
        <div className="min-h-screen bg-background dark:bg-[#020817] p-4 md:p-8 transition-colors duration-300">
            <div className="fixed inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] dark:bg-[url('/grid-dark.svg')] opacity-50 pointer-events-none" />

            {initialConfetti && (
                <Suspense fallback={null}>
                    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                        <Confetti width={width} height={height} numberOfPieces={500} recycle={false} />
                    </div>
                </Suspense>
            )}

            <div className="relative max-w-7xl mx-auto space-y-8">
                <ResponseHeader
                    title={quiz.title}
                    subject={quiz.subject || 'General'}
                    remark={remark}
                    remarkColor={remarkColor}
                    onDownload={handleDownload}
                    isExporting={isExporting}
                />

                <ResponseStats
                    score={score}
                    totalQuestions={totalQuestions}
                    wrongAnswers={wrongAnswers}
                    skippedQuestions={skippedQuestions}
                    percentage={percentage}
                />

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
                            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 ${activeTab === tab.id ? 'bg-background text-foreground shadow-sm scale-[1.02]' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {activeTab === 'overview' && Object.entries(groupedQuestions).map(([subj, qs]) => (
                        <div key={subj} className="mb-8">
                            <div className="flex items-center gap-3 mb-4 pl-1">
                                <div className="h-8 w-1 bg-primary rounded-full" />
                                <h2 className="text-xl font-bold text-foreground">{subj}</h2>
                                <Badge variant="secondary" className="text-xs font-normal">{qs.length} Questions</Badge>
                            </div>
                            {qs.map((q, i) => (
                                <QuestionCard
                                    key={q.id}
                                    question={q}
                                    index={i} // Note: Index might need offset if we want global numbering
                                    userAnswer={userAnswers[q.id]}
                                    isSaved={savedQuestions.has(q.id)}
                                    onReport={handleReportOpen}
                                    onSave={handleSave}
                                />
                            ))}
                        </div>
                    ))}

                    {activeTab === 'subjects' && <SubjectAnalysis stats={subjectStats} />}

                    {activeTab === 'wrong' && (
                        wrongList.length === 0 ? (
                            <EmptyState icon={CheckCircle} title="Perfect!" description="No wrong answers." color="text-green-600" bg="bg-green-100" />
                        ) : (
                            wrongList.map((q, i) => <QuestionCard key={q.id} question={q} index={i} userAnswer={userAnswers[q.id]} isSaved={savedQuestions.has(q.id)} onReport={handleReportOpen} onSave={handleSave} showSubject />)
                        )
                    )}

                    {activeTab === 'skipped' && (
                        skippedList.length === 0 ? (
                            <EmptyState icon={Target} title="All Attempted!" description="You answered every question." color="text-blue-600" bg="bg-blue-100" />
                        ) : (
                            skippedList.map((q, i) => <QuestionCard key={q.id} question={q} index={i} userAnswer={userAnswers[q.id]} isSaved={savedQuestions.has(q.id)} onReport={handleReportOpen} onSave={handleSave} showSubject />)
                        )
                    )}
                </div>

                <ReportIssueDialog
                    open={reportModalOpen}
                    onOpenChange={setReportModalOpen}
                    question={selectedQuestionForReport}
                    issue={reportIssue}
                    onIssueChange={setReportIssue}
                    onSubmit={handleReportSubmit}
                    submitting={isReporting}
                />

                <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Premium Feature</DialogTitle>
                            <DialogDescription>Reporting questions is available to enrolled students only.</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => setUpgradeDialogOpen(false)}>Close</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

function EmptyState({ icon: Icon, title, description, color, bg }: any) {
    return (
        <div className="flex flex-col items-center justify-center p-12 bg-card/40 border border-dashed border-border rounded-xl text-center">
            <div className={`w-20 h-20 ${bg} rounded-full flex items-center justify-center mb-4`}>
                <Icon className={`w-10 h-10 ${color}`} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
            <p className="text-muted-foreground max-w-sm">{description}</p>
        </div>
    );
}
