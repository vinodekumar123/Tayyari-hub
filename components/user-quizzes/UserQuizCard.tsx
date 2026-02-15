'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileQuestion, Clock, PlayCircle, CheckCircle2, RotateCw } from 'lucide-react';
import { UserCreatedQuiz, QuizAttemptStatus } from '@/hooks/useUserQuizzes';
import { useRouter } from 'next/navigation';

interface UserQuizCardProps {
    quiz: UserCreatedQuiz;
    attempt?: QuizAttemptStatus;
}

const getQuizAttemptStatus = (attempt?: QuizAttemptStatus) => {
    if (!attempt)
        return {
            label: 'Start Quiz',
            color: 'blue',
            icon: <PlayCircle className="h-4 w-4" />,
            action: 'start',
            bgGradient: 'from-blue-500 to-indigo-600',
        };
    if (attempt.completed)
        return {
            label: 'Completed',
            color: 'emerald',
            icon: <CheckCircle2 className="h-4 w-4" />,
            bgGradient: 'from-emerald-500 to-teal-600',
        };
    if (attempt.startedAt)
        return {
            label: 'Resume',
            color: 'amber',
            icon: <RotateCw className="h-4 w-4" />,
            action: 'resume',
            bgGradient: 'from-amber-500 to-orange-600',
        };
    return {
        label: 'Start Quiz',
        color: 'blue',
        icon: <PlayCircle className="h-4 w-4" />,
        action: 'start',
        bgGradient: 'from-blue-500 to-indigo-600',
    };
};

export function UserQuizCard({ quiz, attempt }: UserQuizCardProps) {
    const router = useRouter();
    const status = getQuizAttemptStatus(attempt);

    return (
        <div className="group relative bg-white dark:bg-slate-900/50 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] border border-gray-100 dark:border-slate-800">
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/10 dark:via-indigo-900/10 dark:to-purple-900/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="relative">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                            {quiz.name}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-4 py-1.5 rounded-xl font-semibold">
                                {quiz.subject}
                            </Badge>
                            {quiz.chapters && quiz.chapters.length > 0 && (
                                <Badge className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 px-4 py-1.5 rounded-xl font-semibold">
                                    {quiz.chapters.join(', ')}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-900/30">
                        <div className="p-2.5 bg-blue-200 dark:bg-blue-900/50 rounded-xl shadow-sm">
                            <FileQuestion className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide">Questions</p>
                            <p className="text-gray-900 dark:text-gray-100 text-2xl font-bold">{quiz.questionCount}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-900/30">
                        <div className="p-2.5 bg-purple-200 dark:bg-purple-900/50 rounded-xl shadow-sm">
                            <Clock className="h-5 w-5 text-purple-700 dark:text-purple-300" />
                        </div>
                        <div>
                            <p className="text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide">Duration</p>
                            <p className="text-gray-900 dark:text-gray-100 text-2xl font-bold">{quiz.duration} min</p>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                {status.action ? (
                    <Button
                        onClick={() =>
                            router.push(
                                status.action === 'resume'
                                    ? `/quiz/start-user-quiz?id=${quiz.id}`
                                    : `/quiz/start-user-quiz?id=${quiz.id}`
                            )
                        }
                        className={`w-full bg-gradient-to-r ${status.bgGradient} hover:opacity-90 text-white py-6 rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 border-0 font-bold text-base`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            {status.icon}
                            {status.label}
                        </div>
                    </Button>
                ) : (
                    <div className={`w-full bg-gradient-to-r ${status.bgGradient} text-white py-6 rounded-2xl shadow-xl flex items-center justify-center gap-2 font-bold text-base`}>
                        {status.icon}
                        {status.label}
                    </div>
                )}

                {/* Footer */}
                <p className="text-gray-400 text-xs mt-4 text-center font-medium">
                    Created {quiz.createdAt?.toDate
                        ? quiz.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : new Date(quiz.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
            </div>
        </div>
    );
}
