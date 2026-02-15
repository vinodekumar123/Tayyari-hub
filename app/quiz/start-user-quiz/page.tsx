'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from '@/app/firebase';
import {
  doc, getDoc, setDoc, serverTimestamp, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, ArrowRight, BookOpen, Clock, Send, CheckCircle, Flag,
  WifiOff, Save, Loader2, Info, Layout, ChevronRight, AlertCircle,
  BookMarked, Sparkles
} from 'lucide-react';
import { useAutoSave, QuizProgress } from '../start/hooks/useAutoSave';
import { toast } from 'sonner';
import { ModeToggle } from '@/components/mode-toggle';
import { SanitizedContent } from '@/components/SanitizedContent';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  chapter?: string;
  subject?: string;
  difficulty?: string;
}

interface UserQuizDoc {
  name: string;
  subject: string;
  chapters: string[];
  selectedQuestions: any[];
  createdBy: string;
  duration: number;
  questionCount: number;
  createdAt: any;
  questionsPerPage?: number;
}

const stripHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

function cleanObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  } else if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value === undefined) {
        acc[key] = null;
      } else if (Array.isArray(value) || (value && typeof value === 'object')) {
        acc[key] = cleanObject(value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
  }
  return obj;
}

const StartUserQuizPageContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id') as string;
  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<UserQuizDoc | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [attemptCount, setAttemptCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [questionsPerPage, setQuestionsPerPage] = useState(1);

  // Premium UI States
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingSteps = [
    { label: 'Authenticating', icon: '🔐' },
    { label: 'Loading mock data', icon: '📋' },
    { label: 'Restoring progress', icon: '📊' },
    { label: 'Ready', icon: '✅' },
  ];
  const [isOnline, setIsOnline] = useState(true);

  // --- Auto-save Hook ---
  const { saveState, debouncedSave, saveImmediately, startTimerSync, stopTimerSync } = useAutoSave({
    user,
    quizId,
    isAdmin: false, // For mock quizzes, we usually track even for teachers if they use the student view
    debounceMs: 500,
    timerSyncIntervalMs: 30000,
    collectionPath: 'user-quizattempts'
  });

  const getProgressRef = useRef<() => QuizProgress>(() => ({
    answers,
    flags,
    currentIndex: currentPage * questionsPerPage,
    remainingTime: timeLeft,
  }));

  useEffect(() => {
    getProgressRef.current = () => ({
      answers,
      flags,
      currentIndex: currentPage * questionsPerPage,
      remainingTime: timeLeft,
    });
  }, [answers, flags, currentPage, timeLeft, questionsPerPage]);

  // Online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingStep(1);
      if (!u) {
        toast.error('Please login to access the quiz');
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Load quiz and restore progress
  useEffect(() => {
    if (!quizId || !user) return;

    const load = async () => {
      try {
        setLoadingStep(1); // Loading quiz data
        const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
        if (!quizSnap.exists()) {
          toast.error('Quiz not found');
          router.push('/dashboard/student');
          return;
        }

        const quizData = quizSnap.data() as UserQuizDoc;
        setQuiz(quizData);

        const loadedQuestions: Question[] = (quizData.selectedQuestions || []).map((q: any) => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          chapter: q.chapter,
          subject: q.subject,
          difficulty: q.difficulty,
        }));
        setQuestions(loadedQuestions);
        setQuestionsPerPage(loadedQuestions.length || 1); // Force all on one page

        setLoadingStep(2); // Restoring progress
        const attemptDocRef = doc(db, 'users', user.uid, 'user-quizattempts', quizId);
        const attemptSnap = await getDoc(attemptDocRef);

        if (attemptSnap.exists() && attemptSnap.data().completed) {
          setAlreadyCompleted(true);
          setLoading(false);
          return;
        }

        if (attemptSnap.exists() && !attemptSnap.data().completed) {
          const at = attemptSnap.data();
          setAnswers(at.answers || {});
          setFlags(at.flags || {});
          setCurrentPage(0); // Always page 0 as it's single page now
          setTimeLeft(at.remainingTime ?? quizData.duration * 60);
          setAttemptCount(at.attemptNumber || 0);
        } else {
          setTimeLeft(quizData.duration * 60);
          setAnswers({});
          setFlags({});
          setCurrentPage(0);
          await setDoc(attemptDocRef, {
            startedAt: serverTimestamp(),
            answers: {},
            flags: {},
            currentIndex: 0,
            completed: false,
            remainingTime: quizData.duration * 60,
            quizType: 'user',
          }, { merge: true });
        }

        setLoadingStep(3); // Ready
        setTimeout(() => {
          setHasLoadedTime(true);
          setLoading(false);
        }, 500);
      } catch (err: any) {
        console.error('Failed to load quiz:', err);
        setError('Error loading quiz: ' + (err?.message || String(err)));
        setLoading(false);
      }
    };

    load();
  }, [quizId, user, router]);

  // Timer sync
  const isAdmin = false;
  useEffect(() => {
    if (loading || !quiz || isAdmin) return;
    startTimerSync(() => getProgressRef.current());
    return () => stopTimerSync();
  }, [loading, quiz, startTimerSync, stopTimerSync]);

  // Local Timer Countdown
  useEffect(() => {
    if (loading || !hasLoadedTime || alreadyCompleted) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, hasLoadedTime, alreadyCompleted]);

  // Auto-submit on time out
  useEffect(() => {
    if (!loading && hasLoadedTime && timeLeft === 0 && !alreadyCompleted && !hasSubmittedRef.current) {
      toast.info("Time's up! Submitting your test...");
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, loading, hasLoadedTime, alreadyCompleted]);

  // Cleanup on unload
  useEffect(() => {
    const handleUnload = () => {
      if (user && quiz && !hasSubmittedRef.current) {
        saveImmediately(getProgressRef.current());
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user, quiz, saveImmediately]);

  // Handlers
  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    debouncedSave({
      ...getProgressRef.current(),
      answers: updatedAnswers
    });
  };

  const toggleFlag = (qid: string) => {
    const updatedFlags = { ...flags, [qid]: !flags[qid] };
    if (!updatedFlags[qid]) delete updatedFlags[qid];
    setFlags(updatedFlags);
    debouncedSave({
      ...getProgressRef.current(),
      flags: updatedFlags
    });
  };

  const handleSubmit = async () => {
    if (hasSubmittedRef.current || isSubmitting) return;
    if (!user || !quiz) {
      toast.error('Quiz not fully loaded');
      return;
    }

    // Show summary modal if not already shown (optional, usually handled by UI button)
    // Here we assume it's called from Confirm button in modal

    hasSubmittedRef.current = true;
    setIsSubmitting(true);

    try {
      if (!navigator.onLine) throw new Error('No Internet Connection');

      let score = 0;
      const detailed = questions.map(q => {
        const selected = answers[q.id] || null;
        const correct = q.correctAnswer || null;
        const isCorrect = (selected && correct && selected === correct) || false;
        if (isCorrect) score += 1;

        return {
          questionId: q.id,
          questionText: q.questionText,
          selected,
          correct,
          isCorrect,
          explanation: q.explanation || null,
          options: q.options,
          chapter: q.chapter || null,
          subject: q.subject || null,
          difficulty: q.difficulty || null,
        };
      });

      const attemptPath = doc(db, 'users', user.uid, 'user-quizattempts', quizId);
      await setDoc(attemptPath, {
        submittedAt: serverTimestamp(),
        answers: cleanObject(answers),
        flags: cleanObject(flags),
        completed: true,
        remainingTime: 0,
        attemptNumber: attemptCount + 1,
        quizType: 'user',
        detailed: cleanObject(detailed),
        score,
        total: questions.length,
      }, { merge: true });

      await updateDoc(doc(db, "users", user.uid), {
        usedMockQuestionIds: arrayUnion(...questions.map(q => q.id)),
      });

      // Update aggregated stats
      try {
        const { updateStudentStats } = await import('@/app/lib/student-stats');
        await updateStudentStats(user.uid, {
          quizId,
          score,
          total: questions.length,
          answers,
          selectedQuestions: questions,
          subject: quiz.subject,
          timestamp: serverTimestamp() as any
        }, 'user');
      } catch (e) {
        console.warn("Stats update failed", e);
      }

      setShowSubmissionModal(true);
      setShowSummaryModal(false);
      setTimeout(() => {
        router.push(`/dashboard/student/user-responses?id=${quizId}`);
      }, 2500);

    } catch (err: any) {
      console.error('Submission failed:', err);
      toast.error('Submission failed: ' + err.message);
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
    }
  };

  if (alreadyCompleted) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <Card className="max-w-md w-full shadow-2xl overflow-hidden border-0 group">
          <div className="h-2 w-full bg-red-500" />
          <CardHeader className="text-center pt-8">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-black text-gray-800 dark:text-gray-100">Attempt Blocked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8 text-center">
            <p className="text-muted-foreground font-medium">
              You have already completed this mock quiz. Standard practice allows only one attempt per mock to ensure data integrity.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 shadow-lg shadow-blue-600/20"
                onClick={() => router.push(`/admin/students/user-responses?id=${quizId}`)}
              >
                <Layout className="w-4 h-4 mr-2" /> View Detailed Results
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => router.push('/dashboard/student')}
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Loading State ---
  if (loading || !quiz) {
    const currentStep = loadingStep;
    const progressPercent = ((currentStep + 1) / loadingSteps.length) * 100;

    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-6 p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full mx-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-3xl animate-pulse">
            {loadingSteps[currentStep].icon}
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Preparing Your Mock</h2>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="w-full space-y-2">
            {loadingSteps.map((step, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all ${i === currentStep
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : i < currentStep
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-400 dark:text-gray-600'
                  }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${i < currentStep
                  ? 'bg-green-500 text-white'
                  : i === currentStep
                    ? 'bg-blue-500 text-white animate-pulse'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                  }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className="text-sm font-medium">{step.label}</span>
                {i === currentStep && (
                  <div className="ml-auto">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            {loadingSteps[currentStep].label}...
          </p>
        </div>
      </div>
    );
  }

  // PAGINATION LOGIC
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const isLastPage = currentPage >= totalPages - 1;
  const startIdx = currentPage * questionsPerPage;
  const endIdx = Math.min(startIdx + questionsPerPage, questions.length);
  const qSlice = questions.slice(startIdx, endIdx);

  const attemptedCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
  const flaggedCount = Object.keys(flags).filter((k) => flags[k]).length;
  const attemptedPercent = Math.round((attemptedCount / questions.length) * 100);

  const skippedQuestionIndexes = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !answers[q.id] || answers[q.id] === '')
    .map(({ idx }) => idx + 1);

  const flaggedQuestionIndexes = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => flags[q.id])
    .map(({ idx }) => idx + 1);

  const jumpToQuestion = (oneBasedIndex: number) => {
    const zeroIndex = oneBasedIndex - 1;
    const newPage = Math.floor(zeroIndex / questionsPerPage);
    setCurrentPage(newPage);
    setShowSummaryModal(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 select-none pb-20">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
          <WifiOff className="w-4 h-4" />
          You are offline. Progress is being saved locally.
        </div>
      )}

      {/* Modals */}
      <Dialog open={showSubmissionModal} onOpenChange={setShowSubmissionModal}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <DialogTitle className="text-2xl font-bold">Mock Submitted!</DialogTitle>
            <DialogDescription className="text-lg">
              Analyzing your performance. Redirecting to results...
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Review Your Progress
            </DialogTitle>
            <DialogDescription>
              Check skipped or flagged questions before final submission.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl text-center border border-blue-100 dark:border-blue-900/30">
                <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400">{attemptedCount}</p>
                <p className="text-[10px] uppercase font-bold text-blue-600/70">Answered</p>
              </div>
              <div className="p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl text-center border border-orange-100 dark:border-orange-900/30">
                <p className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">{skippedQuestionIndexes.length}</p>
                <p className="text-[10px] uppercase font-bold text-orange-600/70">Skipped</p>
              </div>
              <div className="p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl text-center border border-yellow-100 dark:border-yellow-900/30">
                <p className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{flaggedCount}</p>
                <p className="text-[10px] uppercase font-bold text-yellow-600/70">Flagged</p>
              </div>
            </div>

            {skippedQuestionIndexes.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                  <AlertCircle className="w-4 h-4" /> Skipped Questions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {skippedQuestionIndexes.map(n => (
                    <Button key={n} variant="outline" size="sm" onClick={() => jumpToQuestion(n)} className="w-10 h-10 p-0 rounded-lg hover:border-blue-500 hover:text-blue-600">
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t mt-4">
              <Button variant="ghost" onClick={() => setShowSummaryModal(false)}>Continue Mock</Button>
              <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700 text-white min-w-[140px] shadow-lg shadow-red-600/20">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : <><Send className="w-4 h-4 mr-2" /> Finish & Submit</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b sticky top-0 z-40 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center relative">
          <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="hidden sm:flex p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
              <BookMarked className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs">{quiz.name}</h1>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                <Badge variant="outline" className="text-[9px] sm:text-[10px] h-3.5 sm:h-4 py-0 bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-1">Mock</Badge>
                <span className="hidden xs:inline">•</span>
                <span className="hidden xs:inline truncate max-w-[80px] sm:max-w-none">{quiz.subject}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-8 shrink-0">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Clock className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} />
                <span className={`font-mono text-base sm:text-lg font-bold leading-none ${timeLeft < 300 ? 'text-red-600' : 'text-foreground'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-tighter text-muted-foreground">Remaining</span>
            </div>

            <div className="hidden md:block w-32 border-l pl-8">
              <div className="flex justify-between text-[10px] font-bold uppercase mb-1">
                <span>Progress</span>
                <span className="text-blue-600">{attemptedPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${attemptedPercent}%` }} />
              </div>
            </div>

            <div className="flex items-center">
              <ModeToggle />
            </div>
          </div>

          {/* Mobile Progress Bar (Absolute Bottom) */}
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-800 md:hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${attemptedPercent}%` }} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 sm:p-8 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32 sm:pb-8">
        <div className="flex flex-col gap-6">
          {qSlice.map((q, idx) => (
            <Card key={q.id} className="border-primary/10 shadow-lg overflow-hidden transition-all group hover:border-primary/30">
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                      Question {startIdx + idx + 1}
                    </span>
                    <SanitizedContent
                      className="text-lg font-bold leading-relaxed prose dark:prose-invert max-w-none pt-2"
                      content={q.questionText}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFlag(q.id)}
                    className={`rounded-full h-10 w-10 p-0 transition-all ${flags[q.id] ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 shadow-inner ring-2 ring-yellow-500/20' : 'bg-secondary/50 text-muted-foreground hover:bg-yellow-50 hover:text-yellow-600'}`}
                  >
                    <Flag className={`h-4 w-4 ${flags[q.id] ? 'fill-yellow-600' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-8">
                <div className="grid gap-3">
                  {q.options.map((opt, i) => {
                    const isSelected = answers[q.id] === opt;
                    return (
                      <label
                        key={i}
                        className={`
                            relative flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group/opt
                            ${isSelected
                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                            : 'border-border/50 bg-background hover:bg-accent/50 hover:border-blue-500/30'}
                          `}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          className="w-4 h-4 text-blue-600 transition-all border-2 border-muted"
                          checked={isSelected}
                          onChange={() => handleAnswer(q.id, opt)}
                        />
                        <div className={`ml-4 flex items-center gap-3 w-full`}>
                          <span className={`
                                flex items-center justify-center w-6 h-6 rounded-md text-xs font-black transition-colors
                                ${isSelected ? 'bg-blue-600 text-white' : 'bg-secondary text-muted-foreground group-hover/opt:bg-blue-100 dark:group-hover/opt:bg-blue-900/30 group-hover/opt:text-blue-600'}
                             `}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <SanitizedContent
                            className={`text-sm sm:text-base prose dark:prose-invert max-w-none ${isSelected ? 'font-semibold text-blue-900 dark:text-blue-300' : 'text-foreground'}`}
                            content={opt}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Floating Navigation Controls */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent z-40 sm:relative sm:bg-none sm:p-0">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 bg-card sm:bg-transparent border border-primary/10 sm:border-0 p-3 sm:p-0 rounded-2xl shadow-2xl sm:shadow-none backdrop-blur-sm sm:backdrop-blur-none transition-all">
            {totalPages > 1 && (
              <Button
                variant="outline"
                size="lg"
                className="h-12 sm:h-14 rounded-xl px-4 sm:px-8 border-primary/20 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-primary transition-all font-bold disabled:opacity-30"
                onClick={() => {
                  setCurrentPage(prev => Math.max(0, prev - 1));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={currentPage === 0 || isSubmitting}
              >
                <ArrowLeft className="mr-0 sm:mr-3 h-5 w-5" />
                <span className="hidden sm:inline">Previous Section</span>
              </Button>
            )}

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === currentPage ? 'w-4 bg-blue-600' : 'bg-muted'}`}
                  />
                ))}
              </div>
            )}

            <Button
              size="lg"
              className={`
                  h-12 sm:h-14 rounded-xl px-4 sm:px-8 font-black shadow-xl transition-all duration-300 group
                  ${isLastPage
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                  : 'bg-primary text-primary-foreground hover:shadow-primary/30'}
                `}
              onClick={isLastPage ? () => setShowSummaryModal(true) : () => {
                setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={isSubmitting}
            >
              <span className="hidden sm:inline">{isLastPage ? 'Finish Mock' : 'Next Questions'}</span>
              <span className="sm:hidden">{isLastPage ? 'Finish' : 'Next'}</span>
              {isLastPage ? <Send className="ml-0 sm:ml-3 h-5 w-5" /> : <ArrowRight className="ml-0 sm:ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />}
            </Button>
          </div>
        </div>
      </main>

      {/* Auto-save Status Indicator (Floating Mini) */}
      <div className="fixed bottom-20 sm:bottom-6 right-6 z-50">
        <div className={`
             flex items-center gap-2 px-3 py-1.5 rounded-full border bg-card/80 backdrop-blur-sm shadow-xl transition-all duration-500
             ${saveState.status === 'saving' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}
          `}>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Syncing Progress</span>
        </div>
        <div className={`
             flex items-center gap-2 px-3 py-1.5 rounded-full border bg-green-500/10 border-green-500/20 backdrop-blur-sm shadow-xl transition-all duration-500
             ${saveState.status === 'saved' ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}
          `}>
          <CheckCircle className="w-3 h-3 text-green-600" />
          <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Cloud Saved</span>
        </div>
      </div>
    </div>
  );
};

const StartUserQuizPage = () => {
  return (
    <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <StartUserQuizPageContent />
    </React.Suspense>
  );
};

export default StartUserQuizPage;
