'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from 'app/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, CheckCircle2, PlayCircle, RotateCw, BookOpen, Clock, FileQuestion, Sparkles, TrendingUp } from 'lucide-react';

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

const UserCreatedQuizzesPage = () => {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 blur-3xl opacity-30 animate-pulse"></div>
          <div className="relative flex items-center gap-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-8 py-6">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/20 border-t-blue-500"></div>
            <span className="font-semibold text-xl text-white">Loading your workspace...</span>
          </div>
        </div>
      </div>
    );

  const completedCount = Object.values(attempts).filter(a => a.completed).length;
  const inProgressCount = Object.values(attempts).filter(a => a.startedAt && !a.completed).length;
  const totalQuizzes = quizzes.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent">
                  Your Quizzes
                </h1>
              </div>
              <p className="text-slate-400 text-lg ml-14">Manage and track your custom test collection</p>
            </div>
            <Button
              onClick={() => router.push('/create-your-own-test')}
              className="group relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-6 rounded-2xl shadow-2xl shadow-blue-500/30 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/50 border-0"
            >
              <div className="absolute inset-0 bg-white/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative flex items-center gap-2 font-semibold text-lg">
                <Plus className="h-5 w-5" />
                Create New Quiz
              </div>
            </Button>
          </div>

          {/* Stats Cards */}
          {totalQuizzes > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="group relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm font-medium">Total Quizzes</span>
                    <BookOpen className="h-5 w-5 text-blue-400" />
                  </div>
                  <p className="text-4xl font-bold text-white">{totalQuizzes}</p>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm font-medium">Completed</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="text-4xl font-bold text-white">{completedCount}</p>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm font-medium">In Progress</span>
                    <TrendingUp className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="text-4xl font-bold text-white">{inProgressCount}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quiz Grid */}
        {quizzes.length === 0 ? (
          <div className="relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl"></div>
            <div className="relative">
              <div className="inline-flex p-6 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-3xl mb-6">
                <FileQuestion className="h-16 w-16 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">No Quizzes Yet</h3>
              <p className="text-slate-400 text-lg mb-8 max-w-md mx-auto">
                Start your learning journey by creating your first custom quiz
              </p>
              <Button
                onClick={() => router.push('/create-your-own-test')}
                className="group relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-6 rounded-2xl shadow-2xl shadow-blue-500/30 transition-all duration-300 hover:scale-105 border-0"
              >
                <div className="relative flex items-center gap-2 font-semibold text-lg">
                  <Plus className="h-5 w-5" />
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
                  className="group relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20"
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                          {q.name}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="bg-gradient-to-r from-blue-500/20 to-indigo-600/20 text-blue-300 border border-blue-400/30 px-3 py-1 rounded-xl font-medium">
                            {q.subject}
                          </Badge>
                          {q.chapters && q.chapters.length > 0 && (
                            <Badge className="bg-white/10 text-slate-300 border border-white/20 px-3 py-1 rounded-xl font-medium">
                              {q.chapters.join(', ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <FileQuestion className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-medium">Questions</p>
                          <p className="text-white text-xl font-bold">{q.questionCount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                          <Clock className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs font-medium">Duration</p>
                          <p className="text-white text-xl font-bold">{q.duration} min</p>
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
                        className={`w-full bg-gradient-to-r ${status.bgGradient} hover:opacity-90 text-white py-6 rounded-2xl shadow-xl transition-all duration-300 hover:scale-105 border-0 font-semibold text-base`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {status.icon}
                          {status.label}
                        </div>
                      </Button>
                    ) : (
                      <div className={`w-full bg-gradient-to-r ${status.bgGradient} text-white py-6 rounded-2xl shadow-xl flex items-center justify-center gap-2 font-semibold text-base`}>
                        {status.icon}
                        {status.label}
                      </div>
                    )}

                    {/* Footer */}
                    <p className="text-slate-500 text-xs mt-4 text-center">
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

export default UserCreatedQuizzesPage;
