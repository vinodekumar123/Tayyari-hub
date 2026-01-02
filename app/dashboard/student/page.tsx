'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/app/firebase';
import { doc, getDoc, collection, query, limit, getDocs, orderBy, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sidebar } from '@/components/ui/sidebar';
import { DashboardSkeleton } from '@/components/ui/skeleton-cards';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar
} from 'recharts';
import {
  Trophy, Medal, RefreshCw, Activity, ClipboardList, Clock,
  CheckCircle, Zap, Target, BookOpen, ChevronRight, TrendingUp, PlayCircle, AlertTriangle, CalendarDays,
  LayoutDashboard,
  GraduationCap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ScheduleViewer } from '@/components/dashboard/ScheduleViewer';
import { ScheduleNotificationManager } from '@/components/dashboard/ScheduleNotificationManager';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function StudentDashboard() {
  const [greeting, setGreeting] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [studentData, setStudentData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentQuizzes, setRecentQuizzes] = useState<any[]>([]);
  const [unfinishedQuizzes, setUnfinishedQuizzes] = useState<any[]>([]);

  const [seriesStats, setSeriesStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const [selectedScheduleSeries, setSelectedScheduleSeries] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

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

        // Fetch recent quizzes for trend analysis
        const recentSnap = await getDocs(query(
          collection(db, 'users', uid, 'quizAttempts'),
          orderBy('submittedAt', 'desc'),
          limit(500) // Fetch up to 500 for accurate "All Time" stats
        ));
        const allAttempts = recentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRecentQuizzes(allAttempts.slice(0, 10)); // Keep top 10 for list

        // Fetch Unfinished Quizzes
        const unfinishedSnap = await getDocs(query(
          collection(db, 'users', uid, 'quizAttempts'),
          where('completed', '==', false),
          limit(5)
        ));

        const unfinished = await Promise.all(unfinishedSnap.docs.map(async (d) => {
          const data = d.data();
          let title = data.title;
          if (!title) {
            try {
              const qDoc = await getDoc(doc(db, 'quizzes', d.id));
              if (qDoc.exists()) title = qDoc.data().title;
            } catch (e) { console.error("Failed to fetch quiz title", e); }
          }
          return { id: d.id, ...data, title: title || 'Untitled Quiz' };
        }));
        setUnfinishedQuizzes(unfinished);

        // --- SERIES ANALYTICS LOGIC ---
        // 1. Fetch All Series
        const seriesSnap = await getDocs(collection(db, 'series'));
        const allSeries = seriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 2. Fetch All Quizzes (to map Course -> Quiz)
        const quizzesSnap = await getDocs(collection(db, 'quizzes'));
        const allQuizzes = quizzesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Process Stats per Series
        const newSeriesStats = allSeries.map((series: any) => {
          // Find quizzes for this series (via courseId)
          const seriesQuizzes = allQuizzes.filter((q: any) => {
            const cId = typeof q.course === 'object' ? q.course.id : q.course;
            return cId === series.courseId;
          });

          const seriesQuizIds = new Set(seriesQuizzes.map(q => q.id));

          // Find user attempts for these quizzes using ALL attempts
          const relevantAttempts = allAttempts.filter((a: any) => seriesQuizIds.has(a.id));

          const attemptedCount = relevantAttempts.length;
          const totalQuizzesInSeries = seriesQuizzes.length;
          const totalScore = relevantAttempts.reduce((acc, curr: any) => acc + (curr.score || 0), 0);
          const totalMaxScore = relevantAttempts.reduce((acc, curr: any) => acc + (curr.total || 0), 0);

          const accuracy = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

          return {
            id: series.id,
            name: series.name,
            year: series.year,
            attempted: attemptedCount,
            total: totalQuizzesInSeries,
            accuracy: accuracy,
            progress: totalQuizzesInSeries > 0 ? Math.round((attemptedCount / totalQuizzesInSeries) * 100) : 0
          };
        });

        setSeriesStats(newSeriesStats);

        // 4. Calculate Overall Stats (Client-Side for Realtime Accuracy)
        const totalQuizzesTaken = allAttempts.length;
        const totalScoreAll = allAttempts.reduce((acc, curr: any) => acc + (curr.score || 0), 0);
        const totalMaxScoreAll = allAttempts.reduce((acc, curr: any) => acc + (curr.total || 0), 0);
        const calcOverallAccuracy = totalMaxScoreAll > 0 ? Math.round((totalScoreAll / totalMaxScoreAll) * 100) : 0;

        const totalQuestionsAll = allAttempts.reduce((acc, curr: any) => acc + (curr.totalQuestions || 0), 0);

        setRealtimeStats({
          totalQuizzes: totalQuizzesTaken,
          totalQuestions: totalQuestionsAll || data?.stats?.totalQuestions || 0,
          overallAccuracy: calcOverallAccuracy,
          totalCorrect: allAttempts.reduce((acc, curr: any) => acc + (curr.correctAnswers || curr.correct || 0), 0)
        });

      } catch (err) {
        console.error(err);
        toast.error('Error loading dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid]);

  const [realtimeStats, setRealtimeStats] = useState({
    totalQuizzes: 0,
    totalQuestions: 0,
    overallAccuracy: 0,
    totalCorrect: 0
  });

  const stats = {
    totalQuizzes: 0,
    totalMockQuizzes: 0,
    totalQuestions: 0,
    totalMockQuestions: 0,
    totalCorrect: 0,
    totalMockCorrect: 0,
    overallAccuracy: 0,
    ...studentData?.stats,
    ...realtimeStats,
    subjectStats: studentData?.stats?.subjectStats || {}
  };

  // --- BADGE LOGIC ---
  const badges = [
    { name: 'Rookie', check: stats.totalQuizzes >= 1, description: 'Completed your first quiz' },
    { name: 'Dedicated', check: stats.totalQuizzes >= 10, description: 'Completed 10+ quizzes' },
    { name: 'Sharpshooter', check: stats.overallAccuracy >= 90 && stats.totalQuizzes >= 5, description: '90%+ Accuracy' },
    { name: 'Elite', check: stats.totalQuizzes >= 50, description: 'Completed 50+ quizzes' },
    { name: 'Scholar', check: (stats.totalQuestions + (stats.totalMockQuestions || 0)) >= 500, description: 'Solved 500+ questions' },
  ].filter(b => b.check);

  // --- Data Transformations for Charts ---

  // 1. Radar Chart Data: Subject Strengths
  const radarData = useMemo(() => {
    return Object.entries(stats.subjectStats || {})
      .map(([subject, s]: [string, any]) => ({
        subject,
        A: s.accuracy || 0,
        fullMark: 100
      }))
      .sort((a, b) => b.A - a.A)
      .slice(0, 6); // Top 6 subjects for cleaner radar
  }, [stats.subjectStats]);

  // 2. Area Chart Data: Recent Performance Trend
  const performanceTrendData = useMemo(() => {
    return [...recentQuizzes]
      .reverse() // Oldest first for the line chart
      .map((q, i) => ({
        name: `Q${i + 1}`,
        score: parseFloat(((q.score / q.total) * 100).toFixed(1)),
        title: q.title || 'Untitled'
      }));
  }, [recentQuizzes]);

  // 3. Bar Chart: Correct vs Wrong (Top Subjects)
  const barChartData = useMemo(() => {
    return Object.entries(stats.subjectStats || {})
      .map(([subject, s]: [string, any]) => ({
        name: subject,
        correct: s.correct || 0,
        wrong: (s.attempted || 0) - (s.correct || 0)
      }))
      .sort((a, b) => (b.correct + b.wrong) - (a.correct + a.wrong))
      .slice(0, 5);
  }, [stats.subjectStats]);


  const refreshStats = () => {
    if (uid) {
      window.location.reload();
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
      <ScheduleNotificationManager />

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {greeting}, {studentData?.fullName?.split(' ')[0] || 'Student'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Welcome back to your learning dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshStats}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/dashboard/leaderboard">
              <Button variant="outline" className="gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Leaderboard
              </Button>
            </Link>
            <Link href="/admin/quizzes/quizebank">
              <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <PlayCircle className="h-4 w-4" />
                Start New Quiz
              </Button>
            </Link>
          </div>
        </div>

        {/* Unfinished Quizzes Alert */}
        {unfinishedQuizzes.length > 0 && (
          <div className="grid gap-3">
            {unfinishedQuizzes.map((quiz) => (
              <div key={quiz.id} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-500">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100">Unfinished Quiz: {quiz.title}</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300">You have unsaved progress.</p>
                  </div>
                </div>
                <Link href={`/quiz/start?id=${quiz.id}`}>
                  <Button variant="secondary" size="sm" className="bg-amber-100 hover:bg-amber-200 text-amber-800 border-transparent dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-200">
                    Resume Quiz
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Quizzes
              </CardTitle>
              <ClipboardList className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQuizzes + stats.totalMockQuizzes}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.totalQuizzes} Admin • {stats.totalMockQuizzes} Custom
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Questions Solved
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQuestions + stats.totalMockQuestions}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {stats.totalCorrect + stats.totalMockCorrect} Correct Answers
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Average Accuracy
              </CardTitle>
              <Target className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overallAccuracy}%</div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 mt-2">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${stats.overallAccuracy}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Achievements
              </CardTitle>
              <Medal className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{badges.length}</div>
              <div className="flex gap-1 mt-2 overflow-hidden">
                {badges.length > 0 ? (
                  badges.slice(0, 5).map((b, i) => (
                    <div key={i} className="h-1.5 w-1.5 rounded-full bg-yellow-500" title={b.name} />
                  ))
                ) : (
                  <span className="text-xs text-gray-400">No badges yet</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                Performance Trend
              </CardTitle>
              <CardDescription>Your score history over the last 10 quizzes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" domain={[0, 100]} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <Activity className="h-10 w-10 mb-2 opacity-20" />
                    <p>No enough data provided yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subject Radar */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-pink-500" />
                Subject Strengths
              </CardTitle>
              <CardDescription>Your accuracy by subject</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Accuracy" dataKey="A" stroke="#ec4899" strokeWidth={2} fill="#ec4899" fillOpacity={0.2} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <Target className="h-10 w-10 mb-2 opacity-20" />
                    <p>Take quizzes to see strengths</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Series Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Series Progress</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {seriesStats.map((series) => (
              <Card key={series.id} className="shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-semibold truncate pr-2" title={series.name}>
                      {series.name}
                    </CardTitle>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                      {series.year}
                    </span>
                  </div>
                  <CardDescription>
                    {series.attempted} of {series.total} quizzes completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Average Score</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{series.accuracy}%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all"
                        style={{ width: `${series.progress}%` }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 p-0 h-auto font-medium"
                      onClick={() => setSelectedScheduleSeries({ id: series.id, name: series.name })}
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      View Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {seriesStats.length === 0 && (
              <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                <GraduationCap className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 font-medium">No series enrollments found</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Accuracy Breakdown */}
          <Card className="lg:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Accuracy by Subject
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} />
                      <Bar dataKey="correct" name="Correct" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={20} />
                      <Bar dataKey="wrong" name="Wrong" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <p>No data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentQuizzes.length > 0 ? (
                  recentQuizzes.map((q, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-800">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-lg ${q.quizType === 'user' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20'}`}>
                          {q.quizType === 'user' ? <ClipboardList className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs">{q.title || `Quiz #${q.attemptNumber}`}</h4>
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            {q.submittedAt?.toDate ? q.submittedAt.toDate().toLocaleDateString() : 'Just now'}
                            <span>•</span>
                            <span className={q.score / q.total >= 0.7 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                              {Math.round((q.score / q.total) * 100)}% Score
                            </span>
                          </p>
                        </div>
                      </div>
                      <Link href={`/admin/students/results`}>
                        <Button variant="ghost" size="sm" className="hidden sm:flex" >
                          View
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {selectedScheduleSeries && (
        <ScheduleViewer
          isOpen={!!selectedScheduleSeries}
          onClose={() => setSelectedScheduleSeries(null)}
          seriesId={selectedScheduleSeries.id}
          seriesName={selectedScheduleSeries.name}
        />
      )}
    </div>
  );
}