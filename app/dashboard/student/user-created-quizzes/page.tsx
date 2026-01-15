'use client';
import ComingSoon from '@/components/ui/coming-soon';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/app/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, CheckCircle2, PlayCircle, RotateCw, BookOpen, Clock, FileQuestion, Sparkles, TrendingUp } from 'lucide-react';
import { UnifiedHeader } from '@/components/unified-header';

interface UserCreatedQuiz {
  id: string;
  name: string;
  subject: string;
  chapters: string[];
  createdBy: string;
  duration: number;
  questionCount: number;
  createdAt: any;
}

const getQuizAttemptStatus = (attempt?: { startedAt?: any, completed?: boolean }) => {
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

const UserCreatedQuizzesPageOriginal = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<UserCreatedQuiz[]>([]);
  const [attempts, setAttempts] = useState<Record<string, { startedAt?: any, completed?: boolean }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        router.push('/login');
        return;
      }
      try {
        const q = query(
          collection(db, 'user-quizzes'),
          where('createdBy', '==', u.uid)
        );
        const snap = await getDocs(q);
        const list: UserCreatedQuiz[] = [];
        const quizAttemptPromises: Promise<any>[] = [];

        snap.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            name: d.name,
            subject: d.subject,
            chapters: d.chapters || [],
            createdBy: d.createdBy,
            duration: d.duration,
            questionCount: d.questionCount,
            createdAt: d.createdAt,
          });
          if (u) {
            const attemptRef = doc(db, 'users', u.uid, 'user-quizattempts', docSnap.id);
            quizAttemptPromises.push(getDoc(attemptRef).then(attemptSnap => ({
              quizId: docSnap.id,
              attempt: attemptSnap.exists() ? attemptSnap.data() : null,
            })));
          }
        });

        setQuizzes(list);

        const attemptResults = await Promise.all(quizAttemptPromises);
        const attemptMap: Record<string, { startedAt?: any, completed?: boolean }> = {};
        attemptResults.forEach(({ quizId, attempt }) => {
          attemptMap[quizId] = attempt || {};
        });
        setAttempts(attemptMap);

      } catch (e) {
        console.error('Error loading user quizzes:', e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 blur-3xl opacity-20 animate-pulse"></div>
          <div className="relative flex items-center gap-4 bg-white shadow-2xl rounded-3xl px-10 py-8 border border-blue-100">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-100 border-t-blue-600"></div>
            <span className="font-semibold text-xl text-gray-800">Loading your workspace...</span>
          </div>
        </div>
      </div>
    );

  const completedCount = Object.values(attempts).filter(a => a.completed).length;
  const inProgressCount = Object.values(attempts).filter(a => a.startedAt && !a.completed).length;
  const totalQuizzes = quizzes.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-12">
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

          {/* Stats Cards */}
          {totalQuizzes > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-blue-100">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-600 text-sm font-semibold uppercase tracking-wide">Total Quizzes</span>
                    <div className="p-2 bg-blue-100 rounded-xl">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">{totalQuizzes}</p>
                </div>
              </div>

              <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-emerald-100">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-600 text-sm font-semibold uppercase tracking-wide">Completed</span>
                    <div className="p-2 bg-emerald-100 rounded-xl">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold bg-gradient-to-br from-emerald-600 to-teal-600 bg-clip-text text-transparent">{completedCount}</p>
                </div>
              </div>

              <div className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 border border-amber-100">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-600 text-sm font-semibold uppercase tracking-wide">In Progress</span>
                    <div className="p-2 bg-amber-100 rounded-xl">
                      <TrendingUp className="h-5 w-5 text-amber-600" />
                    </div>
                  </div>
                  <p className="text-5xl font-bold bg-gradient-to-br from-amber-600 to-orange-600 bg-clip-text text-transparent">{inProgressCount}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quiz Grid */}
        {quizzes.length === 0 ? (
          <div className="relative bg-white rounded-3xl p-16 text-center shadow-2xl border border-blue-100">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 rounded-3xl opacity-50"></div>
            <div className="relative">
              <div className="inline-flex p-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl mb-6 shadow-lg">
                <FileQuestion className="h-20 w-20 text-blue-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-3">No Quizzes Yet</h3>
              <p className="text-gray-600 text-lg mb-8 max-w-md mx-auto">
                Start your learning journey by creating your first custom quiz
              </p>
              <Button
                onClick={() => router.push('/create-your-own-test')}
                className="group relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-10 py-6 rounded-2xl shadow-xl shadow-blue-500/30 transition-all duration-300 hover:scale-105 border-0"
              >
                <div className="relative flex items-center gap-2 font-semibold text-lg">
                  <Plus className="h-6 w-6" />
                  Create Your First Quiz
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {quizzes.map((q) => {
              const attempt = attempts[q.id];
              const status = getQuizAttemptStatus(attempt);

              return (
                <div
                  key={q.id}
                  className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] border border-gray-100"
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-700 transition-colors">
                          {q.name}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border border-blue-200 px-4 py-1.5 rounded-xl font-semibold">
                            {q.subject}
                          </Badge>
                          {q.chapters && q.chapters.length > 0 && (
                            <Badge className="bg-gray-100 text-gray-700 border border-gray-200 px-4 py-1.5 rounded-xl font-semibold">
                              {q.chapters.join(', ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                        <div className="p-2.5 bg-blue-200 rounded-xl shadow-sm">
                          <FileQuestion className="h-5 w-5 text-blue-700" />
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Questions</p>
                          <p className="text-gray-900 text-2xl font-bold">{q.questionCount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                        <div className="p-2.5 bg-purple-200 rounded-xl shadow-sm">
                          <Clock className="h-5 w-5 text-purple-700" />
                        </div>
                        <div>
                          <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Duration</p>
                          <p className="text-gray-900 text-2xl font-bold">{q.duration} min</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    {status.action ? (
                      <Button
                        onClick={() =>
                          router.push(
                            status.action === 'resume'
                              ? `/user-quizzes/${q.id}/resume?id=${q.id}`
                              : `/user-quizzes/${q.id}/start?id=${q.id}`
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
                      Created {q.createdAt?.toDate
                        ? q.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : new Date(q.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default function UserCreatedQuizzesPage() { return <ComingSoon />; }
