'use client';

import React from 'react';
import { BookOpen, TrendingUp, Award } from 'lucide-react';
import { ResultsStats } from '@/hooks/useStudentResults';

interface ResultsStatsCardProps {
    stats: ResultsStats;
}

export function ResultsStatsCard({ stats }: ResultsStatsCardProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Quizzes</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                    </div>
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Average Score</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avgScore}%</p>
                    </div>
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                        <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Perfect Scores</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
                    </div>
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                </div>
            </div>
        </div>
    );
}
