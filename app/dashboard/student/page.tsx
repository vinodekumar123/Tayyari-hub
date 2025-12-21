'use client';

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/app/firebase';
import { doc, getDoc, collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sidebar } from '@/components/ui/sidebar';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  RadialBarChart, RadialBar,
  BarChart, Bar
} from 'recharts';
import {
  Trophy, Medal, RefreshCw, Activity, ClipboardList, Clock,
  CheckCircle, Zap, Target, BookOpen, ChevronRight, TrendingUp
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

        // Fetch recent quizzes for trend analysis ( increased limit for better chart)
        const recentSnap = await getDocs(query(
          collection(db, 'users', uid, 'quizAttempts'),
          orderBy('submittedAt', 'desc'),
          limit(10)
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
        name: `Quiz ${i + 1}`,
        score: parseFloat(((q.score / q.total) * 100).toFixed(1)),
        title: q.title || 'Untitled'
      }));
  }, [recentQuizzes]);

  // 3. Radial Bar Data: Overall Accuracy
  const radialAccuracyData = useMemo(() => [
    {
      name: 'Accuracy',
      uv: stats.overallAccuracy,
      fill: '#8884d8'
    }
  ], [stats.overallAccuracy]);

  const style = {
    top: '50%',
    right: 0,
    transform: 'translate(0, -50%)',
    lineHeight: '24px',
  };

  // 4. Bar Chart: Correct vs Wrong (Top Subjects)
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

  return (
    <div className="flex min-h-screen bg-background flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 p-4 mt-8 sm:p-6 md:p-8 space-y-8 overflow-y-auto relative">

        {/* Modern Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#004AAD]/5 via-transparent to-[#00B4D8]/5 dark:from-[#004AAD]/10 dark:to-[#0066FF]/10 pointer-events-none" />

        {/* Header with Ultra-Modern Glassmorphism */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-card/60 dark:bg-card/40 backdrop-blur-2xl p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30 shadow-2xl shadow-[#004AAD]/10 dark:shadow-[#0066FF]/20">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-3">
                {greeting}, {studentData?.fullName?.split(' ')[0] || 'Student'}
              </h1>
              <p className="text-muted-foreground font-semibold text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF] fill-[#00B4D8] dark:fill-[#66D9EF] animate-pulse" />
                Your learning journey is accelerating! 🚀
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshStats}
                className="group/btn p-4 bg-gradient-to-br from-card to-accent dark:from-card/80 dark:to-accent/50 rounded-2xl shadow-lg border border-border hover:border-[#004AAD]/50 dark:hover:border-[#0066FF]/50 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-[#004AAD]/20 dark:hover:shadow-[#0066FF]/30"
              >
                <RefreshCw className={`w-5 h-5 text-[#004AAD] dark:text-[#0066FF] group-hover/btn:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <a
                href="/admin/quizzes/quizebank"
                className="group/btn px-8 py-4 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#003376] dark:via-[#004AAD] dark:to-[#0066FF] text-white rounded-2xl font-bold hover:shadow-2xl hover:shadow-[#004AAD]/40 dark:hover:shadow-[#0066FF]/50 hover:scale-105 transition-all duration-300 flex items-center gap-3"
              >
                <Trophy className="w-6 h-6 group-hover/btn:rotate-12 transition-transform duration-300" />
                <span>Start Quiz</span>
              </a>
            </div>
          </div>
        </div>

        {/* Ultra-Modern Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">

          {/* Card 1: Total Quizzes - Primary Brand Gradient */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-2xl blur-lg opacity-40 dark:opacity-50 group-hover:opacity-60 dark:group-hover:opacity-70 group-hover:blur-xl transition-all duration-500" />
            <Card className="relative hover:scale-105 transition-all duration-500 border-none shadow-2xl shadow-[#004AAD]/20 dark:shadow-[#0066FF]/30 bg-gradient-to-br from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#003376] dark:via-[#004AAD] dark:to-[#0066FF] text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 dark:bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 dark:bg-white/5 rounded-full -ml-12 -mb-12 group-hover:scale-150 transition-transform duration-700" />
              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                    <ClipboardList className="w-7 h-7 text-white" />
                  </div>
                  <div className="px-3 py-1 bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">
                    ALL TIME
                  </div>
                </div>
                <p className="text-white/90 font-bold text-sm uppercase tracking-wider mb-2">Total Quizzes</p>
                <h3 className="text-5xl font-black mb-4">{stats.totalQuizzes + stats.totalMockQuizzes}</h3>
                <div className="flex gap-2">
                  <span className="bg-white/30 dark:bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-bold">{stats.totalQuizzes} Admin</span>
                  <span className="bg-white/30 dark:bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-bold">{stats.totalMockQuizzes} Custom</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 2: Questions Solved - Lighter Brand Variant */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00B4D8] to-[#66D9EF] rounded-2xl blur-lg opacity-30 dark:opacity-40 group-hover:opacity-50 dark:group-hover:opacity-60 transition-all duration-500" />
            <Card className="relative hover:scale-105 transition-all duration-500 border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl shadow-[#00B4D8]/10 dark:shadow-[#00B4D8]/20 bg-card/80 dark:bg-card/60 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#00B4D8]/20 to-[#66D9EF]/20 dark:from-[#00B4D8]/30 dark:to-[#66D9EF]/30 rounded-xl group-hover:scale-110 transition-all duration-300">
                    <CheckCircle className="w-7 h-7 text-[#00B4D8] dark:text-[#66D9EF]" />
                  </div>
                </div>
                <p className="text-muted-foreground font-bold text-sm uppercase tracking-wider mb-2">Questions Solved</p>
                <h3 className="text-5xl font-black text-foreground mb-4">{stats.totalQuestions + stats.totalMockQuestions}</h3>
                <div className="space-y-2">
                  <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00B4D8] to-[#66D9EF] dark:from-[#0066FF] dark:to-[#00B4D8] rounded-full transition-all duration-1000"
                      style={{ width: `${stats.overallAccuracy}%` }}
                    />
                  </div>
                  <p className="text-sm text-[#00B4D8] dark:text-[#66D9EF] font-bold">{stats.totalCorrect + stats.totalMockCorrect} Correct • {stats.overallAccuracy}% Accuracy</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 3: Avg Accuracy - Brand Color Accent */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF] to-[#004AAD] rounded-2xl blur-lg opacity-30 dark:opacity-40 group-hover:opacity-50 dark:group-hover:opacity-60 transition-all duration-500" />
            <Card className="relative hover:scale-105 transition-all duration-500 border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl shadow-[#0066FF]/10 dark:shadow-[#0066FF]/20 bg-card/80 dark:bg-card/60 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#0066FF]/20 to-[#004AAD]/20 dark:from-[#0066FF]/30 dark:to-[#004AAD]/30 rounded-xl group-hover:scale-110 transition-all duration-300">
                    <Target className="w-7 h-7 text-[#0066FF] dark:text-[#66D9EF]" />
                  </div>
                </div>
                <p className="text-muted-foreground font-bold text-sm uppercase tracking-wider mb-2">Avg. Accuracy</p>
                <h3 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] to-[#004AAD] dark:from-[#0066FF] dark:to-[#00B4D8] mb-4">
                  {stats.overallAccuracy}%
                </h3>
                <div className="flex items-center gap-2 text-[#0066FF] dark:text-[#66D9EF] font-bold text-sm">
                  <TrendingUp className="w-4 h-4" />
                  <span>Top 15% of students</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Card 4: Mock Bank - Cyan Accent */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00B4D8] to-[#66D9EF] rounded-2xl blur-lg opacity-30 dark:opacity-40 group-hover:opacity-50 dark:group-hover:opacity-60 transition-all duration-500" />
            <Card className="relative hover:scale-105 transition-all duration-500 border border-[#00B4D8]/10 dark:border-[#66D9EF]/20 shadow-xl shadow-[#00B4D8]/10 dark:shadow-[#66D9EF]/20 bg-card/80 dark:bg-card/60 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-gradient-to-br from-[#00B4D8]/20 to-[#66D9EF]/20 dark:from-[#00B4D8]/30 dark:to-[#66D9EF]/30 rounded-xl group-hover:scale-110 transition-all duration-300">
                    <BookOpen className="w-7 h-7 text-[#00B4D8] dark:text-[#66D9EF]" />
                  </div>
                </div>
                <p className="text-muted-foreground font-bold text-sm uppercase tracking-wider mb-2">Mock Bank</p>
                <h3 className="text-5xl font-black text-foreground mb-4">
                  {studentData?.usedMockQuestionIds?.length || 0}
                </h3>
                <p className="text-sm text-muted-foreground font-semibold">Unique questions attempted</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* --- ULTRA-MODERN CHARTS SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">

          {/* 1. Performance Trend (Area Chart) */}
          <div className="lg:col-span-2 group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#004AAD]/10 to-[#00B4D8]/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Card className="relative border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl shadow-[#004AAD]/5 dark:shadow-[#0066FF]/10 bg-card/80 dark:bg-card/60 backdrop-blur-xl overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-accent/30 p-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-black text-foreground">
                  <div className="p-2 bg-gradient-to-br from-[#004AAD]/20 to-[#0066FF]/20 dark:from-[#0066FF]/30 dark:to-[#00B4D8]/30 rounded-xl">
                    <Activity className="w-6 h-6 text-[#004AAD] dark:text-[#0066FF]" />
                  </div>
                  Performance Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[350px] w-full">
                  {performanceTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={performanceTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#004AAD" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#00B4D8" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} className="text-muted-foreground" />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} className="text-muted-foreground" domain={[0, 100]} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            borderRadius: '16px',
                            border: '1px solid hsl(var(--border))',
                            boxShadow: '0 8px 32px rgba(0, 74, 173, 0.15)'
                          }}
                          itemStyle={{ color: '#004AAD', fontWeight: 700 }}
                          labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                        />
                        <Area type="monotone" dataKey="score" stroke="#004AAD" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-3">
                      <Activity className="w-12 h-12 opacity-20 text-[#004AAD]" />
                      <p className="font-semibold">Take some quizzes to see your trend line!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 2. Subject Radar Chart */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/10 to-[#00B4D8]/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Card className="relative border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl shadow-[#0066FF]/5 dark:shadow-[#0066FF]/10 bg-card/80 dark:bg-card/60 backdrop-blur-xl overflow-hidden h-full">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-accent/30 p-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-black text-foreground">
                  <div className="p-2 bg-gradient-to-br from-[#0066FF]/20 to-[#00B4D8]/20 dark:from-[#0066FF]/30 dark:to-[#00B4D8]/30 rounded-xl">
                    <Target className="w-6 h-6 text-[#0066FF] dark:text-[#00B4D8]" />
                  </div>
                  Subject Strengths
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex items-center justify-center">
                <div className="h-[350px] w-full">
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                        <PolarGrid className="stroke-border" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Accuracy" dataKey="A" stroke="#0066FF" strokeWidth={3} fill="#0066FF" fillOpacity={0.25} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0, 74, 173, 0.1)', backgroundColor: 'hsl(var(--card))' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-3">
                      <Target className="w-12 h-12 opacity-20 text-[#0066FF]" />
                      <p className="font-semibold">Not enough data for radar analysis</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">

          {/* 3. Correct vs Wrong Bar Chart */}
          <div className="lg:col-span-2 group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00B4D8]/10 to-[#66D9EF]/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Card className="relative border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl shadow-[#00B4D8]/5 dark:shadow-[#00B4D8]/10 bg-card/80 dark:bg-card/60 backdrop-blur-xl">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-accent/30 p-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-black text-foreground">
                  <div className="p-2 bg-gradient-to-br from-[#00B4D8]/20 to-[#66D9EF]/20 dark:from-[#00B4D8]/30 dark:to-[#66D9EF]/30 rounded-xl">
                    <CheckCircle className="w-6 h-6 text-[#00B4D8] dark:text-[#66D9EF]" />
                  </div>
                  Accuracy Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] w-full">
                  {barChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/50" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'hsl(var(--accent))' }} contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 12px rgba(0, 74, 173, 0.1)', backgroundColor: 'hsl(var(--card))' }} />
                        <Legend />
                        <Bar dataKey="correct" name="Correct" stackId="a" fill="#00B4D8" radius={[0, 0, 0, 0]} barSize={24} />
                        <Bar dataKey="wrong" name="Wrong" stackId="a" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground font-semibold">No data available</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Recent Activity List */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#004AAD]/10 to-[#0066FF]/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <Card className="relative border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl shadow-[#004AAD]/5 dark:shadow-[#0066FF]/10 bg-card/80 dark:bg-card/60 backdrop-blur-xl h-full">
              <CardHeader className="border-b border-border/50 bg-gradient-to-r from-card to-accent/30 p-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-black text-foreground">
                  <div className="p-2 bg-gradient-to-br from-[#004AAD]/20 to-[#0066FF]/20 dark:from-[#0066FF]/30 dark:to-[#00B4D8]/30 rounded-xl">
                    <Clock className="w-6 h-6 text-[#004AAD] dark:text-[#0066FF]" />
                  </div>
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[350px] overflow-y-auto">
                  {recentQuizzes.length > 0 ? (
                    recentQuizzes.map((q, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-all duration-200 border-b border-border/50 last:border-0 group/item cursor-pointer">
                        <div className={`p-3 rounded-xl shadow-lg transition-all duration-300 group-hover/item:scale-110 group-hover/item:rotate-3 ${q.quizType === 'user'
                          ? 'bg-gradient-to-br from-[#00B4D8]/20 to-[#66D9EF]/20 dark:from-[#00B4D8]/30 dark:to-[#66D9EF]/30 text-[#00B4D8] dark:text-[#66D9EF]'
                          : 'bg-gradient-to-br from-[#004AAD]/20 to-[#0066FF]/20 dark:from-[#004AAD]/30 dark:to-[#0066FF]/30 text-[#004AAD] dark:text-[#0066FF]'
                          }`}>
                          {q.quizType === 'user' ? <ClipboardList className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-black text-foreground truncate">{q.title || `Quiz #${q.attemptNumber}`}</h5>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-semibold">
                            {q.submittedAt?.toDate ? q.submittedAt.toDate().toLocaleDateString() : 'Just now'} •
                            <span className={q.score / q.total >= 0.7 ? 'text-[#00B4D8] dark:text-[#66D9EF] font-bold' : 'text-amber-500 font-bold'}>
                              {Math.round((q.score / q.total) * 100)}% Accuracy
                            </span>
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#004AAD]/50 dark:text-[#0066FF]/50 group-hover/item:text-[#004AAD] dark:group-hover/item:text-[#0066FF] group-hover/item:translate-x-1 transition-all" />
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-muted-foreground font-semibold">
                      <p>No recent activity yet.</p>
                    </div>
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