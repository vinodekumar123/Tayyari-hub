'use client';

import React from 'react';
import { UnifiedHeader } from '@/components/unified-header';
import { BarChart3, BookOpen } from 'lucide-react';
import { useStudentResults } from '@/hooks/useStudentResults';
import { ResultsStatsCard } from '@/components/results/ResultsStatsCard';
import { ResultsFilters } from '@/components/results/ResultsFilters';
import { ResultCard } from '@/components/results/ResultCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function UnifiedResultsPage() {
    const {
        userId,
        viewType, setViewType,
        loading,
        filteredResults,
        stats,
        search, setSearch,
        selectedSubject, setSelectedSubject,
        selectedChapter, setSelectedChapter,
        subjects,
        chapters,
    } = useStudentResults();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-300">
            {/* Header */}
            <UnifiedHeader
                title="Quiz Results Dashboard"
                subtitle="Track your progress and review your performance"
                icon={<BarChart3 className="w-6 h-6" />}
                backUrl="/dashboard/student"
            />

            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

                {/* Stats */}
                <ResultsStatsCard stats={stats} />

                {/* Filters */}
                <ResultsFilters
                    viewType={viewType} setViewType={setViewType}
                    search={search} setSearch={setSearch}
                    selectedSubject={selectedSubject} setSelectedSubject={setSelectedSubject}
                    selectedChapter={selectedChapter} setSelectedChapter={setSelectedChapter}
                    subjects={subjects} chapters={chapters}
                />

                {/* Results Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className="rounded-2xl border-gray-100 dark:border-slate-800 dark:bg-slate-900">
                                <CardHeader className="pb-4">
                                    <Skeleton className="h-6 w-3/4 mb-2 dark:bg-slate-800" />
                                    <Skeleton className="h-4 w-1/2 dark:bg-slate-800" />
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <Skeleton className="h-4 w-full dark:bg-slate-800" />
                                    <Skeleton className="h-4 w-2/3 dark:bg-slate-800" />
                                    <Skeleton className="h-10 w-full mt-4 dark:bg-slate-800" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : filteredResults.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-slate-800">
                        <div className="inline-flex p-4 bg-gray-100 dark:bg-slate-800 rounded-full mb-4">
                            <BookOpen className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">No results found</p>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Try adjusting your filters or search terms</p>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearch('');
                                setSelectedSubject('all');
                                setSelectedChapter('all');
                            }}
                            className="mt-4 border-gray-200 dark:border-slate-800 dark:text-gray-300 dark:hover:bg-slate-800"
                        >
                            Clear Filters
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredResults.map((result) => (
                            <ResultCard key={result.id} result={result} studentId={userId || ''} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
