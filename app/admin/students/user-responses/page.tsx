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
  name?: string;
  title?: string;
  subject?: string; // old
  subjects?: string[]; // new
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
        // Load attempt first
        const attemptRef = doc(db, 'users', user.uid, 'user-quizattempts', quizId);
        const attemptSnap = await getDoc(attemptRef);
        if (!attemptSnap.exists()) {
          setError('Quiz attempt not found.');
          setLoading(false);
          return;
        }
        const attemptData = attemptSnap.data() as QuizAttempt;
        setAttempt(attemptData);

        // Load quiz meta from user-quizzes collection using the quizId
        const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
        if (quizSnap.exists()) {
          const quizData = quizSnap.data() as UserQuizDoc;
          setQuiz(quizData);
        } else {
          // Fallback: create a basic quiz object with name from attempt if available
          setQuiz({
            name: attemptData.quizType || 'Quiz Results',
            title: attemptData.quizType || 'Quiz Results',
            subjects: attemptData.detailed
              .map((q) => q.subject)
              .filter((v, i, arr) => !!v && arr.indexOf(v) === i) as string[]
          });
        }
        setLoading(false);
      } catch (err: any) {
        setError('Error loading quiz result: ' + (err?.message || String(err)));
        setLoading(false);
      }
    };
    load();
  }, [quizId, user]);

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-red-600 text-center py-10 bg-white/90 backdrop-blur-lg rounded-2xl px-8 border border-red-200 shadow-xl">{error}</div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <Sparkles className="h-12 w-12 text-purple-600 animate-pulse mx-auto mb-4" />
        <p className="text-gray-700 text-lg font-medium">Loading your results...</p>
      </div>
    </div>
  );

  if (!attempt || !quiz) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center py-10 text-gray-600">No result found.</div>
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
    if (percent >= 90) return { text: 'Outstanding', color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (percent >= 75) return { text: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (percent >= 60) return { text: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (percent >= 50) return { text: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'Needs Improvement', color: 'text-orange-600', bg: 'bg-orange-100' };
  };

  const performance = getPerformanceLevel(percent);

  // ----- MAIN JSX -----
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 border-b border-purple-200">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
          <Button
            variant="outline"
            onClick={() => router.push('/students/results')}
            className="bg-white hover:bg-gray-50 mb-6 shadow-sm border-purple-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Results
          </Button>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/30">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 tracking-tight">{quiz.title || quiz.name || 'Quiz Results'}</h1>
                  {/* Show all quiz subjects as chips/tags */}
                  {(quiz.subjects && quiz.subjects.length > 0) ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {quiz.subjects.map((subj) => (
                        <span
                          key={subj}
                          className="px-3 py-1 bg-blue-100 border border-blue-300 text-blue-700 rounded-full text-sm font-semibold shadow-sm"
                        >
                          {subj}
                        </span>
                      ))}
                    </div>
                  ) : quiz.subject && (
                    <p className="text-purple-700 mt-1 text-lg font-medium">{quiz.subject}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-6">
                <div className={`px-4 py-2 rounded-full ${performance.bg} border border-purple-200 shadow-sm`}>
                  <span className={`${performance.color} font-bold text-lg flex items-center gap-2`}>
                    <Award className="h-5 w-5" />
                    {performance.text}
                  </span>
                </div>
                <div className="text-gray-600 text-sm font-medium">
                  Attempt #{attempt.attemptNumber}
                </div>
              </div>
            </div>

            {/* Score Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-pink-200 rounded-3xl blur-xl opacity-50"></div>
              <div className="relative bg-white rounded-3xl p-8 border border-purple-200 shadow-2xl">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-gray-600 text-sm font-medium mb-2">Your Score</p>
                    <p className="text-5xl font-bold text-gray-800">{percent}<span className="text-3xl text-gray-500">%</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-600 text-sm mb-1">Questions</p>
                    <p className="text-2xl font-bold text-gray-800">{attempt.score}<span className="text-gray-500">/{attempt.total}</span></p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-gray-700 font-medium">
                        {attempt.timeTaken ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle className="h-4 w-4" /> {correctCount}
                      </span>
                      <span className="flex items-center gap-1 text-red-600 font-semibold">
                        <XCircle className="h-4 w-4" /> {wrongCount}
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
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

      {/* ... rest of the file is unchanged ... */}
      {/* Analytics, Tabs, and Questions, etc. */}
      {/* ... */}
    </div>
  );
};

export default UserResponsesPage;
