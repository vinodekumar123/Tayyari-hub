'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardSkeleton } from '@/components/ui/skeleton-cards';
import dynamic from 'next/dynamic';
import {
  Trophy, RefreshCw, ClipboardList, Clock,
  CheckCircle, Zap, BrainCircuit, GraduationCap, AlertTriangle,
  ArrowUpRight, Sparkles, Layers
} from 'lucide-react';

// Lazy load heavy components
const LazyPerformanceChart = dynamic(
  () => import('@/components/dashboard/PerformanceChart'),
  { ssr: false, loading: () => <div className="h-[350px] w-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" /> }
);
const LazyEnrollmentPopup = dynamic(
  () => import('@/components/student/EnrollmentPromptPopup').then(m => ({ default: m.EnrollmentPromptPopup })),
  { ssr: false }
);
const LazyFeaturePopup = dynamic(
  () => import('@/components/student/FeatureAnnouncementPopup').then(m => ({ default: m.FeatureAnnouncementPopup })),
  { ssr: false }
);

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { UnifiedHeader } from '@/components/unified-header';
import { useStudentDashboard } from '@/hooks/useStudentDashboard';

export default function StudentDashboard() {
  const {
    loading,
    studentData,
    recentQuizzes,
    unfinishedQuizzes,
    questionStats,
    stats,
    performanceTrendData,
    subjectBreakdownAdmin,
    subjectBreakdownUser,
    refresh,
  } = useStudentDashboard();

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
      {/* Lazy-loaded popups — don't block initial render */}
      <LazyEnrollmentPopup />
      <LazyFeaturePopup />

      {/* Header */}
      <UnifiedHeader
        greeting
        studentName={studentData?.fullName}
        subtitle="Manage your progress and quizzes here."
      />

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">

        {/* Action Buttons */}
        <div className="flex justify-end items-center gap-3 mb-8 -mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            title="Refresh Stats"
            className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-transform active:scale-95 text-xs text-muted-foreground"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Refresh
          </Button>
          <Link href="/dashboard/leaderboard">
            <Button variant="ghost" size="sm" className="gap-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:-translate-y-0.5 text-xs text-slate-600 dark:text-slate-400">
              <Trophy className="w-3 h-3 text-amber-500" />
              Leaderboard
            </Button>
          </Link>
          <Link href="/quiz/create-mock">
            <Button size="default" className="gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 border-0 px-6">
              <Zap className="w-4 h-4" />
              New Quiz
            </Button>
          </Link>
        </div>

        {/* Unfinished Quizzes Alert */}
        {unfinishedQuizzes.length > 0 && (
          <div className="grid gap-3 mb-8 animate-in fade-in duration-500">
            {unfinishedQuizzes.map((quiz) => (
              <div key={quiz.id} className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/50 shadow-sm">
                <div className="flex items-center gap-4 mb-3 sm:mb-0">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">Unfinished: {quiz.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">You have unsaved progress waiting for you.</p>
                  </div>
                </div>
                <Link href={quiz.quizType === 'user' ? `/quiz/start-user-quiz?id=${quiz.id}` : `/quiz/start?id=${quiz.id}`}>
                  <Button size="sm" className="rounded-full bg-amber-500 hover:bg-amber-600 text-white border-none shadow-md shadow-amber-500/20">
                    Resume Quiz <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Main Stats Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Quizzes</CardTitle>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalQuizzes}</div>
              <p className="text-xs text-slate-500 mt-1 font-medium">Tests Taken</p>
            </CardContent>
          </Card>

          {/* Question Bank Stats Card */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Question Bank</CardTitle>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 transition-colors">
                <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                {questionStats.total > 0
                  ? `${Math.round((questionStats.used / questionStats.total) * 100)}%`
                  : '—'}
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-amber-500 h-full transition-all duration-700" style={{ width: `${questionStats.total > 0 ? (questionStats.used / questionStats.total) * 100 : 0}%` }}></div>
              </div>
              <p className="text-xs text-slate-500 mt-2 flex justify-between">
                <span>{questionStats.used.toLocaleString()} Used</span>
                <span className="text-emerald-600">{(questionStats.total - questionStats.used).toLocaleString()} Left</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Questions Solved</CardTitle>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 transition-colors">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.totalQuestions}</div>
              <p className="text-xs text-slate-500 mt-1">Across all subjects</p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 group">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Overall Accuracy</CardTitle>
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 transition-colors">
                <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.overallAccuracy}%</div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${stats.overallAccuracy}%` }}></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Admin Analytics */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </span>
                Official Exams
              </CardTitle>
              <CardDescription>Performance in mandatory tests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Attempts</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.adminAttempts ?? stats.totalQuizzes ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Accuracy</p>
                  <p className={`text-2xl font-bold ${(stats.adminAccuracy ?? stats.overallAccuracy ?? 0) >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {stats.adminAccuracy ?? stats.overallAccuracy ?? 0}%
                  </p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Correct</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-500">{stats.adminCorrect ?? stats.totalCorrect ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Wrong</span>
                  <span className="font-bold text-red-500 dark:text-red-400">{stats.adminWrong ?? stats.totalWrong ?? 0}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${stats.adminAccuracy ?? stats.overallAccuracy ?? 0}%` }}></div>
                  <div className="bg-red-500 h-full transition-all duration-700" style={{ width: `${100 - (stats.adminAccuracy ?? stats.overallAccuracy ?? 0)}%` }}></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Analytics */}
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 dark:bg-pink-900/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="p-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                  <BrainCircuit className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                </span>
                Custom Practice
              </CardTitle>
              <CardDescription>Performance in self-made tests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Attempts</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.userAttempts ?? stats.totalMockQuizzes ?? 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Accuracy</p>
                  <p className={`text-2xl font-bold ${(stats.userAccuracy ?? stats.mockAccuracy ?? 0) >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {stats.userAccuracy ?? stats.mockAccuracy ?? 0}%
                  </p>
                </div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Correct</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-500">{stats.userCorrect ?? stats.totalMockCorrect ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Wrong</span>
                  <span className="font-bold text-red-500 dark:text-red-400">
                    {stats.userWrong ?? (stats.totalMockQuestions && stats.totalMockCorrect ? stats.totalMockQuestions - stats.totalMockCorrect : 0)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                  <div className="bg-emerald-500 h-full transition-all duration-700" style={{ width: `${stats.userAccuracy ?? stats.mockAccuracy ?? 0}%` }}></div>
                  <div className="bg-red-500 h-full transition-all duration-700" style={{ width: `${100 - (stats.userAccuracy ?? stats.mockAccuracy ?? 0)}%` }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Subject Wise Breakdown */}
          <div className="lg:col-span-2">
            {/* Subject Breakdown: Official */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Official Subject Performance</CardTitle>
                    <CardDescription>Breakdown by subject for official exams</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                      <tr>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4 text-center">Attempted</th>
                        <th className="py-3 px-4 text-center">Correct</th>
                        <th className="py-3 px-4 text-center">Wrong</th>
                        <th className="py-3 px-4 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {subjectBreakdownAdmin.length > 0 ? (
                        subjectBreakdownAdmin.map((sub, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-200">{sub.subject}</td>
                            <td className="py-3 px-4 text-center text-slate-500 dark:text-slate-400">{sub.attempted}</td>
                            <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-500 font-medium">{sub.correct}</td>
                            <td className="py-3 px-4 text-center text-red-500 dark:text-red-400">{sub.wrong}</td>
                            <td className="py-3 px-4 text-right">
                              <Badge className={
                                sub.accuracy >= 80 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" :
                                  sub.accuracy >= 50 ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" :
                                    "bg-red-100 text-red-700 hover:bg-red-200 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                              } variant="outline">
                                {sub.accuracy}%
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            No official exam data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Subject Breakdown: Custom */}
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                    <BrainCircuit className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Custom Practice Performance</CardTitle>
                    <CardDescription>Breakdown by subject for self-created quizzes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium">
                      <tr>
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4 text-center">Attempted</th>
                        <th className="py-3 px-4 text-center">Correct</th>
                        <th className="py-3 px-4 text-center">Wrong</th>
                        <th className="py-3 px-4 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {subjectBreakdownUser.length > 0 ? (
                        subjectBreakdownUser.map((sub, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-200">{sub.subject}</td>
                            <td className="py-3 px-4 text-center text-slate-500 dark:text-slate-400">{sub.attempted}</td>
                            <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-500 font-medium">{sub.correct}</td>
                            <td className="py-3 px-4 text-center text-red-500 dark:text-red-400">{sub.wrong}</td>
                            <td className="py-3 px-4 text-right">
                              <Badge className={
                                sub.accuracy >= 80 ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" :
                                  sub.accuracy >= 50 ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800" :
                                    "bg-red-100 text-red-700 hover:bg-red-200 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                              } variant="outline">
                                {sub.accuracy}%
                              </Badge>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            No custom practice data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {recentQuizzes.length > 0 ? (
                    recentQuizzes.map((quiz, i) => (
                      <div key={i} className="group flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800/50 cursor-pointer">
                        <div className={`p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-105 ${quiz.quizType === 'user' ? 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'}`}>
                          {quiz.quizType === 'user' ? <BrainCircuit className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-0.5">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate pr-2 max-w-[150px]">
                              {quiz.title}
                            </h4>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${quiz.score / quiz.total >= 0.7 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {Math.round((quiz.score / quiz.total) * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>{quiz.submittedAt?.toDate ? quiz.submittedAt.toDate().toLocaleDateString() : 'Just now'}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            <span className="capitalize">{quiz.quizType === 'user' ? 'Custom' : 'Admin'}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-center">
                      <Clock className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-sm">No recent activity.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Charts Section - Full Width Trend */}
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Trophy className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </span>
                Performance Trend
              </CardTitle>
              <CardDescription>Track your scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <LazyPerformanceChart data={performanceTrendData} />
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
            &copy; 2026 TayyariHub. All progress is automatically saved.
          </div>
        </div>

      </div>
    </div>
  );
}