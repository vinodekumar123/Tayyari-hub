'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Clock, BookOpen, Send } from 'lucide-react';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
}

interface QuizData {
  title: string;
  duration: number;
  resultVisibility: string;
  selectedQuestions: Question[];
  questionsPerPage?: number;
  maxAttempts: number;
}

const stripHtml = (html: string) => {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const StartQuizPage: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quizId = searchParams.get('id');

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);

  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userSnap = await getDoc(doc(db, 'users', u.uid));
        if (userSnap.exists()) {
          setIsAdmin(userSnap.data().admin === true);
        }
      }
    });
    return () => unsub();
  }, []);

  // Load quiz
  useEffect(() => {
    if (!quizId || !user) return;
    const loadQuiz = async () => {
      setLoading(true);
      const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
      if (!quizSnap.exists()) {
        alert('❌ Quiz not found!');
        router.push('/quiz-bank');
        return;
      }
      const data = quizSnap.data();
      const quizData: QuizData = {
        title: data.title || 'Untitled Quiz',
        duration: data.duration || 60,
        resultVisibility: data.resultVisibility || 'immediate',
        selectedQuestions: data.selectedQuestions || [],
        questionsPerPage: data.questionsPerPage || 1,
        maxAttempts: data.maxAttempts || 1,
      };
      setQuiz(quizData);

      // Load previous answers if exists
      const attemptSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));
      if (attemptSnap.exists() && !attemptSnap.data()?.completed) {
        const saved = attemptSnap.data();
        setAnswers(saved.answers || {});
        setCurrentPage(Math.floor((saved.currentIndex || 0) / quizData.questionsPerPage));
        setTimeLeft(saved.remainingTime || quizData.duration * 60);
      } else {
        setAnswers({});
        setCurrentPage(0);
        setTimeLeft(quizData.duration * 60);
      }

      setHasLoadedTime(true);
      setLoading(false);
    };
    loadQuiz();
  }, [quizId, user]);

  // Timer
  useEffect(() => {
    if (!quiz || !hasLoadedTime || isAdmin) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
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
  }, [timeLeft, quiz, hasLoadedTime, isAdmin]);

  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    if (user && quiz) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId!), {
        answers: updatedAnswers,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft,
      }, { merge: true });
    }
  };

  const handleSubmit = async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setSubmitLoading(true);

    if (!user || !quiz) return;
    const total = quiz.selectedQuestions.length;
    let score = 0;
    for (const q of quiz.selectedQuestions) {
      if (answers[q.id] === q.correctAnswer) score++;
    }

    await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId!), {
      submittedAt: serverTimestamp(),
      completed: true,
      answers,
    }, { merge: true });

    setShowSubmissionModal(true);
    setTimeout(() => {
      setShowSubmissionModal(false);
      router.push(isAdmin || quiz.resultVisibility === 'immediate' ? '/quiz/results?id=' + quizId : '/dashboard/student');
    }, 2000);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading || !quiz) return <p className="text-center py-10">Loading Quiz...</p>;

  const questionsPerPage = quiz.questionsPerPage || 1;
  const totalPages = Math.ceil(quiz.selectedQuestions.length / questionsPerPage);
  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = quiz.selectedQuestions.slice(startIdx, endIdx);
  const isLastPage = currentPage >= totalPages - 1;

  // Progress based on answered questions
  const totalAnswered = Object.keys(answers).length;
  const progressValue = (totalAnswered / quiz.selectedQuestions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      {/* Sticky Header */}
      <header className="bg-white border-b border-black sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-semibold">{quiz.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-600" />
            <span className="font-mono font-semibold text-red-600">{formatTime(timeLeft)}</span>
          </div>
        </div>
        <Progress value={progressValue} className="h-3 rounded-sm bg-gray-200 border-black border" />
      </header>

      <main className="max-w-4xl w-full mx-auto p-4">
        {qSlice.map((q, idx) => (
          <Card key={q.id} className="mb-5 border border-black rounded-sm shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Q{startIdx + idx + 1}: {stripHtml(q.questionText)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {q.options.map((opt) => (
                <Button
                  key={opt}
                  variant={answers[q.id] === opt ? 'default' : 'outline'}
                  onClick={() => handleAnswer(q.id, opt)}
                  className={`text-left border border-black rounded-sm ${answers[q.id] === opt ? 'bg-blue-600 text-white' : ''}`}
                >
                  {stripHtml(opt)}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="flex justify-between mt-4">
          <Button onClick={() => setCurrentPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>
            <ArrowLeft className="mr-2" /> Previous
          </Button>
          {!isLastPage && (
            <Button onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}>
              Next <ArrowRight className="ml-2" />
            </Button>
          )}
          {isLastPage && (
            <Button onClick={handleSubmit} disabled={submitLoading}>
              {submitLoading ? 'Submitting...' : 'Submit'} <Send className="ml-2" />
            </Button>
          )}
        </div>
      </main>

      <Dialog open={showSubmissionModal} onOpenChange={setShowSubmissionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quiz Submitted!</DialogTitle>
            <DialogDescription>Redirecting to results...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StartQuizPage;
