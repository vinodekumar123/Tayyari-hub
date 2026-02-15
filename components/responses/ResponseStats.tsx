'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target, BarChart3, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ResponseStatsProps {
    score: number;
    totalQuestions: number;
    wrongAnswers: number;
    skippedQuestions: number;
    percentage: number;
}

export function ResponseStats({ score, totalQuestions, wrongAnswers, skippedQuestions, percentage }: ResponseStatsProps) {
    const stats = [
        { label: 'Score', value: `${score}/${totalQuestions}`, color: 'text-primary', bg: 'bg-primary/10', icon: Target },
        { label: 'Percentage', value: `${percentage.toFixed(1)}%`, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100/50 dark:bg-purple-900/20', icon: BarChart3 },
        { label: 'Correct', value: score, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100/50 dark:bg-green-900/20', icon: CheckCircle },
        { label: 'Wrong', value: wrongAnswers, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100/50 dark:bg-red-900/20', icon: XCircle },
        { label: 'Skipped', value: skippedQuestions, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100/50 dark:bg-yellow-900/20', icon: Clock },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
            {stats.map((stat, i) => (
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
    );
}
