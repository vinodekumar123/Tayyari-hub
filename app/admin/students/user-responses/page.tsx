'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from 'app/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, XCircle, Info } from 'lucide-react';

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
}

interface UserQuizDoc {
  name: string;
  subject?: string;
  chapters?: string[];
  duration?: number;
}

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

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold">{quiz.name}</h1>
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

      <main className="max-w-3xl w-full mx-auto p-4">
        <Card className="shadow-md w-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Your Responses &amp; Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-10">
            {attempt.detailed.map((q, idx) => (
              <div key={q.questionId} className="space-y-2 border-b pb-6 mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Q{idx + 1}.</span>
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
                      <Info className="h-4 w-4" /> Not Attempted
                    </span>
                  ) : q.isCorrect ? (
                    <span className="text-green-700 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" /> Correct
                    </span>
                  ) : (
                    <span className="text-red-700 flex items-center gap-1">
                      <XCircle className="h-4 w-4" /> Incorrect
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
