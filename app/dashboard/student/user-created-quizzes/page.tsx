'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles, FileQuestion } from 'lucide-react';
import { UnifiedHeader } from '@/components/unified-header';
import { Skeleton } from '@/components/ui/skeleton';

import { useUserQuizzes } from '@/hooks/useUserQuizzes';
import { UserQuizStats } from '@/components/user-quizzes/UserQuizStats';
import { UserQuizCard } from '@/components/user-quizzes/UserQuizCard';

const UserCreatedQuizzesPage = () => {
  const router = useRouter();
  const { loading, quizzes, attempts, stats } = useUserQuizzes();

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl p-6 h-48 border border-blue-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <Skeleton className="h-8 w-2/3 mb-4 rounded-lg bg-gray-200 dark:bg-slate-800" />
              <Skeleton className="h-4 w-1/2 mb-8 rounded bg-gray-100 dark:bg-slate-800" />
              <div className="flex gap-4">
                <Skeleton className="h-20 w-24 rounded-2xl bg-gray-50 dark:bg-slate-800" />
                <Skeleton className="h-20 w-24 rounded-2xl bg-gray-50 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <UnifiedHeader
        title="Your Quizzes"
        subtitle="Manage and track your custom test collection"
        icon={<Sparkles className="w-6 h-6" />}
      >
        <Button
          onClick={() => router.push('/quiz/create-mock')}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 border-0"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create New Quiz
        </Button>
      </UnifiedHeader>

      <div className="relative max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-12">
          <UserQuizStats
            total={stats.total}
            completed={stats.completed}
            inProgress={stats.inProgress}
          />
        </div>

        {/* Quiz Grid */}
        {quizzes.length === 0 ? (
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl p-10 text-center shadow-xl border border-blue-100 dark:border-slate-800">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-3xl opacity-50"></div>
            <div className="relative">
              <div className="inline-flex p-6 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-3xl mb-6 shadow-lg">
                <FileQuestion className="h-16 w-16 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Quizzes Yet</h3>
              <p className="text-gray-600 dark:text-gray-400 text-base mb-8 max-w-md mx-auto">
                Start your learning journey by creating your first custom quiz
              </p>
              <Button
                onClick={() => router.push('/quiz/create-mock')}
                className="group relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 border-0"
              >
                <div className="relative flex items-center gap-2 font-semibold text-base">
                  <Plus className="h-5 w-5" />
                  Create Your First Quiz
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {quizzes.map((q) => (
              <UserQuizCard
                key={q.id}
                quiz={q}
                attempt={attempts[q.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserCreatedQuizzesPage;
