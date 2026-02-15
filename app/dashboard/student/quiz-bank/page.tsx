'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import { useUIStore } from '@/stores/useUIStore';
import { TableSkeleton } from '@/components/ui/skeleton-cards';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Files, BookOpen } from 'lucide-react';
import { UnifiedHeader } from '@/components/unified-header';
import { glassmorphism } from '@/lib/design-tokens';
import { toast } from 'sonner';

// New Modular Components & Hook
import { useQuizBank } from '@/hooks/useQuizBank';
import { QuizCard } from '@/components/quiz-bank/QuizCard';
// import { QuizStatusBadge } from '@/components/quiz-bank/QuizStatusBadge'; // Built-in to Card now
import { QuizFilters } from '@/components/quiz-bank/QuizFilters';
import { getQuizStatus } from '@/lib/date-utils';
import { Quiz } from '@/types/index';

export default function StudentQuizBankPage() {
    const router = useRouter();
    const { user } = useUserStore();
    const {
        quizzes,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        filters,
        setFilters,
        seriesList,
        attemptedQuizzes,
        missingIndexUrl
    } = useQuizBank();

    const [showPremiumDialog, setShowPremiumDialog] = useState(false);

    // Filter Logic (Client-side refinement of the fetched list)
    const filteredQuizzes = useMemo(() => {
        return quizzes.filter((quiz) => {
            const matchesSearch = !filters.search ||
                (quiz.title || '').toLowerCase().includes(filters.search.toLowerCase());

            // Status check
            const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
            const matchesStatus = filters.status === 'all' || status === filters.status;

            const matchesSeries = filters.series === 'all' || (quiz.series && quiz.series.includes(filters.series));

            return matchesSearch && matchesStatus && matchesSeries;
        });
    }, [quizzes, filters]);

    const handleQuizClick = (quiz: Quiz) => {
        if (!user) return;

        if (user?.role === 'admin' || (user as any)?.admin) {
            router.push(`/quiz/start?id=${quiz.id}`);
            return;
        }

        const userPlan = (user as any)?.plan;

        // Premium Check
        if (userPlan === 'free' && quiz.accessType === 'paid') {
            setShowPremiumDialog(true);
            return;
        }

        router.push(`/quiz/start?id=${quiz.id}`);
    };

    if (loading && quizzes.length === 0) {
        return (
            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="h-48 rounded-3xl bg-muted animate-pulse mb-8" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[280px] rounded-2xl border bg-card p-6 space-y-4">
                            <Skeleton className="h-40 w-full rounded-xl" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background font-sans">
            <UnifiedHeader
                title="My Quiz Bank"
                subtitle={`${filteredQuizzes.length} quizzes available from your enrolled series`}
                icon={<Files className="w-6 h-6" />}
            />

            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* Missing Index Alert - Only visible to admin users */}
                {missingIndexUrl && user?.role === 'admin' && (
                    <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1">
                                <h3 className="font-bold text-lg mb-1">System Configuration Required</h3>
                                <p className="text-sm mb-3">Administrator action needed to optimize database performance.</p>
                                <a href={missingIndexUrl} target="_blank" rel="noopener noreferrer" className="underline font-bold">Fix Now</a>
                            </div>
                        </div>
                    </div>
                )}

                <QuizFilters
                    filters={filters}
                    onChange={setFilters}
                    seriesList={seriesList}
                />

                {/* Quiz Grid */}
                {filteredQuizzes.length === 0 ? (
                    <div className="text-center py-16">
                        <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <p className="text-xl font-semibold text-muted-foreground">No quizzes found</p>
                        <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredQuizzes.map(quiz => {
                            // Inject Series Name mapping only for display if needed
                            // (The hook populates seriesList, we can map it here or in Card)
                            const sNames = seriesList.filter(s => quiz.series?.includes(s.id)).map(s => s.name).join(', ');
                            const quizWithSeriesName = { ...quiz, seriesName: sNames };

                            return (
                                <QuizCard
                                    key={quiz.id}
                                    quiz={quizWithSeriesName}
                                    attemptCount={attemptedQuizzes[quiz.id] || 0}
                                    onClick={handleQuizClick}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Load More */}
                {hasMore && (
                    <div className="flex justify-center mt-8">
                        <Button onClick={loadMore} disabled={loadingMore} className="px-6 py-2">
                            {loadingMore ? 'Loading...' : 'Load more quizzes'}
                        </Button>
                    </div>
                )}

                {/* Premium Dialog */}
                <Dialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog}>
                    <DialogContent className={`${glassmorphism.medium} border-[#004AAD]/20`}>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] to-[#0066FF]">
                                Premium Required
                            </DialogTitle>
                            <DialogDescription>
                                This quiz requires a premium subscription. Upgrade now to access all premium content!
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowPremiumDialog(false)}>Cancel</Button>
                            <Button className="bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white" onClick={() => router.push('/pricing')}>Upgrade Now</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
