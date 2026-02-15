'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Clock, BookOpen, CheckCircle, XCircle, Circle } from 'lucide-react';

interface ResponseStatsProps {
    stats: {
        score: number;
        total: number;
        percentage: number;
        correct: number;
        wrong: number;
        skipped: number;
        timeTaken: number;
    };
}

export function ResponseStats({ stats }: ResponseStatsProps) {
    const formatTime = (seconds: number) => {
        if (!seconds || seconds <= 0) return 'N/A';
        return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    };

    const items = [
        { label: 'Accuracy', value: `${stats.percentage}%`, icon: Target, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
        { label: 'Time Spent', value: formatTime(stats.timeTaken), icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
        { label: 'Total Questions', value: stats.total, icon: BookOpen, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
        { label: 'Correct', value: stats.correct, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
        { label: 'Wrong', value: stats.wrong, icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
        { label: 'Skipped', value: stats.skipped, icon: Circle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
            {items.map((stat, i) => (
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
    );
}
