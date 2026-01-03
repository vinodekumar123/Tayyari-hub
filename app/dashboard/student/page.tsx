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
  GraduationCap,
  Sparkles,
  Sun, Moon
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ScheduleViewer } from '@/components/dashboard/ScheduleViewer';
import { ScheduleNotificationManager } from '@/components/dashboard/ScheduleNotificationManager';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-slate-950 dark:to-slate-900 transition-colors duration-300">
      <ScheduleNotificationManager />

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">

        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              {greeting === 'Good Morning' && <Sun className="w-8 h-8 text-amber-500 fill-amber-500/20" />}
              {greeting === 'Good Afternoon' && <Sun className="w-8 h-8 text-orange-500 fill-orange-500/20" />}
              {greeting === 'Good Evening' && <Moon className="w-8 h-8 text-indigo-500 fill-indigo-500/20" />}
              <span>{greeting},</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
                {(studentData?.fullName && typeof studentData.fullName === 'string') ? studentData.fullName.split(' ')[0] : 'Scholar'}
              </span>
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 font-medium">
              You are doing great! Ready to learn something new today?
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshStats}
              title="Refresh Stats"
              className="rounded-xl hover:bg-white hover:shadow-md transition-all dark:hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Link href="/dashboard/leaderboard">
              <Button variant="outline" className="gap-2 rounded-xl border-amber-200 bg-amber-50/50 hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-900/10 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-500 hover:shadow-sm transition-all">
                <Trophy className="h-4 w-4" />
                Leaderboard
              </Button>
            </Link>
            <Link href="/admin/quizzes/quizebank">
              <Button className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg hover:shadow-indigo-500/25 rounded-xl transition-all duration-300 hover:scale-105">
                <PlayCircle className="h-4 w-4 fill-white/20" />
                Start New Quiz
              </Button>
            </Link>
          </div>
        </div>

        {/* Alerts Section */}
        {unfinishedQuizzes.length > 0 && (
          <div className="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-500 delay-100">
            {unfinishedQuizzes.map((quiz) => (
              <div key={quiz.id} className="group bg-white dark:bg-slate-900/50 border border-amber-200 dark:border-amber-900/50 p-1 rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm text-amber-500 ring-4 ring-amber-50 dark:ring-amber-900/20">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {quiz.title}
                        <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">In Progress</Badge>
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">You have unsaved progress waiting for you.</p>
                    </div>
                  </div>
                  <Link href={`/quiz/start?id=${quiz.id}`}>
                    <Button className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-amber-500/20">
                      Resume Now
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-700 delay-150">

          <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white dark:bg-slate-900 ring-1 ring-gray-100 dark:ring-slate-800">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Quizzes
              </CardTitle>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                <ClipboardList className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{stats.totalQuizzes + stats.totalMockQuizzes}</div>
              <p className="text-xs font-semibold text-indigo-600/80 dark:text-indigo-400/80 bg-indigo-50 dark:bg-indigo-900/20 inline-block px-2 py-1 rounded-md">
                {stats.totalQuizzes} Admin • {stats.totalMockQuizzes} Custom
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white dark:bg-slate-900 ring-1 ring-gray-100 dark:ring-slate-800">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Questions Solved
              </CardTitle>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{stats.totalQuestions + stats.totalMockQuestions}</div>
              <p className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-50 dark:bg-emerald-900/20 inline-block px-2 py-1 rounded-md">
                {Math.round((stats.overallAccuracy / 100) * (stats.totalQuestions + stats.totalMockQuestions))} Correct
              </p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white dark:bg-slate-900 ring-1 ring-gray-100 dark:ring-slate-800">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Avg. Accuracy
              </CardTitle>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <Target className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{stats.overallAccuracy}%</div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${stats.overallAccuracy}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden rounded-2xl border-0 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white dark:bg-slate-900 ring-1 ring-gray-100 dark:ring-slate-800">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Achievements
              </CardTitle>
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                <Medal className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black text-gray-900 dark:text-white mb-1">{badges.length}</div>
              <div className="flex gap-1 mt-2">
                {badges.slice(0, 5).map((b, i) => (
                  <div key={i} className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-800" title={b.name} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Performance Chart */}
          <Card className="lg:col-span-2 border-0 shadow-sm ring-1 ring-gray-100 dark:ring-slate-800 rounded-2xl bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-left-4 duration-700 delay-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-500" />
                    Performance Trend
                  </CardTitle>
                  <CardDescription>Your score consistency over time</CardDescription>
                </div>
                <Badge variant="outline" className="hidden sm:flex border-indigo-100 bg-indigo-50 text-indigo-700">Last 10 Quizzes</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {performanceTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={performanceTrendData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" domain={[0, 100]} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderRadius: '12px',
                          border: 'none',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                          padding: '12px'
                        }}
                        itemStyle={{ color: '#4f46e5', fontWeight: 600 }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full">
                      <Activity className="h-8 w-8 opacity-40" />
                    </div>
                    <p className="font-medium">No quiz data available yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subject Radar */}
          <Card className="lg:col-span-1 border-0 shadow-sm ring-1 ring-gray-100 dark:ring-slate-800 rounded-2xl bg-white dark:bg-slate-900 animate-in fade-in slide-in-from-right-4 duration-700 delay-200">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Target className="h-5 w-5 text-pink-500" />
                Subject Mastery
              </CardTitle>
              <CardDescription>Top performing subjects</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Accuracy" dataKey="A" stroke="#ec4899" strokeWidth={2} fill="#ec4899" fillOpacity={0.2} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full">
                      <Target className="h-8 w-8 opacity-40" />
                    </div>
                    <p className="font-medium">Take quizzes to see analytics</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Series Section */}
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              Your Series
            </h2>
            <Link href="/dashboard/study">
              <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                View All Content <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {seriesStats.map((series) => (
              <Card key={series.id} className="group border-0 shadow-sm ring-1 ring-gray-100 dark:ring-slate-800 rounded-2xl bg-white dark:bg-slate-900 hover:shadow-lg hover:ring-indigo-100 dark:hover:ring-indigo-900 transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base font-bold truncate pr-2 text-gray-800 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={series.name}>
                      {series.name}
                    </CardTitle>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded-md">
                      {series.year}
                    </span>
                  </div>
                  <CardDescription className="font-medium">
                    {series.attempted} of {series.total} quizzes completed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm items-end">
                      <span className="text-gray-500 font-medium">Avg Score</span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{series.accuracy}<span className="text-sm text-gray-400 font-normal">%</span></span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all group-hover:bg-indigo-600"
                        style={{ width: `${series.progress}%` }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full justify-center group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-200 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-300 dark:group-hover:border-indigo-800 transition-all rounded-xl"
                      onClick={() => setSelectedScheduleSeries({ id: series.id, name: series.name })}
                    >
                      <CalendarDays className="h-4 w-4 mr-2" />
                      Check Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {seriesStats.length === 0 && (
              <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                <div className="inline-flex p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-4">
                  <GraduationCap className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Series Enrolled</h3>
                <p className="text-gray-500 mt-1 mb-4">Enroll in a series to start tracking your progress</p>
                <Link href="/pricing">
                  <Button>Browse Packages</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Accuracy Breakdown */}
          <Card className="lg:col-span-1 border-0 shadow-sm ring-1 ring-gray-100 dark:ring-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                Accuracy Split
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="correct" name="Correct" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24} />
                      <Bar dataKey="wrong" name="Wrong" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={24} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-full">
                      <LayoutDashboard className="h-6 w-6 opacity-40" />
                    </div>
                    <p className="font-medium text-sm">No data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2 border-0 shadow-sm ring-1 ring-gray-100 dark:ring-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentQuizzes.length > 0 ? (
                  recentQuizzes.map((q, i) => (
                    <div key={i} className="group flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all duration-200 cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-slate-700">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl transition-colors ${q.quizType === 'user' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:bg-blue-100' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 group-hover:bg-indigo-100'}`}>
                          {q.quizType === 'user' ? <ClipboardList className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate max-w-[180px] sm:max-w-xs">{q.title || `Quiz #${q.attemptNumber}`}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500 font-medium">{q.submittedAt?.toDate ? q.submittedAt.toDate().toLocaleDateString() : 'Just now'}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${q.score / q.total >= 0.7 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {Math.round((q.score / q.total) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link href={`/admin/students/results`}>
                        <div className="p-2 rounded-full text-gray-400 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-gray-400">
                    <HistoryIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">No recent activity</p>
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

function HistoryIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
      <path d="M3 3v9h9" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}