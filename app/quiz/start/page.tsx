'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Clock, BookOpen, Send, Flag, Check, ArrowUp, ArrowDown } from 'lucide-react';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
}

interface QuizData {
  title: string;
  duration: number; // minutes
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [timeLeft, setTimeLeft] = useState(0); // seconds
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fiveMinWarnedRef = useRef(false);
  const lastTimeSaveRef = useRef(0);

  // --- helpers ---
  const persistAttempt = (updated: Partial<{
    answers: Record<string, string>;
    currentIndex: number;
    remainingTime: number;
    flags: string[];
    completed: boolean;
  }>) => {
    if (!user || !quizId) return;
    return setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), updated, { merge: true });
  };

  const questionsPerPage = quiz?.questionsPerPage || 1;
  const totalPages = quiz ? Math.ceil(quiz.selectedQuestions.length / questionsPerPage) : 0;

  // --- Auth ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userSnap = await getDoc(doc(db, 'users', u.uid));
        if (userSnap.exists()) setIsAdmin(userSnap.data().admin === true);
      }
    });
    return () => unsub();
  }, []);

  // --- Load quiz + attempt ---
  useEffect(() => {
    if (!quizId || !user) return;
    (async () => {
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
        setFlags(new Set(saved.flags || []));
        const idx = Math.max(0, Math.min((saved.currentIndex ?? 0), Math.max(0, quizData.selectedQuestions.length - 1)));
        setCurrentPage(Math.floor(idx / (quizData.questionsPerPage || 1)));
        setTimeLeft(saved.remainingTime ?? quizData.duration * 60);
      } else {
        setAnswers({});
        setFlags(new Set());
        setCurrentPage(0);
        setTimeLeft(quizData.duration * 60);
        // create a fresh attempt shell so subsequent merges always succeed
        await persistAttempt({
          answers: {},
          flags: [],
          currentIndex: 0,
          remainingTime: quizData.duration * 60,
          completed: false,
        });
      }

      setHasLoadedTime(true);
      setLoading(false);
    })();
  }, [quizId, user, router]);

  // --- Timer + auto-submit on 0 ---
  useEffect(() => {
    if (!quiz || !hasLoadedTime || isAdmin) return;
    if (timeLeft <= 0) {
      handleSubmit(); // on timeout, submit immediately (no confirm to avoid blocking)
      return;
    }
    if (!fiveMinWarnedRef.current && timeLeft <= 300) {
      fiveMinWarnedRef.current = true;
      try { alert('⏰ 5 minutes remaining! Please review flagged questions.'); } catch {}
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, quiz, hasLoadedTime, isAdmin]);

  // --- Debounced autosave of time + currentIndex (every ~5s) ---
  useEffect(() => {
    if (!quiz || !user) return;
    const now = Date.now();
    if (now - lastTimeSaveRef.current > 5000) {
      lastTimeSaveRef.current = now;
      persistAttempt({
        remainingTime: timeLeft,
        currentIndex: currentPage * questionsPerPage,
      });
    }
  }, [timeLeft, currentPage, questionsPerPage, quiz, user]);

  // --- Save on visibility change / tab close ---
  useEffect(() => {
    if (!quiz || !user) return;
    const saveNow = () => {
      persistAttempt({
        remainingTime: timeLeft,
        currentIndex: currentPage * questionsPerPage,
        answers,
        flags: Array.from(flags),
      });
    };
    const onHide = () => {
      if (document.hidden) saveNow();
    };
    window.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', saveNow);
    return () => {
      window.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', saveNow);
    };
  }, [quiz, user, timeLeft, currentPage, questionsPerPage, answers, flags]);

  // --- Handlers ---
  const handleAnswer = (qid: string, val: string) => {
    const updated = { ...answers, [qid]: val };
    setAnswers(updated);
    persistAttempt({
      answers: updated,
      currentIndex: currentPage * questionsPerPage,
      remainingTime: timeLeft,
    });
  };

  const toggleFlag = (qid: string) => {
    setFlags((prev) => {
      const next = new Set(prev);
      next.has(qid) ? next.delete(qid) : next.add(qid);
      persistAttempt({ flags: Array.from(next) });
      return next;
    });
  };

  const gotoPage = (p: number) => {
    const newPage = Math.max(0, Math.min(p, totalPages - 1));
    setCurrentPage(newPage);
    persistAttempt({
      currentIndex: newPage * questionsPerPage,
      remainingTime: timeLeft,
    });
    scrollToTop();
  };

  const confirmSubmit = () => setShowConfirmDialog(true);

  const handleSubmit = async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setSubmitLoading(true);
    if (!user || !quizId) return;

    await setDoc(
      doc(db, 'users', user.uid, 'quizAttempts', quizId),
      {
        submittedAt: serverTimestamp(),
        completed: true,
        answers,
        flags: Array.from(flags),
        remainingTime: Math.max(0, timeLeft),
      },
      { merge: true }
    );

    setShowSubmissionModal(true);
    setTimeout(() => {
      setShowSubmissionModal(false);
      router.push(
        isAdmin || quiz?.resultVisibility === 'immediate'
          ? `/quiz/results?id=${quizId}`
          : '/dashboard/student'
      );
    }, 1600);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

  // --- render ---
  if (loading || !quiz) return <p className="text-center py-10">Loading Quiz...</p>;

  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = quiz.selectedQuestions.slice(startIdx, endIdx);
  const isLastPage = currentPage >= totalPages - 1;

  const totalAnswered = Object.keys(answers).length;
  const unansweredCount = quiz.selectedQuestions.length - totalAnswered;
  const flaggedCount = flags.size;
  const progressValue = (totalAnswered / quiz.selectedQuestions.length) * 100;

  return (
    <div className={darkMode ? 'min-h-screen bg-gray-900 text-white px-4' : 'min-h-screen bg-gray-50 text-black px-4'}>
      {/* Dark mode toggle */}
      <div className="fixed top-5 right-5 z-50">
        <Button onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode">
          {darkMode ? '☀ Light Mode' : '🌙 Dark Mode'}
        </Button>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 shadow-md bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-lg font-semibold">{quiz.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span className="font-mono font-semibold" aria-live="polite">{formatTime(timeLeft)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <Progress value={progressValue} className="h-3 rounded-sm w-full" />
          <span className="ml-3 text-sm font-medium">{Math.round(progressValue)}%</span>
        </div>
      </header>

      <main className="max-w-4xl w-full mx-auto p-4">
        {qSlice.map((q, idx) => (
          <Card key={q.id} className="mb-6 rounded-2xl shadow-md border bg-white dark:bg-gray-800">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-full text-white font-semibold bg-gradient-to-r from-blue-500 to-cyan-400">
                  {startIdx + idx + 1}
                </div>
                <CardTitle className="flex-1">{stripHtml(q.questionText)}</CardTitle>
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
                    className={`w-full px-4 py-3 rounded-xl text-left font-medium transition border flex items-center gap-2
                      ${darkMode
                        ? `${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`
                        : `${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-800 hover:bg-blue-50 border-gray-300'}`}`}
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

        {/* Navigation */}
        <div className="flex justify-between mt-4 gap-2">
          <Button onClick={() => gotoPage(currentPage - 1)} disabled={currentPage === 0}>
            <ArrowLeft className="mr-2" /> Previous
          </Button>
          {!isLastPage && (
            <Button onClick={() => gotoPage(currentPage + 1)}>
              Next <ArrowRight className="ml-2" />
            </Button>
          )}
          {isLastPage && (
            <Button onClick={confirmSubmit} disabled={submitLoading}>
              {submitLoading ? 'Submitting...' : 'Submit'} <Send className="ml-2" />
            </Button>
          )}
        </div>

        {/* Flagged quick nav */}
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
                    onClick={() => gotoPage(Math.floor(qIndex / questionsPerPage))}
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

        {/* Unanswered hint */}
        {unansweredCount > 0 && (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">Unanswered: {unansweredCount}</p>
        )}
      </main>

      {/* Floating scroll buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        <Button onClick={scrollToTop} size="icon" className="rounded-full shadow-md"><ArrowUp /></Button>
        <Button onClick={scrollToBottom} size="icon" className="rounded-full shadow-md"><ArrowDown /></Button>
      </div>

      {/* Confirm submission dialog (shows counts) */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>
              You have <b>{unansweredCount}</b> unanswered and <b>{flaggedCount}</b> flagged questions.
              Are you sure you want to submit?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Yes, Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission done dialog */}
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
