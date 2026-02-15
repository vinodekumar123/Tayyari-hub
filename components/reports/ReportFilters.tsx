'use client';

import React from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { glassmorphism } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface ReportFiltersProps {
    statusFilter: 'all' | 'pending' | 'resolved' | 'ignored';
    subjectFilter: string;
    subjects: string[];
    onStatusChange: (status: 'all' | 'pending' | 'resolved' | 'ignored') => void;
    onSubjectChange: (subject: string) => void;
    onReset: () => void;
}

export function ReportFilters({
    statusFilter,
    subjectFilter,
    subjects,
    onStatusChange,
    onSubjectChange,
    onReset
}: ReportFiltersProps) {
    return (
        <div className={cn(glassmorphism.light, "p-5 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between")}>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Filter className="w-4 h-4" />
                </div>
                <span>Filter Reports:</span>
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <div className="relative">
                    <select
                        value={statusFilter}
                        onChange={(e) => onStatusChange(e.target.value as any)}
                        className="appearance-none pl-4 pr-10 py-2.5 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer min-w-[140px]"
                    >
                        <option value="all" className="dark:bg-gray-900">All Status</option>
                        <option value="pending" className="dark:bg-gray-900">Pending</option>
                        <option value="resolved" className="dark:bg-gray-900">Resolved</option>
                        <option value="ignored" className="dark:bg-gray-900">Ignored</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>

                <div className="relative">
                    <select
                        value={subjectFilter}
                        onChange={(e) => onSubjectChange(e.target.value)}
                        className="appearance-none pl-4 pr-10 py-2.5 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer min-w-[140px]"
                    >
                        <option value="all" className="dark:bg-gray-900">All Subjects</option>
                        {subjects.map(sub => (
                            <option key={sub} value={sub} className="dark:bg-gray-900">{sub}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>

                {(statusFilter !== 'all' || subjectFilter !== 'all') && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onReset}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl h-[42px] px-4"
                    >
                        Reset Filters
                    </Button>
                )}
            </div>
        </div>
    );
}
