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
import { ArrowLeft, ArrowRight, Info, BookOpen, Clock, Send, Download, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  showExplanation?: boolean;
  subject?: string | { id: string; name: string };
}

interface QuizData {
  title: string;
  course?: { id: string; name: string } | string;
  chapter?: { id: string; name: string } | string;
  subject?: { id: string; name: string } | string | { id: string; name: string }[];
  duration: number;
  resultVisibility: string;
  selectedQuestions: Question[];
  questionsPerPage?: number;
  maxAttempts: number;
}

const stripHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const StartQuizPage: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quizId = searchParams.get('id'); // dynamic ID from URL

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userSnap = await getDoc(doc(db, 'users', u.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setIsAdmin(data.admin === true);
        }
      }
    });
    return () => unsub();
  }, []);

  // Load quiz dynamically
  useEffect(() => {
    if (!quizId || !user) return;

    const loadQuiz = async () => {
      setLoading(true);
      const quizRef = doc(db, 'quizzes', quizId);
      const quizSnap = await getDoc(quizRef);

      if (!quizSnap.exists()) {
        alert('❌ Quiz not found!');
        router.push('/quiz-bank');
        return;
      }

      const data = quizSnap.data();
      const quizData: QuizData = {
        title: data.title || 'Untitled Quiz',
        course: data.course || '',
        chapter: data.chapter || '',
        subject: data.subjects || data.subject || '',
        duration: data.duration || 60,
        resultVisibility: data.resultVisibility || 'immediate',
        selectedQuestions: (data.selectedQuestions || []).map((q: any) => ({
          ...q,
          subject: q.subject || (data.subjects?.[0]?.name || data.subject?.name || 'Uncategorized'),
        })),
        questionsPerPage: data.questionsPerPage || 1,
        maxAttempts: data.maxAttempts || 1,
      };

      setQuiz(quizData);

      // Check attempts
      const attemptsSnap = await getDocs(collection(db, 'users', user.uid, 'quizAttempts'));
      let currentAttempt = 0;
      attemptsSnap.docs.forEach((doc) => {
        if (doc.id === quizId && doc.data()?.completed) {
          currentAttempt = doc.data().attemptNumber || 1;
        }
      });

      if (currentAttempt >= quizData.maxAttempts && !isAdmin) {
        alert('You have reached the maximum number of attempts for this quiz.');
        router.push('/quiz-bank');
        return;
      }
      setAttemptCount(currentAttempt);

      // Auto-resume
      const resumeSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));
      if (resumeSnap.exists() && !resumeSnap.data().completed) {
        const rt = resumeSnap.data();
        setAnswers(rt.answers || {});
        const questionIndex = rt.currentIndex || 0;
        setCurrentPage(Math.floor(questionIndex / quizData.questionsPerPage));
        setTimeLeft(!isAdmin && rt.remainingTime !== undefined ? rt.remainingTime : quizData.duration * 60);
      } else {
        // New attempt
        setAnswers({});
        setCurrentPage(0);
        setTimeLeft(quizData.duration * 60);
        await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
          startedAt: serverTimestamp(),
          answers: {},
          currentIndex: 0,
          completed: false,
          remainingTime: quizData.duration * 60,
        }, { merge: true });
      }

      setHasLoadedTime(true);
      setLoading(false);
    };

    loadQuiz();
  }, [quizId, user, isAdmin]);

  // Timer
  useEffect(() => {
    if (loading || !quiz || showTimeoutModal || showSubmissionModal || !hasLoadedTime || isAdmin) return;

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
  }, [loading, quiz, showTimeoutModal, showSubmissionModal, hasLoadedTime, timeLeft, isAdmin]);

  // Auto-save on unload
  useEffect(() => {
    const handleUnload = () => {
      if (user && quiz && !isAdmin && !hasSubmittedRef.current) {
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId!), {
          answers,
          currentIndex: currentPage * (quiz?.questionsPerPage || 1),
          remainingTime: timeLeft,
        }, { merge: true });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [answers, currentPage, timeLeft, quiz, user, isAdmin, quizId]);

  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    if (user && quiz && !isAdmin) {
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
    for (const question of quiz.selectedQuestions) {
      if (answers[question.id] === question.correctAnswer) score++;
    }

    const newAttemptCount = attemptCount + 1;
    const resultData = {
      quizId,
      title: quiz.title,
      course: typeof quiz.course === 'object' ? quiz.course.name : quiz.course || 'Unknown',
      subject: Array.isArray(quiz.subject)
        ? quiz.subject.map((s) => s.name).join(', ') || 'Unknown'
        : typeof quiz.subject === 'object'
        ? quiz.subject?.name || 'Unknown'
        : quiz.subject || 'Unknown',
      score,
      total,
      timestamp: serverTimestamp(),
      answers,
      attemptNumber: newAttemptCount,
    };

    await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId!), {
      submittedAt: serverTimestamp(),
      answers,
      completed: true,
      remainingTime: 0,
      attemptNumber: newAttemptCount,
    }, { merge: true });

    await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId!, 'results', quizId!), resultData);

    setShowSubmissionModal(true);
    setTimeout(() => {
      setShowSubmissionModal(false);
      router.push(isAdmin || quiz.resultVisibility === 'immediate' ? '/quiz/results?id=' + quizId : '/dashboard/student');
    }, 2500);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading || !quiz) return <p className="text-center py-10">Loading Quiz...</p>;

  const questionsPerPage = quiz.questionsPerPage || 1;

  const totalPages = Math.ceil(quiz.selectedQuestions.length / questionsPerPage);
  const isLastPage = currentPage >= totalPages - 1;
  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = quiz.selectedQuestions.slice(startIdx, endIdx);

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      {/* Timer Header */}
      {!isAdmin && (
        <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-blue-600" />
              <h1 className="text-lg font-semibold">{quiz.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-600" />
              <span className="font-mono font-semibold text-red-600">{formatTime(timeLeft)}</span>
            </div>
          </div>
        </header>
      )}

      {/* Quiz Content */}
      <main className="max-w-4xl w-full mx-auto p-4">
        <Progress value={((currentPage + 1) / totalPages) * 100} className="mb-6" />

        {qSlice.map((q, idx) => (
          <Card key={q.id} className="mb-6 shadow-lg hover:shadow-xl transition">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Q{startIdx + idx + 1}: {stripHtml(q.questionText)}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {q.options.map((opt) => (
                <Button
                  key={opt}
                  variant={answers[q.id] === opt ? 'default' : 'outline'}
                  onClick={() => handleAnswer(q.id, opt)}
                  className="text-left"
                >
                  {stripHtml(opt)}
                </Button>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
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

      {/* Submission Modal */}
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
