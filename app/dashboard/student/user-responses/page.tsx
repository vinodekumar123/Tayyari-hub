'use client';

import React, { useState, lazy, Suspense } from 'react';
import { useWindowSize } from 'react-use';
import { BookOpen, BarChart3, XCircle, Clock, Info } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/error-boundary';

// Lazy load confetti (~25KB) - only needed for high scores
const Confetti = lazy(() => import('react-confetti'));
import { toast } from 'sonner';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/firebase';

import { useUserResponse, DetailedResponse } from '@/hooks/useUserResponse';
import { ResponseHeader } from '@/components/user-responses/ResponseHeader';
import { ResponseStats } from '@/components/user-responses/ResponseStats';
import { SubjectAnalysis } from '@/components/user-responses/SubjectAnalysis';
import { ResponseQuestionCard } from '@/components/user-responses/ResponseQuestionCard';
import { ReportIssueDialog } from '@/components/user-responses/ReportIssueDialog';
import { UpgradeDialog } from '@/components/user-responses/UpgradeDialog';

const getRemark = (p: number) => {
    if (p >= 90) return { text: 'Outstanding', color: 'bg-emerald-500' };
    if (p >= 75) return { text: 'Excellent', color: 'bg-green-500' };
    if (p >= 60) return { text: 'Good Performance', color: 'bg-blue-500' };
    if (p >= 45) return { text: 'Average', color: 'bg-yellow-500' };
    return { text: 'Needs More Practice', color: 'bg-red-500' };
};

const UserResponsesPageContent: React.FC = () => {
    const {
        loading,
        error,
        quiz,
        attempt,
        studentProfile,
        stats,
        isAdmin,
        studentIdParam,
        savedQuestions,
        handleSaveToFlashcards,
        user
    } = useUserResponse();

    const { width, height } = useWindowSize();
    const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'wrong' | 'skipped'>('overview');

    // Reporting state
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportIssue, setReportIssue] = useState('');
    const [selectedQuestionForReport, setSelectedQuestionForReport] = useState<DetailedResponse | null>(null);
    const [isReporting, setIsReporting] = useState(false);
    const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

    if (error) return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
            <div className="text-red-600 dark:text-red-400 text-center py-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg rounded-2xl px-8 border border-red-200 dark:border-red-900 shadow-xl">{error}</div>
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

    if (!attempt || !quiz || !stats) return (
        <div className="min-h-screen bg-background dark:bg-[#020817] flex items-center justify-center">
            <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No results found for this attempt.</p>
            </div>
        </div>
    );

    const { text: remark, color: remarkColor } = getRemark(stats.percentage);
    const showConfetti = stats.percentage >= 80;

    const openReportModal = (question: DetailedResponse) => {
        setSelectedQuestionForReport(question);
        setReportModalOpen(true);
    };

    const handleReportSubmit = async () => {
        if (!reportIssue.trim() || !selectedQuestionForReport || !user) return;
        setIsReporting(true);
        try {
            // Using logic from original file manually since it needs `addDoc`
            // If we wanted to, we could move this to the hook too, but it's UI specific action
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
                quizId: quiz?.name || 'unknown', // Using name/title as ID approximation or pass the real ID if available from context
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

    // Filter questions based on tabs
    let filteredQuestions = attempt.detailed;
    if (activeTab === 'wrong') {
        filteredQuestions = attempt.detailed.filter(q => q.selected && !q.isCorrect);
    } else if (activeTab === 'skipped') {
        filteredQuestions = attempt.detailed.filter(q => !q.selected);
    }

    return (
        <div className="min-h-screen bg-background dark:bg-[#020817] relative">
            {showConfetti && <Suspense fallback={null}><Confetti width={width} height={height} recycle={false} numberOfPieces={500} gravity={0.15} /></Suspense>}

            {/* Premium Background Pattern */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 35c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 1.79 4 4 4zm57 43c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm-23-1gl1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM46 9c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zm24 76c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8zM32 74c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zm36-40c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6zM44 70c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 1.79 4 4 4z' fill='%239C92AC' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")` }} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
                <ResponseHeader
                    quizTitle={quiz.title || quiz.name || 'Quiz Results'}
                    quizSubject={(quiz.subjects && quiz.subjects[0]) || quiz.subject || 'General'}
                    studentProfile={studentProfile}
                    remark={remark}
                    remarkColor={remarkColor}
                    isAdmin={isAdmin}
                    studentIdParam={studentIdParam}
                />

                <ResponseStats stats={stats} />

                {/* Tabs */}
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

                <div className="space-y-6">
                    {activeTab === 'subjects' ? (
                        <SubjectAnalysis subjectStats={stats.subjectAnalysis} />
                    ) : (
                        <div className="flex flex-col gap-6">
                            {filteredQuestions.length > 0 ? (
                                filteredQuestions.map((q, idx) => (
                                    <ResponseQuestionCard
                                        key={idx}
                                        index={idx}
                                        question={q}
                                        showSubject={true}
                                        isSaved={savedQuestions.has(q.questionId)}
                                        onSave={handleSaveToFlashcards}
                                        onReport={openReportModal}
                                    />
                                ))
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

            <ReportIssueDialog
                open={reportModalOpen}
                onOpenChange={setReportModalOpen}
                reportIssue={reportIssue}
                setReportIssue={setReportIssue}
                onSubmit={handleReportSubmit}
                isReporting={isReporting}
            />

            <UpgradeDialog
                open={upgradeDialogOpen}
                onOpenChange={setUpgradeDialogOpen}
            />
        </div>
    );
};

// Wrap in Suspense as before
const UserResponsesPage = () => {
    return (
        <ErrorBoundary>
            <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen bg-background"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
                <UserResponsesPageContent />
            </React.Suspense>
        </ErrorBoundary>
    );
};

export default UserResponsesPage;
