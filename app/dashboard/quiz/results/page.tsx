'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../../firebase';
import dynamic from 'next/dynamic';
import useWindowSize from 'react-use/lib/useWindowSize';
import parse from 'html-react-parser';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, CheckCircle, XCircle, Circle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Dynamically import Confetti to disable SSR
const Confetti = dynamic(() => import('react-confetti'), { ssr: false });

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

const ResultPage: React.FC = () => {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id');
  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(false);

  const router = useRouter();

  useEffect(() => {
    onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!quizId || !user) return;

    const load = async () => {
      const quizSnap = await getDoc(doc(db, 'users', user.uid, 'mock-quizzes', quizId));
      const attemptSnap = await getDoc(doc(db, 'users', user.uid, 'mock-quizAttempts', quizId));

      if (!quizSnap.exists() || !attemptSnap.exists()) return;

      const quizData = quizSnap.data();
      const attemptData = attemptSnap.data();

      const questions: Question[] = quizData.selectedQuestions || [];
      const answers: Record<string, string> = attemptData.answers || {};

      setQuiz({ title: quizData.title || 'Untitled Quiz', selectedQuestions: questions });
      setUserAnswers(answers);

      const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
      setScore(correct);

      if ((correct / questions.length) >= 0.7) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
      }

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

  const percentage = (score / quiz.selectedQuestions.length) * 100;
  const wrongCount = quiz.selectedQuestions.length - score;

  const getRemark = () => {
    if (percentage === 100) return "Outstanding! Perfect Score 🎯";
    if (percentage >= 90) return "Excellent! 💪";
    if (percentage >= 70) return "Great Job! 👍";
    if (percentage >= 50) return "Good effort. Keep practicing!";
    return "Don't give up. Try again!";
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 max-w-6xl mx-auto">
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          key="quiz-confetti"
        />
      )}

      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => {
            setShowConfetti(false);
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
          <CardTitle className="text-3xl font-extrabold text-gray-800">
            {quiz.title} - Result
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xl space-y-3">
          <p>✅ Score: <span className="font-bold text-green-600">{score}</span> / {quiz.selectedQuestions.length}</p>
          <p>✅ Correct: <span className="text-green-700">{score}</span></p>
          <p>❌ Wrong: <span className="text-red-600">{wrongCount}</span></p>
          <Badge className={`text-white text-sm px-3 py-1 rounded-full ${
            percentage >= 70 ? 'bg-green-600' : percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}>
            {percentage.toFixed(2)}%
          </Badge>
          <p className="text-lg text-gray-600 italic">{getRemark()}</p>
        </CardContent>
      </Card>

      {quiz.selectedQuestions.map((q, idx) => {
        const userAnswer = userAnswers[q.id];
        const isCorrect = userAnswer === q.correctAnswer;

        return (
          <Card key={q.id} className="mb-6 shadow-md border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900 flex gap-2">
                <span className="font-bold">Q{idx + 1}.</span>
                <span>{parse(q.questionText)}</span>
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
                } else if (isSelected && !isAnswer) {
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

export default ResultPage;
