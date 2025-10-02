'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from 'app/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, XCircle, Info, BarChart2 } from 'lucide-react';
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
  timeTaken?: number; // seconds for the whole quiz
}

interface UserQuizDoc {
  name: string;
  subject?: string;
  chapters?: string[];
  duration?: number;
}

const COLORS = ['#34d399', '#f87171', '#fbbf24', '#60a5fa', '#6366f1', '#f472b6', '#65a30d', '#dc2626'];

const UserResponsesPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id') as string;

  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<UserQuizDoc | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // Load quiz meta
        const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
        if (!quizSnap.exists()) {
          setError('Quiz not found.');
          setLoading(false);
          return;
        }
        setQuiz(quizSnap.data() as UserQuizDoc);

        // Load attempt
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

  if (error) return <div className="text-red-600 text-center py-10">{error}</div>;
  if (loading) return <p className="text-center py-10">Loading...</p>;
  if (!attempt || !quiz) return <div className="text-center py-10">No result found.</div>;

  const percent = Math.round((attempt.score / (attempt.total || 1)) * 100);

  // Analytics
  let wrongCount = 0, skippedCount = 0;
  const subjectStats: Record<string, { correct: number; wrong: number; skipped: number; total: number }> = {};
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
      return;
    }
    if (q.isCorrect) {
      if (q.subject) {
        subjectStats[q.subject] ||= { correct: 0, wrong: 0, skipped: 0, total: 0 };
        subjectStats[q.subject].correct++;
        subjectStats[q.subject].total++;
      }
    }
  });

  const analyticsData = [
    { name: 'Correct', value: attempt.score },
    { name: 'Wrong', value: wrongCount },
    { name: 'Skipped', value: skippedCount },
  ];

  const subjectData = Object.entries(subjectStats).map(([subject, stats], idx) => ({
    subject,
    Correct: stats.correct,
    Wrong: stats.wrong,
    Skipped: stats.skipped,
    total: stats.total,
    fill: COLORS[idx % COLORS.length],
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-pink-50 px-4">
      <header className="bg-white border-b sticky top-0 z-40 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">{quiz.name}</h1>
              {quiz.subject && (
                <p className="text-sm text-gray-600">{quiz.subject}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="text-sm font-semibold text-gray-600">
              Attempt: {attempt.attemptNumber}
            </div>
            <div className="w-full sm:w-48">
              <div className="text-xs text-gray-600">Score: {attempt.score}/{attempt.total}</div>
              <Progress value={percent} className="mt-1" />
              <div className="text-xs text-gray-600 mt-1">{percent}%</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto py-8 px-2 md:px-0">
        {/* Analytics Card */}
        <Card className="shadow-xl rounded-2xl mb-8 border-2 border-indigo-100 bg-gradient-to-r from-white via-indigo-50 to-blue-50">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-indigo-700">
              <BarChart2 className="h-7 w-7 text-indigo-600" />
              Quiz Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4 items-center">
              {/* Pie Chart */}
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold mb-2 text-center text-indigo-600">Answer Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={analyticsData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {analyticsData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-around mt-4 text-sm">
                  <span className="font-bold text-green-600">Correct: {attempt.score}</span>
                  <span className="font-bold text-red-600">Wrong: {wrongCount}</span>
                  <span className="font-bold text-yellow-600">Skipped: {skippedCount}</span>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Total Time Taken: {attempt.timeTaken
                    ? `${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s`
                    : 'N/A'}
                </div>
              </div>
              {/* Subject-wise Bar Chart */}
              <div className="bg-white rounded-xl shadow p-4">
                <h3 className="font-semibold mb-2 text-center text-indigo-600">Subject-wise Performance</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={subjectData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                    barCategoryGap="30%"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" tick={{ fontSize: 12, fill: "#6366f1", fontWeight: 600 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Correct" stackId="a" fill="#34d399" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Wrong" stackId="a" fill="#f87171" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Skipped" stackId="a" fill="#fbbf24" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Subjects Attempted: {subjectData.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Responses */}
        <Card className="shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Your Responses &amp; Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-10">
            {attempt.detailed.map((q, idx) => (
              <div key={q.questionId} className="space-y-2 border-b pb-6 mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-indigo-700">Q{idx + 1}.</span>
                  <span className="font-medium prose max-w-none">{q.questionText}</span>
                </div>
                <div className="grid gap-2 mt-2">
                  {q.options.map((opt, i) => {
                    const isSelected = q.selected === opt;
                    const isCorrect = q.correct === opt;
                    return (
                      <div
                        key={i}
                        className={`flex items-center p-3 border rounded-lg transition
                          ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
                          ${isCorrect ? 'border-green-600 bg-green-50' : ''}
                        `}
                      >
                        <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                        <span className="prose max-w-none">{opt}</span>
                        {isCorrect && (
                          <CheckCircle className="ml-3 h-5 w-5 text-green-600" title="Correct Answer" />
                        )}
                        {isSelected && !isCorrect && (
                          <XCircle className="ml-3 h-5 w-5 text-red-600" title="Your Answer" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {q.selected === null || q.selected === '' ? (
                    <span className="text-yellow-700 flex items-center gap-1">
                      <Info className="h-4 w-4" /> Skipped
                    </span>
                  ) : q.isCorrect ? (
                    <span className="text-green-700 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Correct
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> Wrong
                    </span>
                  )}
                </div>
                {q.explanation && (
                  <div className="bg-gray-50 border-l-4 border-blue-400 p-3 mt-2 rounded">
                    <span className="font-semibold text-blue-700">Explanation:</span>
                    <div className="mt-1 prose max-w-none text-gray-700">{q.explanation}</div>
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {q.chapter && <span>Chapter: {q.chapter} &nbsp; </span>}
                  {q.subject && <span>Subject: {q.subject} &nbsp; </span>}
                  {q.difficulty && <span>Difficulty: {q.difficulty}</span>}
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => router.push('/students/user-quizzes')}>Back to Quizzes</Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UserResponsesPage;
