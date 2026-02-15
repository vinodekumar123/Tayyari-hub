'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Calendar, ChevronRight } from 'lucide-react';
import { QuizResult } from '@/hooks/useStudentResults';
import { useRouter } from 'next/navigation';

interface ResultCardProps {
    result: QuizResult;
    studentId: string;
}

export function ResultCard({ result, studentId }: ResultCardProps) {
    const router = useRouter();

    const getScoreBadge = (score: number, total: number) => {
        const percentage = total > 0 ? (score / total) * 100 : 0;
        if (percentage >= 80) return { label: 'Excellent', color: 'bg-green-500' };
        if (percentage >= 60) return { label: 'Good', color: 'bg-blue-500' };
        if (percentage >= 40) return { label: 'Fair', color: 'bg-yellow-500' };
        return { label: 'Needs Work', color: 'bg-red-500' };
    };

    const badge = getScoreBadge(result.score, result.total);
    const percentage = result.total > 0 ? ((result.score / result.total) * 100).toFixed(0) : '0';
    const formattedDate = result.date ? result.date.toLocaleDateString('en-US', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    }) : 'N/A';

    return (
        <Card className="group hover:shadow-xl transition-all duration-300 border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="relative">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
                                {result.title}
                            </h3>
                            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                                {result.type === 'user' ? 'User Quiz' : (result.isMock ? 'By Own' : 'By Admin')}
                            </span>
                        </div>
                    </div>

                    {/* Score Circle */}
                    <div className="flex items-center gap-4">
                        <div className="relative w-20 h-20">
                            <svg className="w-20 h-20 transform -rotate-90">
                                <circle cx="40" cy="40" r="32" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                                <circle
                                    cx="40" cy="40" r="32"
                                    stroke="white" strokeWidth="6" fill="none"
                                    strokeDasharray={`${(result.score / (result.total || 1)) * 201} 201`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white font-bold text-lg">{percentage}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-white/90 text-sm">Score</p>
                            <p className="text-white font-bold text-2xl">{result.score}/{result.total}</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 ${badge.color} rounded-full text-xs text-white font-medium`}>
                                {badge.label}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                    <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Subject</p>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{result.subject}</p>
                    </div>
                </div>

                {result.chapter !== 'N/A' && (
                    <div className="flex items-start gap-2 text-sm">
                        <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-gray-500 dark:text-gray-400 text-xs">Chapter</p>
                            <p className="text-gray-900 dark:text-gray-100 font-medium">{result.chapter}</p>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Completed</p>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                            {formattedDate}
                        </p>
                    </div>
                </div>

                <Button
                    className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl h-12 group/btn"
                    onClick={() => {
                        if (result.type === 'admin') {
                            router.push(`/dashboard/student/responses?id=${result.id}&mock=${result.isMock}&studentId=${studentId}`);
                        } else {
                            router.push(`/dashboard/student/user-responses?id=${result.quizId}`);
                        }
                    }}
                >
                    View Responses
                    <ChevronRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
            </CardContent>
        </Card>
    );
}
