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
      <div className="flex-1 p-4 mt-8 sm:p-6 md:p-8 space-y-8 overflow-y-auto">

        {/* Header with Glassmorphism */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-background/70 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-border">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              {greeting}, {studentData?.fullName?.split(' ')[0] || 'Student'}
            </h1>
            <p className="text-muted-foreground font-medium mt-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              Your learning journey is on fire!
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={refreshStats} className="p-3 bg-card rounded-xl shadow-sm border border-border hover:bg-accent text-muted-foreground transition-all">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <a href="/admin/quizzes/quizebank" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-bold hover:shadow-lg hover:translate-y-[-2px] transition-all flex items-center gap-2 shadow-indigo-200">
              <Trophy className="w-5 h-5" /> Start Quiz
            </a>
          </div>
        </div>

        {/* Bento Grid Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ClipboardList className="w-24 h-24" />
            </div>
            <CardContent className="p-6 relative z-10">
              <p className="text-indigo-100 font-semibold text-sm uppercase tracking-wider">Total Quizzes</p>
              <h3 className="text-4xl font-black mt-2">{stats.totalQuizzes + stats.totalMockQuizzes}</h3>
              <div className="mt-4 flex gap-2">
                <span className="bg-white/20 px-2 py-1 rounded text-xs font-medium">{stats.totalQuizzes} Admin</span>
                <span className="bg-white/20 px-2 py-1 rounded text-xs font-medium">{stats.totalMockQuizzes} Custom</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none shadow-md bg-card group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground font-semibold text-sm uppercase tracking-wider">Questions Solved</p>
                  <h3 className="text-4xl font-black text-foreground mt-2">{stats.totalQuestions + stats.totalMockQuestions}</h3>
                </div>
                <div className="p-3 bg-emerald-100 rounded-2xl group-hover:rotate-12 transition-transform">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stats.overallAccuracy}%` }}></div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 font-medium">{stats.totalCorrect + stats.totalMockCorrect} Correct Answers</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none shadow-md bg-white group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground font-semibold text-sm uppercase tracking-wider">Avg. Accuracy</p>
                  <h3 className="text-4xl font-black text-foreground mt-2">{stats.overallAccuracy}%</h3>
                </div>
                <div className="p-3 bg-blue-100 rounded-2xl group-hover:rotate-12 transition-transform">
                  <Target className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-4 font-bold flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Top 15% of students
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none shadow-md bg-white group">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-muted-foreground font-semibold text-sm uppercase tracking-wider">Mock Bank</p>
                  <h3 className="text-4xl font-black text-foreground mt-2">
                    {studentData?.usedMockQuestionIds?.length || 0}
                  </h3>
                </div>
                <div className="p-3 bg-orange-100 rounded-2xl group-hover:rotate-12 transition-transform">
                  <BookOpen className="w-8 h-8 text-orange-600" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4 font-medium">Unique questions attempted</p>
            </CardContent>
          </Card>
        </div>

        {/* --- VISUAL ANALYTICS SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 1. Performance Trend (Area Chart) */}
          <Card className="lg:col-span-2 border-none shadow-lg bg-card overflow-hidden">
            <CardHeader className="border-b border-border bg-card p-6">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Activity className="w-5 h-5 text-indigo-500" />
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
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} stroke="#94a3b8" domain={[0, 100]} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                        labelStyle={{ color: '#64748b' }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-2">
                    <Activity className="w-8 h-8 opacity-20" />
                    <p>Take some quizzes to see your trend line!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. Subject Radar Chart */}
          <Card className="border-none shadow-lg bg-card overflow-hidden">
            <CardHeader className="border-b border-border bg-card p-6">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Target className="w-5 h-5 text-rose-500" />
                Subject Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-center bg-accent/50">
              <div className="h-[350px] w-full">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Accuracy" dataKey="A" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.2} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-2">
                    <Target className="w-8 h-8 opacity-20" />
                    <p>Not enough data for radar analysis</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 3. Correct vs Wrong Bar Chart */}
          <Card className="lg:col-span-2 border-none shadow-lg bg-card">
            <CardHeader className="border-b border-border bg-card p-6">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                Accuracy Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                {barChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                      <Legend />
                      <Bar dataKey="correct" name="Correct" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} />
                      <Bar dataKey="wrong" name="Wrong" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 4. Recent Activity List (Styled) */}
          <Card className="border-none shadow-lg bg-card h-full">
            <CardHeader className="border-b border-border bg-card p-6">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
                <Clock className="w-5 h-5 text-slate-500" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[350px] overflow-y-auto">
                {recentQuizzes.length > 0 ? (
                  recentQuizzes.map((q, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 hover:bg-accent transition-colors border-b border-border last:border-0 group cursor-pointer">
                      <div className={`p-3 rounded-xl ${q.quizType === 'user' ? 'bg-orange-100 text-orange-600' : 'bg-violet-100 text-violet-600'} group-hover:scale-110 transition-transform`}>
                        {q.quizType === 'user' ? <ClipboardList className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-bold text-foreground truncate">{q.title || `Quiz #${q.attemptNumber}`}</h5>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          {q.submittedAt?.toDate ? q.submittedAt.toDate().toLocaleDateString() : 'Just now'} •
                          <span className={q.score / q.total >= 0.7 ? 'text-emerald-500 font-medium' : 'text-amber-500 font-medium'}>
                            {Math.round((q.score / q.total) * 100)}% Accuracy
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No recent activity needed.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
      );
}