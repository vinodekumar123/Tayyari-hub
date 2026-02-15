'use client';

import React from 'react';
import { BookOpen, CheckCircle2, TrendingUp } from 'lucide-react';

interface UserQuizStatsProps {
    total: number;
    completed: number;
    inProgress: number;
}

export function UserQuizStats({ total, completed, inProgress }: UserQuizStatsProps) {
    if (total === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-blue-100 dark:border-slate-800">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-semibold uppercase tracking-wide">Total Quizzes</span>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                    <p className="text-5xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">{total}</p>
                </div>
            </div>

            <div className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-emerald-100 dark:border-slate-800">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-semibold uppercase tracking-wide">Completed</span>
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        </div>
                    </div>
                    <p className="text-5xl font-bold bg-gradient-to-br from-emerald-600 to-teal-600 bg-clip-text text-transparent">{completed}</p>
                </div>
            </div>

            <div className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-amber-100 dark:border-slate-800">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-600 dark:text-gray-400 text-sm font-semibold uppercase tracking-wide">In Progress</span>
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                            <TrendingUp className="h-5 w-5 text-amber-600" />
                        </div>
                    </div>
                    <p className="text-5xl font-bold bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-transparent">{inProgress}</p>
                </div>
            </div>
        </div>
    );
}
