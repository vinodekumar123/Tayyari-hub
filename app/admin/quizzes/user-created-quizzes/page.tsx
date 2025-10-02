'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from 'app/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, RotateCw, CheckCircle, BookOpen, Clock, FileText, Sparkles, TrendingUp } from 'lucide-react';

interface UserCreatedQuiz {
  id: string;
  title: string;
  subjects: string[];
  chapters: string[];
  createdBy: string;
  duration: number;
  questionCount: number;
  createdAt: any;
  attempted?: boolean;
  startedAt?: Date | null;
  inProgress?: boolean;
}

const UserCreatedQuizzesPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<UserCreatedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'inProgress' | 'completed'>('all');

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
        for (const docSnap of snap.docs) {
          const d = docSnap.data();

          const attemptRef = doc(db, 'users', u.uid, 'user-quizattempts', docSnap.id);
          const attemptSnap = await getDoc(attemptRef);

          let attempted = false;
          let startedAt = null;
          let inProgress = false;
          if (attemptSnap.exists()) {
            const attemptData = attemptSnap.data();
            attempted = attemptData.completed === true;
            if (attemptData.startedAt) {
              startedAt =
                typeof attemptData.startedAt.toDate === 'function'
                  ? attemptData.startedAt.toDate()
                  : new Date(attemptData.startedAt);
            }
            if (startedAt && !attempted) {
              inProgress = true;
            }
          }
          list.push({
            id: docSnap.id,
            title: d.title || '',
            subjects: Array.isArray(d.subjects) ? d.subjects : d.subject ? [d.subject] : [],
            chapters: Array.isArray(d.chapters) ? d.chapters : [],
            createdBy: d.createdBy,
            duration: d.duration,
            questionCount: d.questionCount,
            createdAt: d.createdAt,
            attempted,
            startedAt,
            inProgress,
          });
        }
        setQuizzes(list);
      } catch (e) {
        console.error('Error loading user quizzes:', e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  const filteredQuizzes = quizzes.filter(q => {
    if (filter === 'all') return true;
    if (filter === 'pending') return !q.attempted && !q.inProgress;
    if (filter === 'inProgress') return q.inProgress;
    if (filter === 'completed') return q.attempted;
    return true;
  });

  const stats = {
    total: quizzes.length,
    pending: quizzes.filter(q => !q.attempted && !q.inProgress).length,
    inProgress: quizzes.filter(q => q.inProgress).length,
    completed: quizzes.filter(q => q.attempted).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-lg font-medium text-slate-700">Loading your quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                  Your Quizzes
                </h1>
              </div>
              <p className="text-blue-100 text-lg max-w-2xl">
                Create, manage, and track your custom quiz collection
              </p>
            </div>
            
            <Button
              onClick={() => router.push('/quiz/create-mock')}
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold rounded-2xl shadow-2xl px-8 py-6 text-lg transition-all duration-300 hover:scale-105 hover:shadow-white/20"
            >
              <Plus className="mr-2 h-6 w-6" /> Create New Quiz
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            {[
              { label: 'Total', value: stats.total, icon: BookOpen, color: 'bg-white/20' },
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-amber-500/20' },
              { label: 'In Progress', value: stats.inProgress, icon: RotateCw, color: 'bg-purple-500/20' },
              { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'bg-green-500/20' },
            ].map((stat, idx) => (
              <div
                key={idx}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="w-5 h-5 text-white/80" />
                  <span className="text-3xl font-bold">{stat.value}</span>
                </div>
                <p className="text-sm text-blue-100 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-3 mb-8">
          {[
            { key: 'all', label: 'All Quizzes', icon: FileText },
            { key: 'pending', label: 'Pending', icon: Clock },
            { key: 'inProgress', label: 'In Progress', icon: RotateCw },
            { key: 'completed', label: 'Completed', icon: CheckCircle },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
                filter === tab.key
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-white text-slate-600 hover:bg-slate-50 shadow-sm hover:scale-102'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quiz Grid */}
        {filteredQuizzes.length === 0 ? (
          <Card className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border-0">
            <CardContent>
              <div className="max-w-md mx-auto space-y-6">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto">
                  <BookOpen className="w-12 h-12 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">
                    {filter === 'all' ? 'No quizzes yet' : `No ${filter} quizzes`}
                  </h3>
                  <p className="text-slate-600">
                    {filter === 'all' 
                      ? 'Start your learning journey by creating your first quiz'
                      : `You don't have any ${filter} quizzes at the moment`}
                  </p>
                </div>
                {filter === 'all' && (
                  <Button
                    onClick={() => router.push('/quiz/create-mock')}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg px-8 py-6 text-lg hover:scale-105 transition-all duration-300"
                  >
                    <Plus className="mr-2 h-5 w-5" /> Create Your First Quiz
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredQuizzes.map((q, idx) => (
              <Card
                key={q.id}
                className="group relative overflow-hidden rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 bg-white border-0 hover:-translate-y-2"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${idx * 0.1}s both`
                }}
              >
                {/* Status Indicator */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                {/* Content */}
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {q.title || "Untitled Quiz"}
                      </CardTitle>
                      
                      {/* Status Badge */}
                      {q.attempted ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Completed
                        </div>
                      ) : q.inProgress ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-sm font-semibold animate-pulse">
                          <RotateCw className="w-3.5 h-3.5" />
                          In Progress
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Subjects & Chapters */}
                  <div className="space-y-2">
                    {q.subjects && q.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {q.subjects.map((subj, idx) => (
                          <Badge
                            key={subj + idx}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-0 font-medium text-xs"
                          >
                            {subj}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {q.chapters && q.chapters.length > 0 && (
                      <div className="text-sm text-slate-600 font-medium">
                        <span className="text-slate-400">Chapters:</span> {q.chapters.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Questions</p>
                        <p className="text-lg font-bold text-slate-900">{q.questionCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <Clock className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Duration</p>
                        <p className="text-lg font-bold text-slate-900">{q.duration}m</p>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <p className="text-xs text-slate-400">
                      Created {q.createdAt?.toDate
                        ? q.createdAt.toDate().toLocaleDateString()
                        : new Date(q.createdAt).toLocaleDateString()}
                    </p>
                    {q.startedAt && (
                      <p className="text-xs text-blue-600 font-medium">
                        Started {typeof q.startedAt === 'string'
                          ? q.startedAt
                          : q.startedAt.toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    {!q.attempted && !q.inProgress ? (
                      <Button
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 rounded-xl py-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                        onClick={() => router.push(`/quiz/start-user-quiz?id=${q.id}`)}
                      >
                        <Eye className="h-5 w-5 mr-2" /> Start Quiz
                      </Button>
                    ) : q.inProgress ? (
                      <Button
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 rounded-xl py-6 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                        onClick={() => router.push(`/quiz/start-user-quiz?id=${q.id}`)}
                      >
                        <RotateCw className="h-5 w-5 mr-2" /> Resume Quiz
                      </Button>
                    ) : (
                      <Button
                        className="w-full bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-xl py-6 font-semibold cursor-not-allowed"
                        disabled
                      >
                        <CheckCircle className="h-5 w-5 mr-2" /> Completed
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default UserCreatedQuizzesPage;
