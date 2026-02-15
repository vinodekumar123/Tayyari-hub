'use client';

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SanitizedContent } from '@/components/SanitizedContent';
import { CheckCircle, XCircle, Circle, Info, Clock, Flag, Bookmark } from 'lucide-react';
import { Question } from '@/hooks/useQuizResult';

interface QuestionCardProps {
    question: Question;
    index: number;
    userAnswer: string;
    showSubject?: boolean;
    isSaved: boolean;
    onReport: (q: Question) => void;
    onSave: (q: Question) => void;
}

export function QuestionCard({ question: q, index, userAnswer, showSubject, isSaved, onReport, onSave }: QuestionCardProps) {
    const isSkipped = !userAnswer || userAnswer === '';

    return (
        <Card className="mb-6 shadow-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
            <CardHeader className="dir-ltr rounded-t-lg bg-muted/30 border-b border-border/50 pb-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <CardTitle className="text-lg font-semibold text-foreground flex gap-2 items-start leading-relaxed w-full min-w-0">
                        <span className="text-primary font-bold min-w-[2.5rem] shrink-0">Q{index + 1}.</span>
                        <div className="flex-1 min-w-0 overflow-hidden">
                            <SanitizedContent className="break-words question-content" content={q.questionText} />
                            {q.graceMark && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded border border-yellow-200 font-normal inline-block">Grace Mark Awarded</span>}
                        </div>
                    </CardTitle>
                    <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        {isSkipped && !q.graceMark && (
                            <Badge variant="secondary" className="bg-yellow-100/50 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                                <Clock className="w-3 h-3 mr-1" />
                                Skipped
                            </Badge>
                        )}
                        {showSubject && q.subject && (
                            <Badge variant="outline" className="text-xs">
                                {q.subject}
                            </Badge>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 dark:bg-red-900/10 dark:hover:bg-red-900/30 dark:text-red-400 h-8 px-2"
                            onClick={() => onReport(q)}
                            title="Report Mistake"
                        >
                            <Flag className="w-4 h-4 mr-1.5" />
                            Report
                        </Button>
                        {isSaved ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled
                                className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 h-8 px-2 ml-2"
                            >
                                <CheckCircle className="w-4 h-4 mr-1.5" />
                                Saved
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 dark:bg-indigo-900/10 dark:hover:bg-indigo-900/30 dark:text-indigo-400 h-8 px-2 ml-2"
                                onClick={() => onSave(q)}
                                title="Save to Flashcards"
                            >
                                <Bookmark className="w-4 h-4 mr-1.5" />
                                Save
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 gap-3">
                    {q.options.map((opt, i) => {
                        const isSelected = opt === userAnswer;
                        const isAnswer = opt === q.correctAnswer;

                        let style = 'border-border bg-card hover:bg-accent/40 text-foreground';
                        let icon = <Circle className="text-muted-foreground w-4 h-4 mr-3" />;

                        if (q.graceMark) {
                            if (isAnswer) {
                                style = 'border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100';
                                icon = <CheckCircle className="text-yellow-500 w-5 h-5 mr-3" />;
                            }
                        } else {
                            if (isAnswer) {
                                style = 'border-green-500/50 bg-green-50/50 dark:bg-green-900/20 text-green-900 dark:text-green-100 shadow-[0_0_0_1px_rgba(34,197,94,0.2)]';
                                icon = <CheckCircle className="text-green-600 dark:text-green-400 w-5 h-5 mr-3" />;
                            } else if (isSelected && !isAnswer) {
                                style = 'border-red-500/50 bg-red-50/50 dark:bg-red-900/20 text-red-900 dark:text-red-100 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]';
                                icon = <XCircle className="text-red-600 dark:text-red-400 w-5 h-5 mr-3" />;
                            }
                        }

                        return (
                            <div
                                key={i}
                                className={`flex items-center p-4 rounded-xl border text-base font-medium transition-colors duration-200 ${style}`}
                            >
                                {icon}
                                <span className="flex-1">{String.fromCharCode(65 + i)}. {opt}</span>
                            </div>
                        );
                    })}
                </div>

                {q.explanation && (
                    <div className="mt-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
                        <Info className="h-5 w-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div className="leading-relaxed min-w-0 flex-1">
                            <span className="font-semibold block mb-1">Explanation:</span>
                            <SanitizedContent className="break-words" content={q.explanation} />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
