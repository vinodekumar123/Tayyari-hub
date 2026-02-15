'use client';

import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SanitizedContent } from '@/components/SanitizedContent';
import { Clock, BookOpen, Layers, AlertCircle, MessageSquare, Check, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { glassmorphism } from '@/lib/design-tokens';
import { Report } from '@/types/index';
import { cn } from '@/lib/utils';
import { safeDate } from '@/lib/date-utils';

interface ReportCardProps {
    report: Report;
}

export function ReportCard({ report }: ReportCardProps) {
    const formattedDate = report.createdAt ? format(safeDate(report.createdAt), 'PPP p') : 'Just now';

    return (
        <Card className={cn(glassmorphism.light, "overflow-hidden border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 transition-all hover:shadow-xl")}>
            <CardHeader className="bg-white/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 pb-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="w-4 h-4" />
                            {formattedDate}
                        </div>
                        <Badge variant={report.status === 'resolved' ? 'default' : report.status === 'ignored' ? 'destructive' : 'secondary'}
                            className={cn(
                                "capitalize",
                                report.status === 'resolved' && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200",
                                report.status === 'pending' && "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200",
                                report.status === 'ignored' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200"
                            )}
                        >
                            {report.status}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Question Context</h3>
                        {(report.subject || report.topic) && (
                            <div className="flex gap-2 text-xs">
                                {report.subject && <Badge variant="outline" className="flex gap-1 items-center border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"><BookOpen className="w-3 h-3" /> {report.subject}</Badge>}
                                {report.topic && <Badge variant="outline" className="flex gap-1 items-center border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"><Layers className="w-3 h-3" /> {report.topic}</Badge>}
                            </div>
                        )}
                    </div>

                    {/* Question Text */}
                    <div className="p-5 bg-gray-50/50 dark:bg-black/20 rounded-xl border border-gray-200/60 dark:border-white/5">
                        {report.questionText ? (
                            <SanitizedContent
                                className="text-gray-900 dark:text-gray-100 font-medium text-lg leading-relaxed prose dark:prose-invert max-w-none"
                                content={report.questionText}
                            />
                        ) : (
                            <div className="text-gray-400 italic flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Question text unavailable
                            </div>
                        )}
                    </div>

                    {/* Options & Correct Answer */}
                    <div className="mt-4">
                        {report.options && report.options.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                                {report.options.map((opt, idx) => {
                                    const isCorrect = report.correctAnswer === opt;
                                    return (
                                        <div key={idx} className={cn(
                                            "p-3 rounded-lg border text-base flex items-center gap-3 transition-colors",
                                            isCorrect
                                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-300 font-medium ring-1 ring-green-200 dark:ring-green-900/50"
                                                : "bg-white/50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300"
                                        )}>
                                            {isCorrect
                                                ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                                : <div className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 flex-shrink-0" />
                                            }
                                            <SanitizedContent content={opt} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-4 bg-gray-50/50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-500 dark:text-gray-400 text-center">
                                No options recorded for this question
                            </div>
                        )}

                        {report.correctAnswer && (!report.options || report.options.length === 0) && (
                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium rounded-lg border border-green-100 dark:border-green-900/30 flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                <span>Correct Answer: {report.correctAnswer}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Your Report</h3>
                    {report.issue ? (
                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed bg-red-50/50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20">
                            {report.issue}
                        </p>
                    ) : (
                        <p className="text-gray-400 italic bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/10">
                            No description provided
                        </p>
                    )}
                </div>

                {report.adminReply && (
                    <div className="mt-6 pt-6 border-t border-dashed border-gray-200 dark:border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-gray-900 dark:text-gray-100">Admin Reply</h4>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">By {report.adminName || 'Admin'}</span>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/20">
                                    {report.adminReply}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
