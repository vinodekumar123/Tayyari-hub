'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from 'app/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, XCircle, Info, BarChart2, Clock, Award, TrendingUp, ArrowLeft, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface DetailedResponse {
  questionId: string;
  questionText: string;
  selected: string | null;
  correct: string | null;
  isCorrect: boolean;
  explanation?: string | null;
  options: string[];
  chapter?: string | null;
  subject?: string | null;
  difficulty?: string | null;
}

interface QuizAttempt {
  answers: Record<string, string>;
  flags: Record<string, boolean>;
  completed: boolean;
  attemptNumber: number;
  detailed: DetailedResponse[];
  score: number;
  total: number;
  submittedAt?: any;
  quizType?: string;
  timeTaken?: number;
}

interface UserQuizDoc {
  name: string;
  subject?: string;
  chapters?: string[];
  duration?: number;
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const TABS = [
  { key: 'all', label: 'All Questions', icon: BookOpen },
  { key: 'correct', label: 'Correct', icon: CheckCircle },
  { key: 'wrong', label: 'Wrong', icon: XCircle },
  { key: 'skipped', label: 'Skipped', icon: Info },
];

const UserResponsesPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id') as string;

  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<UserQuizDoc | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!quizId || !user) return;
    const load = async () => {
      try {
        const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
        if (!quizSnap.exists()) {
          setError('Quiz not found.');
          setLoading(false);
          return;
        }
        setQuiz(quizSnap.data() as UserQuizDoc);

        const attemptRef = doc(db, 'users', user.uid, 'user-quizattempts', quizId);
        const attemptSnap = await getDoc(attemptRef);
        if (!attemptSnap.exists()) {
          setError('Quiz attempt not found.');
          setLoading(false);
          return;
        }
        setAttempt(attemptSnap.data() as QuizAttempt);
        setLoading(false);
      } catch (err: any) {
        setError('Error loading quiz result: ' + (err?.message || String(err)));
        setLoading(false);
      }
    };
    load();
  }, [quizId, user]);

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-red-400 text-center py-10 bg-slate-800/50 backdrop-blur-lg rounded-2xl px-8 border border-red-500/20">{error}</div>
    </div>
  );
  
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Sparkles className="h-12 w-12 text-purple-400 animate-pulse mx-auto mb-4" />
        <p className="text-white text-lg">Loading your results...</p>
      </div>
    </div>
  );
  
  if (!attempt || !quiz) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center py-10 text-slate-300">No result found.</div>
    </div>
  );

  const percent = Math.round((attempt.score / (attempt.total || 1)) * 100);

  let correctCount = 0, wrongCount = 0, skippedCount = 0;
  const subjectStats: Record<string, { correct: number; wrong: number; skipped: number; total: number }> = {};
  const difficultyStats: Record<string, { correct: number; total: number }> = {};
  
  attempt.detailed.forEach((q) => {
    if (!q.selected || q.selected === '') {
      skippedCount++;
      if (q.subject) {
        subjectStats[q.subject] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 };
        subjectStats[q.subject].skipped++;
        subjectStats[q.subject].total++;
      }
      return;
    }
    if (!q.isCorrect) {
      wrongCount++;
      if (q.subject) {
        subjectStats[q.subject] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 };
        subjectStats[q.subject].wrong++;
        subjectStats[q.subject].total++;
      }
      if (q.difficulty) {
        difficultyStats[q.difficulty] ||= { correct: 0, total: 0 };
        difficultyStats[q.difficulty].total++;
      }
      return;
    }
    if (q.isCorrect) {
      correctCount++;
      if (q.subject) {
        subjectStats[q.subject] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 };
        subjectStats[q.subject].correct++;
        subjectStats[q.subject].total++;
      }
      if (q.difficulty) {
        difficultyStats[q.difficulty] ||= { correct: 0, total: 0 };
        difficultyStats[q.difficulty].correct++;
        difficultyStats[q.difficulty].total++;
      }
    }
  });

  const analyticsData = [
    { name: 'Correct', value: correctCount },
    { name: 'Wrong', value: wrongCount },
    { name: 'Skipped', value: skippedCount },
  ];

  const subjectData = Object.entries(subjectStats).map(([subject, stats]) => ({
    subject: subject.length > 15 ? subject.substring(0, 12) + '...' : subject,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    correct: stats.correct,
    wrong: stats.wrong,
    skipped: stats.skipped,
  }));

  let filteredQuestions = attempt.detailed;
  if (activeTab === 'correct') {
    filteredQuestions = attempt.detailed.filter(q => q.isCorrect);
  } else if (activeTab === 'wrong') {
    filteredQuestions = attempt.detailed.filter(q => q.selected && !q.isCorrect);
  } else if (activeTab === 'skipped') {
    filteredQuestions = attempt.detailed.filter(q => !q.selected || q.selected === '');
  }

  const getPerformanceLevel = (percent: number) => {
    if (percent >= 90) return { text: 'Outstanding', color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
    if (percent >= 75) return { text: 'Excellent', color: 'text-green-400', bg: 'bg-green-500/20' };
    if (percent >= 60) return { text: 'Good', color: 'text-blue-400', bg: 'bg-blue-500/20' };
    if (percent >= 50) return { text: 'Average', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
    return { text: 'Needs Improvement', color: 'text-orange-400', bg: 'bg-orange-500/20' };
  };

  const performance = getPerformanceLevel(percent);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 backdrop-blur-xl border-b border-white/10">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/students/user-quizzes')}
            className="text-white hover:bg-white/10 mb-6 backdrop-blur-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quizzes
          </Button>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/50">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white tracking-tight">{quiz.name}</h1>
                  {quiz.subject && (
                    <p className="text-purple-200 mt-1 text-lg">{quiz.subject}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4 mt-6">
                <div className={`px-4 py-2 rounded-full ${performance.bg} backdrop-blur-sm border border-white/10`}>
                  <span className={`${performance.color} font-bold text-lg flex items-center gap-2`}>
                    <Award className="h-5 w-5" />
                    {performance.text}
                  </span>
                </div>
                <div className="text-slate-300 text-sm">
                  Attempt #{attempt.attemptNumber}
                </div>
              </div>
            </div>

            {/* Score Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl blur-xl opacity-30"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-slate-400 text-sm font-medium mb-2">Your Score</p>
                    <p className="text-5xl font-bold text-white">{percent}<span className="text-3xl text-slate-400">%</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm mb-1">Questions</p>
                    <p className="text-2xl font-bold text-white">{attempt.score}<span className="text-slate-400">/{attempt.total}</span></p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-300">
                        {attempt.timeTaken ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="h-4 w-4" /> {correctCount}
                      </span>
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle className="h-4 w-4" /> {wrongCount}
                      </span>
                      <span className="flex items-center gap-1 text-amber-400">
                        <Info className="h-4 w-4" /> {skippedCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Analytics Section */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Distribution Chart */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                  <BarChart2 className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Answer Distribution</h2>
              </div>
              
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analyticsData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {analyticsData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(12px)'
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Performance Radar */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Subject Performance</h2>
              </div>
              
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={subjectData}>
                  <PolarGrid stroke="rgba(255, 255, 255, 0.1)" />
                  <PolarAngleAxis 
                    dataKey="subject" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                  <Radar 
                    name="Accuracy %" 
                    dataKey="accuracy" 
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.6}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(12px)'
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const count = tab.key === 'all' ? attempt.detailed.length 
              : tab.key === 'correct' ? correctCount 
              : tab.key === 'wrong' ? wrongCount 
              : skippedCount;
            
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`group flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all duration-300 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50 scale-105'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-white/10'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${
                  activeTab === tab.key 
                    ? 'bg-white/20 text-white' 
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {filteredQuestions.length === 0 && (
            <div className="text-center py-16">
              <Info className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No questions to show in this category</p>
            </div>
          )}
          
          {filteredQuestions.map((q, idx) => (
            <div 
              key={q.questionId} 
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-xl">
                {/* Question Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                    q.isCorrect 
                      ? 'bg-gradient-to-br from-emerald-500 to-green-500 text-white'
                      : !q.selected || q.selected === ''
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                      : 'bg-gradient-to-br from-red-500 to-pink-500 text-white'
                  }`}>
                    {idx + 1}
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-white text-lg font-medium mb-3 leading-relaxed">{q.questionText}</p>
                    <div className="flex flex-wrap gap-2">
                      {q.subject && (
                        <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-full text-xs font-semibold">
                          {q.subject}
                        </span>
                      )}
                      {q.chapter && (
                        <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 text-purple-300 rounded-full text-xs font-semibold">
                          {q.chapter}
                        </span>
                      )}
                      {q.difficulty && (
                        <span className="px-3 py-1 bg-pink-500/20 border border-pink-500/30 text-pink-300 rounded-full text-xs font-semibold">
                          {q.difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    {q.selected === null || q.selected === '' ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-xl">
                        <Info className="h-4 w-4 text-amber-400" />
                        <span className="text-amber-300 font-medium text-sm">Skipped</span>
                      </div>
                    ) : q.isCorrect ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-300 font-medium text-sm">Correct</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <span className="text-red-300 font-medium text-sm">Wrong</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-3 mb-6">
                  {q.options.map((opt, i) => {
                    const isSelected = q.selected === opt;
                    const isCorrect = q.correct === opt;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-4 rounded-2xl transition-all duration-300 ${
                          isCorrect
                            ? 'bg-emerald-500/10 border-2 border-emerald-500/50'
                            : isSelected
                            ? 'bg-red-500/10 border-2 border-red-500/50'
                            : 'bg-slate-700/30 border border-white/5 hover:bg-slate-700/50'
                        }`}
                      >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                          isCorrect 
                            ? 'bg-emerald-500 text-white' 
                            : isSelected 
                            ? 'bg-red-500 text-white' 
                            : 'bg-slate-600 text-slate-300'
                        }`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className={`flex-1 ${
                          isCorrect || isSelected ? 'text-white font-medium' : 'text-slate-300'
                        }`}>
                          {opt}
                        </span>
                        {isCorrect && (
                          <CheckCircle className="h-6 w-6 text-emerald-400 flex-shrink-0" />
                        )}
                        {isSelected && !isCorrect && (
                          <XCircle className="h-6 w-6 text-red-400 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 p-2 bg-blue-500/20 rounded-lg">
                        <Info className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-blue-300 mb-2">Explanation</p>
                        <p className="text-slate-300 leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default UserResponsesPage;
