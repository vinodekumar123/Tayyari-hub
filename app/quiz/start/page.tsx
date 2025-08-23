'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Clock, BookOpen, Send, Flag, Check } from 'lucide-react';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
}

interface QuizData {
  title: string;
  duration: number; // in minutes
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
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [hasLoadedTime, setHasLoadedTime] = useState(false);

  const [darkMode, setDarkMode] = useState(false);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fiveMinWarnedRef = useRef(false);

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

  // Load quiz and existing attempt
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

  // Timer with auto-submit and 5-min warning
  useEffect(() => {
    if (!quiz || !hasLoadedTime || isAdmin) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    if (!fiveMinWarnedRef.current && timeLeft <= 300) {
      fiveMinWarnedRef.current = true;
      if (typeof window !== 'undefined') {
        // Non-blocking alert replacement could be used (toast). Using alert for simplicity.
        try { alert('⏰ 5 minutes remaining! Please review flagged questions.'); } catch {}
      }
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

  const persistAttempt = (updated: Partial<{ answers: Record<string, string>; currentIndex: number; remainingTime: number; flags: string[] }>) => {
    if (!user || !quizId) return;
    setDoc(
      doc(db, 'users', user.uid, 'quizAttempts', quizId),
      updated,
      { merge: true }
    );
  };

  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    if (quiz) {
      persistAttempt({
        answers: updatedAnswers,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft,
      });
    }
  };

  const toggleFlag = (qid: string) => {
    setFlags((prev) => {
      const newFlags = new Set(prev);
      if (newFlags.has(qid)) newFlags.delete(qid); else newFlags.add(qid);
      // Persist flags as array
      persistAttempt({ flags: Array.from(newFlags) });
      return newFlags;
    });
  };

  const handleSubmit = async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setSubmitLoading(true);

    if (!user || !quiz) return;
    await setDoc(
      doc(db, 'users', user.uid, 'quizAttempts', quizId!),
      {
        submittedAt: serverTimestamp(),
        completed: true,
        answers,
      },
      { merge: true }
    );

    setShowSubmissionModal(true);
    setTimeout(() => {
      setShowSubmissionModal(false);
      router.push(
        isAdmin || quiz.resultVisibility === 'immediate'
          ? '/quiz/results?id=' + quizId
          : '/dashboard/student'
      );
    }, 1600);
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return h !== '00' ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading || !quiz) return <p className="text-center py-10">Loading Quiz...</p>;

  const questionsPerPage = quiz.questionsPerPage || 1;
  const totalPages = Math.ceil(quiz.selectedQuestions.length / questionsPerPage);
  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = quiz.selectedQuestions.slice(startIdx, endIdx);
  const isLastPage = currentPage >= totalPages - 1;

  const totalAnswered = Object.keys(answers).length;
  const progressValue = (totalAnswered / quiz.selectedQuestions.length) * 100;

  const getTimerColor = () => {
    if (timeLeft <= 300) return 'text-red-500';
    if (timeLeft <= 600) return 'text-orange-500';
    return 'text-green-500';
  };

  const goToQuestionIndex = (qIndex: number) => {
    const pageForQ = Math.floor(qIndex / questionsPerPage);
    setCurrentPage(pageForQ);
    // Persist current index as the first question on that page
    persistAttempt({ currentIndex: pageForQ * questionsPerPage, remainingTime: timeLeft });
    scrollToTop();
  };

  return (
    <div className={darkMode ? 'min-h-screen bg-gray-900 text-white px-4' : 'min-h-screen bg-gray-50 text-black px-4'}>
      {/* Dark mode toggle */}
      <div className="fixed top-5 right-5 z-50">
        <Button onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode">
          {darkMode ? '☀ Light Mode' : '🌙 Dark Mode'}
        </Button>
      </div>

      {/* Header */}
      <header className={darkMode ? 'bg-gray-800 border-b border-gray-700 sticky top-0 z-50 shadow-md' : 'bg-white border-b border-gray-200 sticky top-0 z-50 shadow-md'}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className={darkMode ? 'h-6 w-6 text-blue-400' : 'h-6 w-6 text-blue-600'} />
            <h1 className="text-lg font-semibold">{quiz.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" aria-hidden="true" />
            <span className={`font-mono font-semibold ${getTimerColor()}`} aria-live="polite">{formatTime(timeLeft)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex-1">
            <Progress value={progressValue} className="h-3 rounded-sm w-full bg-gray-200 dark:bg-gray-700" />
          </div>
          <span className="ml-3 text-sm font-medium">{Math.round(progressValue)}%</span>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto p-4">
        {qSlice.map((q, idx) => (
          <Card
            key={q.id}
            className={`mb-6 rounded-2xl shadow-md transition ${darkMode ? 'border border-gray-700 bg-gray-800' : 'border border-gray-200 bg-white'}`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-white font-semibold shadow-sm ${darkMode ? 'bg-gradient-to-r from-blue-600 to-cyan-400' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}>
                  {startIdx + idx + 1}
                </div>
                <CardTitle className="text-lg font-semibold flex-1">{stripHtml(q.questionText)}</CardTitle>
                <button
                  onClick={() => toggleFlag(q.id)}
                  className="ml-2 p-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400"
                  aria-pressed={flags.has(q.id)}
                  aria-label={flags.has(q.id) ? 'Unflag question' : 'Flag question'}
                >
                  <Flag className={`h-5 w-5 ${flags.has(q.id) ? 'text-red-500' : 'text-gray-400'}`} />
                </button>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              {q.options.map((opt, optIdx) => {
                const isSelected = answers[q.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(q.id, opt)}
                    className={`w-full px-4 py-3 rounded-xl text-left font-medium transition border shadow-sm flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                      ${darkMode
                        ? `border-gray-600 bg-gray-700 hover:border-blue-400 focus-visible:ring-blue-400 ${isSelected ? 'bg-blue-600 text-white' : 'text-gray-200'}`
                        : `border-gray-300 bg-white hover:border-blue-500 hover:shadow-md focus-visible:ring-blue-500 ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-800'}`}`}
                    aria-pressed={isSelected}
                  >
                    <span className="font-bold" aria-hidden="true">{String.fromCharCode(65 + optIdx)}.</span>
                    <span>{stripHtml(opt)}</span>
                    {isSelected && <Check className="ml-auto h-5 w-5" aria-label="Selected" />}
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-4 gap-2">
          <Button onClick={() => { setCurrentPage((p) => Math.max(0, p - 1)); scrollToTop(); }} disabled={currentPage === 0}>
            <ArrowLeft className="mr-2" /> Previous
          </Button>
          {!isLastPage && (
            <Button onClick={() => { setCurrentPage((p) => Math.min(totalPages - 1, p + 1)); scrollToTop(); }}>
              Next <ArrowRight className="ml-2" />
            </Button>
          )}
          {isLastPage && (
            <Button onClick={handleSubmit} disabled={submitLoading}>
              {submitLoading ? 'Submitting...' : 'Submit'} <Send className="ml-2" />
            </Button>
          )}
        </div>

        {/* Flagged Questions List with navigation */}
        {flags.size > 0 && (
          <div className="mt-6 p-4 rounded-xl border bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            <h3 className="font-semibold mb-2">🚩 Flagged Questions</h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(flags).map((qid) => {
                const qIndex = quiz.selectedQuestions.findIndex((qq) => qq.id === qid);
                if (qIndex === -1) return null;
                return (
                  <button
                    key={qid}
                    onClick={() => goToQuestionIndex(qIndex)}
                    className="px-3 py-1 rounded-lg bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-400"
                    aria-label={`Go to question ${qIndex + 1}`}
                  >
                    Q{qIndex + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Unanswered summary (inline hint) */}
        {quiz.selectedQuestions.length - totalAnswered > 0 && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Unanswered: {quiz.selectedQuestions.length - totalAnswered}</p>
        )}
      </main>

      <Dialog open={showSubmissionModal} onOpenChange={setShowSubmissionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Quiz Submitted!</DialogTitle>
            <DialogDescription>Redirecting to results...</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StartQuizPage;
