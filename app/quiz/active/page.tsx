'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sidebar } from '@/components/ui/sidebar';
import {
  Clock,
  Play,
  Pause,
  BookOpen,
  Timer,
  AlertCircle,
  CheckCircle,
  User,
  Bell,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ActiveQuizzes() {
  const router = useRouter();


  const activeQuizzes = [
    {
      id: 1,
      title: 'Physics - Mechanics & Motion',
      course: 'MDCAT',
      subject: 'Physics',
      totalQuestions: 50,
      completedQuestions: 25,
      timeRemaining: '45:30',
      totalTime: '90:00',
      status: 'in-progress',
      startedAt: '2024-01-15 10:30 AM',
      lastSaved: '2 minutes ago',
      currentQuestion: 26,
      markedForReview: 3,
      difficulty: 'Medium'
    },
    {
      id: 2,
      title: 'Chemistry - Organic Compounds',
      course: 'MDCAT',
      subject: 'Chemistry',
      totalQuestions: 40,
      completedQuestions: 0,
      timeRemaining: '75:00',
      totalTime: '75:00',
      status: 'not-started',
      startedAt: null,
      lastSaved: null,
      currentQuestion: 1,
      markedForReview: 0,
      difficulty: 'Hard'
    }
  ];

  const formatTime = (timeString: string) => {
    const [minutes, seconds] = timeString.split(':').map(Number);
    const totalMinutes = minutes;
    const totalSeconds = seconds;

    if (totalMinutes < 10) {
      return { time: timeString, color: 'text-red-600', urgent: true };
    } else if (totalMinutes < 30) {
      return { time: timeString, color: 'text-yellow-600', urgent: false };
    } else {
      return { time: timeString, color: 'text-green-600', urgent: false };
    }
  };

  const getProgressPercentage = (completed: number, total: number) => {
    return (completed / total) * 100;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Active Quizzes</h1>
              <p className="text-gray-600">Continue your ongoing assessments</p>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
              </Button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="hidden md:block">
                  <div className="text-sm font-semibold text-gray-900">Ahmad Hassan</div>
                  <div className="text-xs text-gray-500">MDCAT Student</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeQuizzes.length > 0 ? (
            <div className="space-y-6">
              {activeQuizzes.map((quiz) => {
                const timeInfo = formatTime(quiz.timeRemaining);
                const progress = getProgressPercentage(quiz.completedQuestions, quiz.totalQuestions);

                return (
                  <Card key={quiz.id} className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-xl font-bold text-gray-900 mb-2">
                            {quiz.title}
                          </CardTitle>
                          <div className="flex items-center space-x-3">
                            <Badge variant="secondary">{quiz.course}</Badge>
                            <Badge variant="outline">{quiz.subject}</Badge>
                            <Badge className={
                              quiz.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                                quiz.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                            }>
                              {quiz.difficulty}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-3xl font-bold ${timeInfo.color} flex items-center space-x-2`}>
                            <Timer className="h-6 w-6" />
                            <span>{timeInfo.time}</span>
                          </div>
                          <p className="text-sm text-gray-600">Time Remaining</p>
                          {timeInfo.urgent && (
                            <div className="flex items-center text-red-600 text-sm mt-1">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span>Urgent!</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Progress Section */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Progress</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {quiz.completedQuestions}/{quiz.totalQuestions} questions
                          </span>
                        </div>
                        <Progress value={progress} className="h-3" />
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{progress.toFixed(1)}% completed</span>
                          <span>{quiz.totalQuestions - quiz.completedQuestions} remaining</span>
                        </div>
                      </div>

                      {/* Quiz Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="bg-blue-50 p-3 rounded-lg text-center">
                          <div className="font-semibold text-blue-900">{quiz.currentQuestion}</div>
                          <div className="text-blue-700">Current Question</div>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded-lg text-center">
                          <div className="font-semibold text-yellow-900">{quiz.markedForReview}</div>
                          <div className="text-yellow-700">Marked for Review</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg text-center">
                          <div className="font-semibold text-green-900">{quiz.completedQuestions}</div>
                          <div className="text-green-700">Answered</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-center">
                          <div className="font-semibold text-gray-900">{quiz.totalTime}</div>
                          <div className="text-gray-700">Total Time</div>
                        </div>
                      </div>

                      {/* Status Information */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {quiz.status === 'in-progress' ? (
                            <>
                              <div>
                                <span className="text-gray-600">Started at:</span>
                                <span className="ml-2 font-medium">{quiz.startedAt}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Last saved:</span>
                                <span className="ml-2 font-medium text-green-600">{quiz.lastSaved}</span>
                              </div>
                            </>
                          ) : (
                            <div className="col-span-2">
                              <div className="flex items-center text-blue-600">
                                <AlertCircle className="h-4 w-4 mr-2" />
                                <span>Quiz not started yet. Click &quot;Start Quiz&quot; to begin.</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-3">
                        {quiz.status === 'in-progress' ? (
                          <>
                            <Button className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                              <Link href={`/quiz/${quiz.id}`}>
                                <Play className="h-4 w-4 mr-2" />
                                Continue Quiz
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Link>
                            </Button>
                            <Button variant="outline" className="h-12 px-6 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-medium">
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Auto-Save
                            </Button>
                          </>
                        ) : (
                          <Button className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                            <Link href={`/quiz/${quiz.id}`}>
                              <Play className="h-4 w-4 mr-2" />
                              Start Quiz
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Clock className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active quizzes</h3>
              <p className="text-gray-600 mb-6">You don&apos;t have any ongoing quizzes at the moment.</p>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                <Link href="/quiz/available">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Browse Available Quizzes
                </Link>
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}