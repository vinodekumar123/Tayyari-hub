'use client';

import React from 'react';
import { UnifiedHeader } from '@/components/unified-header';
import { Flag, CheckCircle } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import { useStudentReports } from '@/hooks/useStudentReports';
import { ReportCard } from '@/components/reports/ReportCard';
import { ReportFilters } from '@/components/reports/ReportFilters';

export default function StudentReportsPage() {
    const {
        filteredReports,
        loading,
        subjects,
        statusFilter,
        subjectFilter,
        setStatusFilter,
        setSubjectFilter,
        resetFilters,
        reports // Needed? Yes for checking if empty state is "no results" or "no reports at all"
    } = useStudentReports();

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6 md:p-12">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
                        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse" />
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white dark:bg-white/5 rounded-xl h-64 border border-gray-100 dark:border-white/10 animate-pulse shadow-sm p-6 space-y-4">
                            <div className="h-6 w-1/3 bg-gray-100 dark:bg-white/10 rounded" />
                            <div className="h-24 w-full bg-gray-50 dark:bg-white/5 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background">
            <UnifiedHeader
                title="Reported Questions"
                subtitle="Track the status of your reported issues and view admin replies."
                icon={<Flag className="w-6 h-6" />}
            />
            <div className="max-w-5xl mx-auto space-y-8 p-6 md:p-12">

                {/* Filters */}
                <ReportFilters
                    statusFilter={statusFilter}
                    subjectFilter={subjectFilter}
                    subjects={subjects}
                    onStatusChange={setStatusFilter}
                    onSubjectChange={setSubjectFilter}
                    onReset={resetFilters}
                />

                {filteredReports.length === 0 ? (
                    <div className={cn(glassmorphism.light, "text-center py-20 rounded-2xl shadow-sm border border-white/20 dark:border-white/10")}>
                        <CheckCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 p-3 bg-gray-50 dark:bg-white/5 rounded-full" />
                        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">No Reports Found</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {reports.length > 0 ? "Try adjusting your filters." : "You haven't reported any questions yet."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredReports.map((report) => (
                            <ReportCard key={report.id} report={report} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
