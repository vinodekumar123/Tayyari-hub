'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../firebase';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, CheckCircle, XCircle, Circle, ArrowLeft } from 'lucide-react';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

interface QuizData {
  title: string;
  selectedQuestions: Question[];
}

const ResultPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id');
  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const { width, height } = useWindowSize();
  const router = useRouter();

  useEffect(() => {
    onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!quizId || !user) return;

    const load = async () => {
      const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
      const attemptSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));

      if (!quizSnap.exists() || !attemptSnap.exists()) return;

      const quizData = quizSnap.data();
      const attemptData = attemptSnap.data();

      const questions: Question[] = quizData.selectedQuestions || [];
      const answers: Record<string, string> = attemptData.answers || {};

      setQuiz({
        title: quizData.title || 'Untitled Quiz',
        selectedQuestions: questions
      });
      setUserAnswers(answers);

      const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
      const wrong = questions.length - correct;

      setScore(correct);
      setCorrectCount(correct);
      setWrongCount(wrong);

      await setDoc(doc(db, 'users', user.uid, 'results', quizId), {
        score: correct,
        total: questions.length,
        timestamp: new Date(),
        answers
      });
    };

    load();
  }, [quizId, user]);

  if (!quiz) return <p className="text-center py-10">Loading result...</p>;

  const total = quiz.selectedQuestions.length;
  const percentage = (score / total) * 100;

  const remark = percentage >= 90
    ? '🎉 Excellent!'
    : percentage >= 70
      ? '👍 Good Job!'
      : '📝 Keep Practicing';

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 max-w-6xl mx-auto">
      {percentage >= 70 && <Confetti width={width} height={height} numberOfPieces={300} recycle={false} />}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => {
            setTimeout(() => {
              router.push('/dashboard/student');
            }, 300);
          }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
      <Card className="mb-8 shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-extrabold text-gray-800">{quiz.title} - Result</CardTitle>
        </CardHeader>
        <CardContent className="text-xl space-y-2">
          <p>✅ Score: <span className="font-bold text-green-600">{score}</span> / {total}</p>
          <p>✔️ Correct: <span className="text-green-700">{correctCount}</span></p>
          <p>❌ Wrong: <span className="text-red-600">{wrongCount}</span></p>
          <p className="font-semibold text-lg">{remark}</p>
          <Badge className={`text-white text-sm px-3 py-1 rounded-full ${percentage >= 90
              ? 'bg-green-600'
              : percentage >= 70
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}>
            {percentage.toFixed(2)}%
          </Badge>
        </CardContent>
      </Card>

      {quiz.selectedQuestions.map((q, idx) => {
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.correctAnswer;

        return (
          <Card key={q.id} className="mb-6 shadow-md border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Q{idx + 1}. {q.questionText.replace(/<[^>]+>/g, '')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {q.options.map((opt, i) => {
                const isSelected = opt === userAnswer;
                const isAnswer = opt === q.correctAnswer;
                const baseStyle = 'flex items-center p-4 rounded-lg border text-base font-medium';
                let style = 'border-gray-300';
                let icon = <Circle className="text-gray-400 w-4 h-4 mr-2" />;

                if (isAnswer) {
                  style = 'border-green-500 bg-green-100';
                  icon = <CheckCircle className="text-green-600 w-5 h-5 mr-2" />;
                } else if (isSelected) {
                  style = 'border-red-500 bg-red-100';
                  icon = <XCircle className="text-red-600 w-5 h-5 mr-2" />;
                }

                return (
                  <div key={i} className={`${baseStyle} ${style}`}>
                    {icon}
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                );
              })}

              {q.explanation && (
                <div className="bg-blue-50 border border-blue-200 p-4 text-blue-800 rounded-lg flex items-start gap-3">
                  <Info className="h-5 w-5 mt-1" />
                  <p>{q.explanation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

const ResultPage = () => {
  return (
    <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <ResultPageContent />
    </React.Suspense>
  );
};

export default ResultPage;
