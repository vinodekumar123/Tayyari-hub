'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/app/firebase';
import { doc, getDoc, collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Sidebar } from '@/components/ui/sidebar';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Trophy, Medal, CalendarDays, RefreshCw, Activity, ClipboardList, Clock, CheckCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function UltraFastStudentDashboard() {
  const [greeting, setGreeting] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('🌅 Good Morning');
    else if (hour < 17) setGreeting('🌤️ Good Afternoon');
    else setGreeting('🌙 Good Evening');

    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
      else setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        setStudentData(data);

        // Fetch just the 5 most recent quizzes for the list (no calculation needed)
        const recentSnap = await getDocs(query(
          collection(db, 'users', uid, 'quizAttempts'),
          orderBy('submittedAt', 'desc'),
          limit(5)
        ));
        setRecentQuizzes(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (err) {
        console.error(err);
        toast.error('Error loading dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid]);

  const stats = studentData?.stats || {
    totalQuizzes: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    overallAccuracy: 0,
    totalMockQuizzes: 0,
    totalMockQuestions: 0,
    totalMockCorrect: 0,
    mockAccuracy: 0,
    subjectStats: {}
  };

  const subjectChartData = useMemo(() => {
    return Object.entries(stats.subjectStats || {}).map(([subject, s]: [string, any]) => ({
      subject,
      accuracy: s.accuracy || 0,
      attempted: s.attempted || 0,
      correct: s.correct || 0
    })).sort((a, b) => b.accuracy - a.accuracy);
  }, [stats.subjectStats]);

  const refreshStats = () => {
    if (uid) {
      window.location.reload(); // Simplest way to refresh "server" state for now
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-tr from-white to-slate-100 flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 p-4 mt-8 sm:p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {greeting}, {studentData?.fullName || 'Student'}! 🚀
            </h1>
            <p className="text-gray-600 text-sm mt-1">Ready to ace your exams?</p>
          </div>
          <div className="flex gap-2">
            <button onClick={refreshStats} className="p-2 bg-white rounded-full shadow hover:bg-gray-50 text-gray-600">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <a href="/admin/quizzes/quizebank" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 shadow flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Take Quiz
            </a>
            <a href="/quiz/create-mock" className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Create Mock
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-lg transition-all border-none shadow-md bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Quizzes Taken</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalQuizzes + stats.totalMockQuizzes}</h3>
                <p className="text-xs text-indigo-600 mt-1 font-medium">
                  {stats.totalQuizzes} Admin • {stats.totalMockQuizzes} Custom
                </p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                <ClipboardList className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all border-none shadow-md bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Questions Solved</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalQuestions + stats.totalMockQuestions}</h3>
                <div className="flex gap-2 text-xs mt-1">
                  <span className="text-green-600 font-medium">{stats.totalCorrect + stats.totalMockCorrect} Correct</span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                <CheckCircle className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all border-none shadow-md bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Overall Accuracy</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.overallAccuracy}%</h3>
                <p className="text-xs text-gray-500 mt-1">Based on admin quizzes</p>
              </div>
              <div className="p-3 bg-green-50 rounded-full text-green-600">
                <Activity className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all border-none shadow-md bg-white">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mock Bank Used</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">
                  {studentData?.usedMockQuestionIds?.length || 0}
                </h3>
                <p className="text-xs text-orange-600 mt-1">Questions Attempted</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full text-orange-600">
                <Medal className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Subject Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-lg">
              <CardContent className="p-6">
                <h4 className="text-lg font-extrabold text-gray-900 mb-4">Subject Performance</h4>
                {subjectChartData.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={subjectChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="subject" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-400">
                    No subject data available yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjectChartData.slice(0, 4).map((sub: any) => (
                <div key={sub.subject} className="bg-white p-4 rounded-xl shadow border border-slate-100 flex justify-between items-center">
                  <div>
                    <h5 className="font-bold text-gray-800">{sub.subject}</h5>
                    <p className="text-xs text-gray-500">{sub.correct}/{sub.attempted} Correct</p>
                  </div>
                  <div className={`text-lg font-bold ${sub.accuracy >= 70 ? 'text-green-600' : sub.accuracy >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {sub.accuracy}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-lg h-full">
              <CardContent className="p-6">
                <h4 className="text-lg font-extrabold text-gray-900 mb-4">Recent Activity</h4>
                <div className="space-y-4">
                  {recentQuizzes.length > 0 ? (
                    recentQuizzes.map((q, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className={`p-2 rounded-lg ${q.quizType === 'user' ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                          {q.quizType === 'user' ? <ClipboardList className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {q.title || `Quiz #${q.attemptNumber}`}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {q.submittedAt?.toDate ? q.submittedAt.toDate().toLocaleDateString() : 'Just now'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="block text-sm font-bold text-gray-900">{q.score}/{q.total}</span>
                          <span className="text-xs text-gray-500">Score</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-10">No recent activity.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}