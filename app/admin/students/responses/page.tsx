'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/app/firebase';

import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, CheckCircle, XCircle, Circle } from 'lucide-react';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  subject?: string;
}

interface QuizData {
  title: string;
  subject?: string;
  resultVisibility: string;
  selectedQuestions: Question[];
}

const ResultPage: React.FC = () => {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id');
  const isMock = searchParams.get('mock') === 'true';
  const studentId = searchParams.get('studentId');

  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  useEffect(() => {
    onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!quizId || !user || !studentId) return;

    const load = async () => {
      const quizDoc = isMock
        ? doc(db, 'users', studentId, 'mock-quizzes', quizId)
        : doc(db, 'quizzes', quizId);

      const resultDoc = doc(
        db,
        'users',
        studentId,
        isMock ? 'mock-quizAttempts' : 'quizAttempts',
        quizId,
        'results',
        quizId
      );

      const [quizSnap, resultSnap] = await Promise.all([
        getDoc(quizDoc),
        getDoc(resultDoc)
      ]);

      if (!quizSnap.exists() || !resultSnap.exists()) return;

      const quizData = quizSnap.data();
      const attemptData = resultSnap.data();

      // result visibility logic
      if (quizData.resultVisibility !== 'immediate') {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : null;
        const isAdmin = userData?.admin === true;

        if (!isAdmin) {
          setAccessDenied(true);
          return;
        }
      }

      const questions: Question[] = quizData.selectedQuestions || [];
      const answers: Record<string, string> = attemptData.answers || {};

      setQuiz({
        title: quizData.title || 'Untitled Quiz',
        subject: quizData.subject || 'N/A',
        resultVisibility: quizData.resultVisibility,
        selectedQuestions: questions
      });

      setUserAnswers(answers);

      const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
      const wrong = questions.length - correct;

      setScore(correct);
      setWrongAnswers(wrong);

      if (correct / questions.length >= 0.7) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
      }
    };

    load();
  }, [quizId, user, isMock, studentId]);

  if (accessDenied) {
    return (
      <div className="text-center mt-16 text-lg text-red-600 font-semibold">
        🚫 Responses for this quiz are not available yet.
      </div>
    );
  }

  if (!quiz) return <p className="text-center py-10">Loading result...</p>;

  const groupedBySubject = quiz.selectedQuestions.reduce((acc, q) => {
    const subj = q.subject || 'Unknown';
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  const percentage = (score / quiz.selectedQuestions.length) * 100;
  let remark = 'Needs Improvement';
  if (percentage === 100) remark = '🏆 Perfect Score! Outstanding!';
  else if (percentage >= 90) remark = '🔥 Excellent Performance!';
  else if (percentage >= 70) remark = '🎉 Great Job!';
  else if (percentage >= 50) remark = '👍 Good Effort';
  else remark = '📘 Keep Practicing';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white px-6 py-10 mx-auto">
      {showConfetti && (
        <>
          <Confetti width={width} height={height} />
          <div className="text-4xl text-center font-bold my-6 animate-bounce">
            🎉 Congratulations! 🎉
          </div>
        </>
      )}

      <Card className="mb-10 shadow-2xl border-0">
        <CardHeader className="bg-blue-600 rounded-t-xl text-white p-6">
          <CardTitle className="text-3xl font-bold">{quiz.title} - Result</CardTitle>
        </CardHeader>
        <CardContent className="bg-white p-6 space-y-4 rounded-b-xl text-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-green-100 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium">✅ Correct</p>
              <p className="text-2xl font-bold text-green-800">{score}</p>
            </div>
            <div className="bg-red-100 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">❌ Wrong</p>
              <p className="text-2xl font-bold text-red-800">{wrongAnswers}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">📘 Subject</p>
              <p className="text-lg font-semibold text-blue-800">{quiz.subject}</p>
            </div>
            <div className="bg-yellow-100 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium">📊 Score</p>
              <p className="text-xl font-bold text-yellow-800">{percentage.toFixed(2)}%</p>
            </div>
          </div>
          <div className="text-center pt-4">
            <Badge className="text-base px-4 py-2 rounded-full bg-indigo-600 text-white animate-pulse">
              {remark}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {Object.entries(groupedBySubject).map(([subject, questions]) => (
        <div key={subject} className="mb-8">
          <h2 className="text-2xl font-bold text-blue-700 mb-4">📘 {subject}</h2>
          {questions.map((q, idx) => {
            const userAnswer = userAnswers[q.id];
            const isCorrect = userAnswer === q.correctAnswer;

            return (
              <Card key={q.id} className="mb-6 shadow-md border border-gray-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-gray-900 flex gap-2">
                    <span>Q{idx + 1}.</span>
                    <span dangerouslySetInnerHTML={{ __html: q.questionText }} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {q.options.map((opt, i) => {
                    const isSelected = opt === userAnswer;
                    const isAnswer = opt === q.correctAnswer;

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
                      <div
                        key={i}
                        className={`flex items-center p-4 rounded-lg border text-base font-medium ${style}`}
                      >
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
      ))}
    </div>
  );
};

export default ResultPage;
