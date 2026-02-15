'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface SubjectStat {
    subject: string;
    correct: number;
    wrong: number;
    skipped: number;
    total: number;
    percentage: number;
}

interface SubjectAnalysisProps {
    subjectStats: SubjectStat[];
}

export function SubjectAnalysis({ subjectStats }: SubjectAnalysisProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjectStats.map((stats, i) => (
                <Card key={i} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/50">
                    <div className={`h-1.5 w-full ${stats.percentage >= 70 ? 'bg-green-500' : stats.percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">{stats.subject}</h3>
                            <Badge variant="secondary" className="font-bold text-base px-2.5">
                                {Math.round(stats.percentage)}%
                            </Badge>
                        </div>
                        <div className="space-y-4">
                            <Progress value={stats.percentage} className="h-2 rounded-full" />
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center p-2 bg-green-50 dark:bg-green-900/10 rounded-lg">
                                    <p className="text-xs text-green-600 font-bold mb-0.5">{stats.correct}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Correct</p>
                                </div>
                                <div className="text-center p-2 bg-red-50 dark:bg-red-900/10 rounded-lg">
                                    <p className="text-xs text-red-600 font-bold mb-0.5">{stats.wrong}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Wrong</p>
                                </div>
                                <div className="text-center p-2 bg-muted rounded-lg">
                                    <p className="text-xs text-foreground font-bold mb-0.5">{stats.skipped}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-tighter">Skip</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
