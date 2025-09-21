'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../../firebase';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Send } from 'lucide-react';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  subject?: string;
}

interface QuizData {
  title: string;
  course?: string;
  duration: number;
  resultVisibility: string;
  selectedQuestions: Question[];
  questionsPerPage?: number;
}

const StartQuizPage: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quizId = searchParams.get('id')!;
  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => setHasMounted(true), []);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!quizId || !user) return;

    const load = async () => {
      const qSnap = await getDoc(doc(db, 'users', user.uid, 'mock-quizzes', quizId));
      if (!qSnap.exists()) return;

      const data = qSnap.data();
      const quizData: QuizData = {
        title: data.title || 'Untitled Quiz',
        course: data.course || '',
        duration: data.duration || 60,
        resultVisibility: data.resultVisibility || 'immediate',
        selectedQuestions: data.selectedQuestions || [],
        questionsPerPage: data.questionsPerPage || 1,
      };

      setQuiz(quizData);

      const resumeSnap = await getDoc(doc(db, 'users', user.uid, 'mock-quizAttempts', quizId));
      if (resumeSnap.exists()) {
        const rt = resumeSnap.data();
        setAnswers(rt.answers || {});
        if (rt.remainingTime !== undefined) {
          setTimeLeft(rt.remainingTime);
        } else {
          const elapsed = rt.startedAt ? Date.now() - rt.startedAt.toMillis() : 0;
          setTimeLeft(quizData.duration * 60 - Math.floor(elapsed / 1000));
        }
      } else {
        setTimeLeft(quizData.duration * 60);
        await setDoc(doc(db, 'users', user.uid, 'mock-quizAttempts', quizId), {
          startedAt: serverTimestamp(),
          answers: {},
        });
      }

      setHasLoadedTime(true);
      setLoading(false);
    };

    load();
  }, [quizId, user]);

  useEffect(() => {
    if (loading || !quiz || !hasLoadedTime) return;
    if (timeLeft <= 0) return handleSubmit();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [loading, quiz, hasLoadedTime, timeLeft]);

  const handleAnswer = (qid: string, val: string) => {
    const updated = { ...answers, [qid]: val };
    setAnswers(updated);
    if (user && quiz) {
      setDoc(
        doc(db, 'users', user.uid, 'mock-quizAttempts', quizId),
        {
          answers: updated,
          remainingTime: timeLeft,
        },
        { merge: true }
      );
    }
  };

  const handleSubmit = async () => {
    if (hasSubmittedRef.current || !user || !quiz) return;
    hasSubmittedRef.current = true;

    const total = quiz.selectedQuestions.length;
    let score = 0;
    for (const question of quiz.selectedQuestions) {
      if (answers[question.id] === question.correctAnswer) score += 1;
    }

    await setDoc(
      doc(db, 'users', user.uid, 'mock-quizAttempts', quizId),
      {
        submittedAt: serverTimestamp(),
        answers,
        completed: true,
        remainingTime: 0,
      },
      { merge: true }
    );

    await setDoc(
      doc(db, 'users', user.uid, 'mock-quizAttempts', quizId, 'results', quizId),
      {
        quizId,
        title: quiz.title,
        course: quiz.course,
        score,
        total,
        answers,
        timestamp: serverTimestamp(),
      }
    );

    router.push(
      quiz.resultVisibility === 'immediate'
        ? '/dashboard/quiz/results?id=' + quizId
        : '/dashboard/student'
    );
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const stripHTML = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  if (!hasMounted || loading || !quiz)
    return <p className="text-center py-10">Loading quiz...</p>;

  const groupedQuestions = quiz.selectedQuestions.reduce((acc: Record<string, Question[]>, q) => {
    const subject = q.subject || 'Unknown Subject';
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(q);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold">{quiz.title}</h1>
              {quiz.course && <p className="text-sm text-gray-600">{quiz.course}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-600" />
            <span className="font-mono font-semibold text-red-600">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto p-4">
        <Card className="shadow-md w-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Questions</CardTitle>
            <Progress
              value={
                (Object.keys(answers).length / quiz.selectedQuestions.length) * 100
              }
              className="mt-2"
            />
          </CardHeader>

          <CardContent className="space-y-10">
            {Object.entries(groupedQuestions).map(([subject, questions]) => (
              <div key={subject} className="mb-8">
                <h2 className="text-xl font-bold text-blue-700 mb-4">📘 {subject}</h2>
                {questions.map((q, idx) => (
                  <div key={q.id} className="space-y-4 mb-6">
                    <p className="text-lg font-medium flex items-start gap-2">
                      <span className="text-gray-600">
                        Q{quiz.selectedQuestions.findIndex(x => x.id === q.id) + 1}.
                      </span>
                      <span>{stripHTML(q.questionText)}</span>
                    </p>

                    <div className="grid gap-3">
                      {q.options.map((opt, i) => (
                        <label
                          key={i}
                          htmlFor={`opt-${q.id}-${i}`}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition hover:bg-gray-100 ${
                            answers[q.id] === opt
                              ? 'border-blue-500 bg-blue-50'
                              : ''
                          }`}
                        >
                          <input
                            type="radio"
                            id={`opt-${q.id}-${i}`}
                            name={q.id}
                            value={opt}
                            checked={answers[q.id] === opt}
                            onChange={() => handleAnswer(q.id, opt)}
                            className="h-5 w-5 text-blue-600 mr-3"
                          />
                          <span className="font-semibold mr-2">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div className="pt-6 text-center">
              <Button
                onClick={handleSubmit}
                className="bg-red-600 text-white hover:bg-red-700 px-8 py-4 text-lg"
              >
                <Send className="mr-2" /> Submit Quiz
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StartQuizPage;
