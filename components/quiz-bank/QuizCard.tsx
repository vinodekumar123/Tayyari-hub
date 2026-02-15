'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, Calendar, Play, ArrowRight, Lock } from 'lucide-react';
import { Quiz } from '@/types/index';
import { QuizStatusBadge } from './QuizStatusBadge';
import { getQuizStatus } from '@/lib/date-utils';
import { glassmorphism, animations } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface QuizCardProps {
    quiz: Quiz;
    attemptCount: number;
    onClick: (quiz: Quiz) => void;
}

export function QuizCard({ quiz, attemptCount, onClick }: QuizCardProps) {
    const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
    const canAttempt = attemptCount < (quiz.maxAttempts || 1);
    const isPremium = quiz.accessType === 'paid';

    // Format Series Name safely
    const seriesName = quiz.seriesName || (Array.isArray(quiz.series) ? 'Linked Series' : '');

    return (
        <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#004AAD]/5 to-[#00B4D8]/5 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <Card className={cn(
                "relative border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-lg group-hover:scale-[1.02] transition-transform duration-300",
                glassmorphism.light
            )}>
                <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                        <QuizStatusBadge status={status} />
                        {isPremium && (
                            <Badge variant="secondary" className="bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                Premium
                            </Badge>
                        )}
                    </div>

                    <CardTitle className="text-xl font-black text-foreground line-clamp-2">
                        {quiz.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                        {quiz.description || "No description available."}
                    </p>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <BookOpen className="w-4 h-4" />
                            <span>{quiz.selectedQuestions?.length || 0} Qs</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            <span>{quiz.duration} min</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(quiz.startDate).toLocaleDateString()}</span>
                            {quiz.endDate && (
                                <span className="text-xs text-red-400 ml-1">
                                    (Ends {new Date(quiz.endDate).toLocaleDateString()})
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={cn(glassmorphism.medium, "p-3 rounded-xl border border-[#004AAD]/10 space-y-2 text-sm")}>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Course:</span>
                            <span className="font-semibold text-foreground truncate max-w-[120px]">
                                {typeof quiz.course === 'object' ? quiz.course.name : quiz.course}
                            </span>
                        </div>
                        {seriesName && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Series:</span>
                                <span className="font-semibold text-foreground truncate max-w-[120px]" title={seriesName}>
                                    {seriesName}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Attempts:</span>
                            <span className={cn("font-semibold", attemptCount >= (quiz.maxAttempts || 1) ? "text-red-500" : "text-green-500")}>
                                {attemptCount} / {quiz.maxAttempts || 1}
                            </span>
                        </div>
                    </div>

                    <Button
                        className={cn(
                            "w-full transition-all",
                            status === 'active' && canAttempt
                                ? "bg-gradient-to-r from-[#00B4D8] to-[#66D9EF] text-white hover:opacity-90"
                                : ""
                        )}
                        disabled={status !== 'active' || !canAttempt}
                        onClick={() => onClick(quiz)}
                    >
                        {status === 'active' && canAttempt ? (
                            <>
                                <Play className="w-4 h-4 mr-2" />
                                {attemptCount > 0 ? 'Retake Quiz' : 'Start Quiz'}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        ) : (
                            <>
                                <Lock className="w-4 h-4 mr-2" />
                                {status === 'upcoming' ? 'Coming Soon' : status === 'ended' ? 'Expired' : 'Max Attempts Reached'}
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
