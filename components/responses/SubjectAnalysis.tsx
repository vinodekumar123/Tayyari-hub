'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SubjectStats } from '@/hooks/useQuizResult';

interface SubjectAnalysisProps {
    stats: SubjectStats[];
}

export function SubjectAnalysis({ stats }: SubjectAnalysisProps) {
    return (
        <div className="grid gap-6 md:grid-cols-2">
            {stats.map((s) => (
                <Card key={s.subject} className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300">
                    <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-bold">{s.subject}</CardTitle>
                            <Badge
                                className={`px-3 py-1 font-bold ${s.percentage >= 70
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : s.percentage >= 50
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                    }`}
                            >
                                {s.percentage.toFixed(1)}%
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-4 gap-2 text-center mb-6">
                            {[
                                { label: 'Total', value: s.total, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                                { label: 'Correct', value: s.correct, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                                { label: 'Wrong', value: s.wrong, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                                { label: 'Skip', value: s.skipped, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
                            ].map((item, idx) => (
                                <div key={idx} className={`p-2.5 rounded-lg ${item.bg}`}>
                                    <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                                    <p className="text-xs text-muted-foreground font-medium uppercase mt-1">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Stacked Progress Bar */}
                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                            <div style={{ width: `${(s.correct / s.total) * 100}%` }} className="h-full bg-green-500" />
                            <div style={{ width: `${(s.wrong / s.total) * 100}%` }} className="h-full bg-red-500" />
                            <div style={{ width: `${(s.skipped / s.total) * 100}%` }} className="h-full bg-yellow-400" />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-2 font-medium">
                            <span>Correct</span>
                            <span>Wrong</span>
                            <span>Skipped</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
