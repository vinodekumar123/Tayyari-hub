'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/app/firebase';
import { useAutoSave, QuizProgress } from './hooks/useAutoSave';
import { QuizTimer } from '@/components/quiz/QuizTimer';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowLeft, ArrowRight, BookOpen, Flag, Save, LogOut, Loader2, Cloud, CloudOff, WifiOff, Download, Info, Edit, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { ModeToggle } from '@/components/mode-toggle';
import jsPDF from 'jspdf';

// --- Type Definitions ---
interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  subject?: string | { id: string; name: string };
  graceMark?: boolean;
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
  accessType?: 'public' | 'series' | 'paid';
  series?: string[];
}

// --- Helper Functions ---
const stripHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const escapeHtml = (text: string): string => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

const timeoutPromise = <T,>(ms: number, promise: Promise<T>): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms)),
  ]);
};

// --- Main Component ---
const StartQuizPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quizId = searchParams.get('id')!;

  // --- State ---
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);

  // Loading steps: 0=auth, 1=quiz data, 2=progress, 3=ready
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingSteps = [
    { label: 'Authenticating', icon: '🔐' },
    { label: 'Loading quiz data', icon: '📋' },
    { label: 'Restoring progress', icon: '📊' },
    { label: 'Ready', icon: '✅' },
  ];

  // Modal states
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');

  // Refs
  const timeRef = useRef(0);
  const hasSubmittedRef = useRef(false);
  const handleSubmitRef = useRef<((force?: boolean) => Promise<void>) | null>(null);

  // Online status
  const [isOnline, setIsOnline] = useState(true);

  // Scroll buttons
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Time tracking
  const [pageStartTime, setPageStartTime] = useState<number>(Date.now());
  const [timeLogs, setTimeLogs] = useState<Record<string, number>>({});

  // --- Auto-save Hook ---
  const { saveState, debouncedSave, saveImmediately, startTimerSync, stopTimerSync, retrySave } = useAutoSave({
    user,
    quizId,
    isAdmin,
    debounceMs: 500,
    timerSyncIntervalMs: 30000,
  });

  // Progress getter for timer sync
  const getProgressRef = useRef<() => QuizProgress>(() => ({
    answers,
    flags,
    currentIndex: currentPage * (quiz?.questionsPerPage || 1),
    remainingTime: timeRef.current,
  }));

  useEffect(() => {
    getProgressRef.current = () => ({
      answers,
      flags,
      currentIndex: currentPage * (quiz?.questionsPerPage || 1),
      remainingTime: timeRef.current,
    });
  }, [answers, flags, currentPage, quiz]);

  // --- Memoized Computed Values ---
  const questionsPerPage = quiz?.questionsPerPage || 1;

  const { groupedQuestions, flattenedQuestions, pageGroupedQuestions, totalPages, isLastPage, startIdx, endIdx } = useMemo(() => {
    if (!quiz?.selectedQuestions) {
      return {
        groupedQuestions: {},
        flattenedQuestions: [],
        pageGroupedQuestions: {},
        totalPages: 0,
        isLastPage: false,
        startIdx: 0,
        endIdx: 0,
      };
    }

    const grouped = quiz.selectedQuestions.reduce((acc, question) => {
      const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
      if (!acc[subjectName]) acc[subjectName] = [];
      acc[subjectName].push(question);
      return acc;
    }, {} as Record<string, Question[]>);

    const flattened = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([_, questions]) => questions);

    const sIdx = currentPage * questionsPerPage;
    const eIdx = sIdx + questionsPerPage;
    const slice = flattened.slice(sIdx, eIdx);

    const pageGrouped = slice.reduce((acc, question) => {
      const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
      if (!acc[subjectName]) acc[subjectName] = [];
      acc[subjectName].push(question);
      return acc;
    }, {} as Record<string, Question[]>);

    return {
      groupedQuestions: grouped,
      flattenedQuestions: flattened,
      pageGroupedQuestions: pageGrouped,
      totalPages: Math.ceil(flattened.length / questionsPerPage),
      isLastPage: currentPage >= Math.ceil(flattened.length / questionsPerPage) - 1,
      startIdx: sIdx,
      endIdx: eIdx,
    };
  }, [quiz?.selectedQuestions, currentPage, questionsPerPage]);

  const attemptedCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
  const flaggedCount = Object.keys(flags).filter((k) => flags[k]).length;
  const attemptedPercent = flattenedQuestions.length > 0 ? Math.round((attemptedCount / flattenedQuestions.length) * 100) : 0;

  const { skippedIndices, flaggedIndices } = useMemo(() => {
    const ski: number[] = [];
    const fla: number[] = [];
    flattenedQuestions.forEach((q, i) => {
      const isAns = answers[q.id] !== undefined && answers[q.id] !== '';
      if (!isAns) ski.push(i + 1);
      if (flags[q.id]) fla.push(i + 1);
    });
    return { skippedIndices: ski, flaggedIndices: fla };
  }, [flattenedQuestions, answers, flags]);

  // --- Effects ---

  // Auth listener
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      setLoadingStep(1); // Move to step 1: Loading quiz data

      // If auth resolved but no user, redirect to login
      if (!u) {
        toast.error('Please login to access the quiz');
        router.push('/auth/login?redirect=/quiz/start?id=' + quizId);
      }
    });
    return () => unsubscribe();
  }, [quizId, router]);

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

  // Scroll buttons
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
      setShowScrollBottom(window.scrollY < document.body.scrollHeight - window.innerHeight - 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load quiz and restore progress
  useEffect(() => {
    if (!quizId || !user) return;

    const load = async () => {
      try {
        // Fetch user profile to check admin status
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        // Allow Teachers, Admins, and SuperAdmins
        const adminStatus = userData?.role === 'teacher' || userData?.role === 'admin' || userData?.role === 'superadmin' || userData?.admin === true || userData?.superadmin === true;
        setIsAdmin(adminStatus);

        // Fetch quiz data
        const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
        if (!quizDoc.exists()) {
          toast.error('Quiz not found');
          router.push('/dashboard/student');
          return;
        }

        const quizData = quizDoc.data() as QuizData;
        setQuiz(quizData);

        // Access Control Check (skip for admin)
        if (!adminStatus) {
          setLoadingStep(0); // Validating
          // SERVER-SIDE VALIDATION
          try {
            const validateRes = await fetch('/api/quiz/validate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quizId, userId: user.uid, userRole: userData?.role || 'student' }),
            });

            const validateData = await validateRes.json();

            if (!validateRes.ok || !validateData.valid) {
              const errorMsg = validateData.primaryError || validateData.errors?.[0] || 'Access denied';
              toast.error(errorMsg);
              setAccessDeniedMessage(errorMsg);
              setShowAccessDenied(true);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error("Validation check failed", err);
            // Optional: Decide if you want to block or allow if API fails
            // For security, usually fail-safe (block) or warn
            // toast.error("Could not verify quiz schedule. Please check connection.");
          }
        }

        // Access Control Check (Double check series locally if needed, but API covers it)
        if (!adminStatus && quizData.accessType === 'series') {
          setLoadingStep(2); // Checking access locally (legacy check)

          // Fetch user enrollments
          const enrollmentsSnap = await getDocs(
            query(
              collection(db, 'enrollments'),
              where('studentId', '==', user.uid),
              where('status', '==', 'active')
            )
          );

          const enrolledSeriesIds = new Set(
            enrollmentsSnap.docs.map(doc => doc.data().seriesId)
          );

          // Check if user is enrolled in any of the quiz's required series
          const hasAccess = quizData.series?.some(sId => enrolledSeriesIds.has(sId));

          if (!hasAccess) {
            setAccessDeniedMessage(
              'This quiz is restricted to enrolled students. Please enroll in the required series to access this quiz.'
            );
            setShowAccessDenied(true);
            setLoading(false);
            return;
          }
        }

        // Check attempt limits (skip for admin)
        if (!adminStatus) {
          const attemptsSnapshot = await getDocs(
            query(collection(db, 'users', user.uid, 'quizAttempts'), where('completed', '==', true))
          );
          let completedAttempts = 0;
          attemptsSnapshot.docs.forEach((docSnap) => {
            if (docSnap.id === quizId && docSnap.data()?.completed) {
              completedAttempts = docSnap.data().attemptNumber || 1;
            }
          });

          if (completedAttempts >= quizData.maxAttempts) {
            toast.error('Maximum attempts reached for this quiz.');
            router.push('/dashboard/student');
            return;
          }
          setAttemptCount(completedAttempts);
        }

        // Check for incomplete attempt to resume
        const attemptSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));
        if (attemptSnap.exists() && !attemptSnap.data().completed) {
          // Resume
          const data = attemptSnap.data();
          setAnswers(data.answers || {});
          setFlags(data.flags || {});
          setCurrentPage(Math.floor((data.currentIndex || 0) / (quizData.questionsPerPage || 1)));
          if (!adminStatus && data.remainingTime !== undefined) {
            timeRef.current = data.remainingTime;
          } else {
            timeRef.current = quizData.duration * 60;
          }
        } else {
          // New attempt
          timeRef.current = quizData.duration * 60;
          setAnswers({});
          setFlags({});
          setCurrentPage(0);

          // Initialize attempt document
          if (!adminStatus) {
            await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
              startedAt: serverTimestamp(),
              answers: {},
              flags: {},
              currentIndex: 0,
              completed: false,
              remainingTime: quizData.duration * 60,
            }, { merge: true });
          }
        }

        setHasLoadedTime(true);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load quiz:', error);
        toast.error('Failed to load quiz');
        router.push('/dashboard/student');
      }
    };

    load();
  }, [quizId, user, router]);

  // Save on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (user && quiz && !isAdmin && !hasSubmittedRef.current) {
        saveImmediately({
          answers,
          flags,
          currentIndex: currentPage * (quiz.questionsPerPage || 1),
          remainingTime: timeRef.current,
        });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [answers, flags, currentPage, quiz, user, isAdmin, saveImmediately]);

  // Start timer sync
  useEffect(() => {
    if (!quiz || loading || isAdmin) return;
    startTimerSync(() => getProgressRef.current());
    return () => stopTimerSync();
  }, [quiz, loading, isAdmin, startTimerSync, stopTimerSync]);

  // --- Handlers ---

  const handleAnswer = useCallback((qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    debouncedSave({
      answers: updatedAnswers,
      flags,
      currentIndex: currentPage * (quiz?.questionsPerPage || 1),
      remainingTime: timeRef.current,
    });
  }, [answers, flags, currentPage, quiz, debouncedSave]);

  const toggleFlag = useCallback((qid: string) => {
    const updatedFlags = { ...flags, [qid]: !flags[qid] };
    if (!updatedFlags[qid]) delete updatedFlags[qid];
    setFlags(updatedFlags);
    debouncedSave({
      answers,
      flags: updatedFlags,
      currentIndex: currentPage * (quiz?.questionsPerPage || 1),
      remainingTime: timeRef.current,
    });
  }, [answers, flags, currentPage, quiz, debouncedSave]);

  const updateTimeSpent = useCallback(() => {
    if (!quiz) return;
    const now = Date.now();
    const spent = Math.floor((now - pageStartTime) / 1000);
    const qSlice = flattenedQuestions.slice(startIdx, endIdx);
    if (qSlice.length === 0) return;
    const perQuestionTime = Math.max(1, Math.floor(spent / qSlice.length));
    setTimeLogs((prev) => {
      const next = { ...prev };
      qSlice.forEach((q) => { next[q.id] = (next[q.id] || 0) + perQuestionTime; });
      return next;
    });
    setPageStartTime(now);
  }, [quiz, pageStartTime, flattenedQuestions, startIdx, endIdx]);

  const handleNextPage = useCallback(() => {
    updateTimeSpent();
    const newPage = currentPage + 1;
    setCurrentPage(newPage);
    debouncedSave({
      answers,
      flags,
      currentIndex: newPage * (quiz?.questionsPerPage || 1),
      remainingTime: timeRef.current,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateTimeSpent, currentPage, answers, flags, quiz, debouncedSave]);

  const handlePrevPage = useCallback(() => {
    updateTimeSpent();
    const newPage = Math.max(0, currentPage - 1);
    setCurrentPage(newPage);
    debouncedSave({
      answers,
      flags,
      currentIndex: newPage * (quiz?.questionsPerPage || 1),
      remainingTime: timeRef.current,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateTimeSpent, currentPage, answers, flags, quiz, debouncedSave]);

  const jumpToQuestion = useCallback((oneBasedIndex: number) => {
    const newPage = Math.floor((oneBasedIndex - 1) / questionsPerPage);
    setCurrentPage(newPage);
    setShowSummaryModal(false);
    debouncedSave({
      answers,
      flags,
      currentIndex: newPage * (quiz?.questionsPerPage || 1),
      remainingTime: timeRef.current,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [questionsPerPage, answers, flags, quiz, debouncedSave]);

  const handleSubmit = useCallback(async (force = false) => {
    if (!force && (isSubmitting || hasSubmittedRef.current)) return;
    if (!user || !quiz) return;

    // Show confirmation modal if not forced and time remaining
    if (!force && !showSummaryModal && timeRef.current > 0 && !isAdmin) {
      setShowSummaryModal(true);
      return;
    }

    setShowSummaryModal(false);
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    updateTimeSpent();

    try {
      if (!navigator.onLine) throw new Error('No Internet Connection');

      // Calculate score
      let score = 0;
      for (const question of quiz.selectedQuestions) {
        if (question.graceMark || answers[question.id] === question.correctAnswer) {
          score += 1;
        }
      }

      const total = quiz.selectedQuestions.length;
      const newAttemptCount = attemptCount + 1;
      const cleanAnswers = JSON.parse(JSON.stringify(answers));
      const cleanFlags = JSON.parse(JSON.stringify(flags));

      const resultData = {
        quizId,
        title: quiz.title,
        score,
        total,
        timestamp: serverTimestamp(),
        answers: cleanAnswers,
        flags: cleanFlags,
        attemptNumber: newAttemptCount,
      };

      // Save results
      await timeoutPromise(15000, Promise.all([
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId, 'results', quizId), resultData),
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
          submittedAt: serverTimestamp(),
          completed: true,
          remainingTime: 0,
          attemptNumber: newAttemptCount,
          score,
          total,
        }, { merge: true }),
      ]));

      // Update stats (non-blocking)
      try {
        const { updateStudentStats } = await import('@/app/lib/student-stats');
        await updateStudentStats(user.uid, {
          quizId,
          score,
          total,
          answers: cleanAnswers,
          selectedQuestions: quiz.selectedQuestions,
          subject: Array.isArray(quiz.subject)
            ? quiz.subject.map((s: any) => s.name || s)
            : typeof quiz.subject === 'object'
              ? (quiz.subject as any)?.name
              : quiz.subject,
          timestamp: serverTimestamp() as any,
        }, 'admin');
      } catch (statsErr) {
        console.warn('Stats update failed:', statsErr);
      }

      setShowSubmissionModal(true);
      setTimeout(() => {
        router.push(`/dashboard/student/responses?id=${quizId}&mock=false&studentId=${user.uid}`);
      }, 2000);
    } catch (error: any) {
      console.error('Submission failed:', error);
      toast.error('Submission failed. Please try again.');
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
    }
  }, [isSubmitting, user, quiz, showSummaryModal, isAdmin, updateTimeSpent, answers, attemptCount, quizId, flags, router]);

  // Keep submit ref updated
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleSaveAndLeave = useCallback(async () => {
    if (!user || !quiz || isAdmin) return;
    await saveImmediately({
      answers,
      flags,
      currentIndex: currentPage * (quiz.questionsPerPage || 1),
      remainingTime: timeRef.current,
    });
    toast.success('Progress saved! You can resume later.');
    router.push('/dashboard/student');
  }, [user, quiz, isAdmin, saveImmediately, answers, flags, currentPage, router]);

  // Export functions
  const generatePDF = useCallback((withAnswers: boolean) => {
    if (!quiz) return;
    const pdf = new jsPDF();
    let y = 20;
    pdf.setFontSize(18);
    pdf.text(quiz.title, 105, y, { align: 'center' });
    y += 15;

    quiz.selectedQuestions.forEach((q, i) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFontSize(12);
      pdf.text(`Q${i + 1}. ${stripHtml(q.questionText)}`, 10, y, { maxWidth: 180 });
      y += 10;
      q.options.forEach((opt, j) => {
        const prefix = ['A', 'B', 'C', 'D'][j];
        pdf.text(`${prefix}. ${stripHtml(opt)}`, 15, y, { maxWidth: 175 });
        y += 7;
      });
      if (withAnswers && q.correctAnswer) {
        pdf.setTextColor(0, 128, 0);
        pdf.text(`Answer: ${stripHtml(q.correctAnswer)}`, 15, y);
        pdf.setTextColor(0, 0, 0);
        y += 10;
      }
      y += 5;
    });

    pdf.save(`${quiz.title}${withAnswers ? '_with_answers' : ''}.pdf`);
  }, [quiz]);

  const generateWord = useCallback((withAnswers: boolean) => {
    if (!quiz) return;
    let content = `<html><head><meta charset="utf-8"><title>${escapeHtml(quiz.title)}</title></head><body>`;
    content += `<h1>${escapeHtml(quiz.title)}</h1>`;

    quiz.selectedQuestions.forEach((q, i) => {
      content += `<p><strong>Q${i + 1}.</strong> ${q.questionText}</p><ul>`;
      q.options.forEach((opt, j) => {
        content += `<li>${['A', 'B', 'C', 'D'][j]}. ${opt}</li>`;
      });
      content += '</ul>';
      if (withAnswers && q.correctAnswer) {
        content += `<p style="color:green;"><strong>Answer:</strong> ${q.correctAnswer}</p>`;
      }
    });

    content += '</body></html>';
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quiz.title}${withAnswers ? '_with_answers' : ''}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [quiz]);

  // --- Loading State ---
  if (authLoading || loading || !quiz) {
    const currentStep = authLoading ? 0 : !quiz ? 1 : loadingStep;
    const progressPercent = ((currentStep + 1) / loadingSteps.length) * 100;

    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-6 p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full mx-4">
          {/* Logo/Icon */}
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-3xl animate-pulse">
            {loadingSteps[currentStep].icon}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Preparing Your Quiz</h2>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Steps */}
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

          {/* Current Status */}
          <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            {loadingSteps[currentStep].label}...
          </p>
        </div>
      </div>
    );
  }

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          You are offline. Progress is saved locally and will sync when reconnected.
        </div>
      )}

      {/* Modals */}
      <Dialog open={showTimeoutModal} onOpenChange={setShowTimeoutModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Time&apos;s Up!</DialogTitle>
          </DialogHeader>
          <p>Your quiz has been automatically submitted.</p>
        </DialogContent>
      </Dialog>

      <Dialog open={showSubmissionModal} onOpenChange={setShowSubmissionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              Quiz Submitted!
            </DialogTitle>
          </DialogHeader>
          <p>Redirecting to results...</p>
        </DialogContent>
      </Dialog>

      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Quiz</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={() => { generatePDF(false); setShowDownloadModal(false); }}>PDF (Questions Only)</Button>
            <Button onClick={() => { generatePDF(true); setShowDownloadModal(false); }}>PDF (With Answers)</Button>
            <Button onClick={() => { generateWord(false); setShowDownloadModal(false); }}>Word (Questions Only)</Button>
            <Button onClick={() => { generateWord(true); setShowDownloadModal(false); }}>Word (With Answers)</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Before Submit</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{flaggedCount}</p>
                <p className="text-xs uppercase font-semibold text-muted-foreground">Flagged</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{skippedIndices.length}</p>
                <p className="text-xs uppercase font-semibold text-muted-foreground">Skipped</p>
              </div>
            </div>

            {/* Flagged Section */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Flag className="w-4 h-4 text-yellow-500" /> Flagged Questions
              </h3>
              {flaggedIndices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {flaggedIndices.map((num) => (
                    <button
                      key={`flag-${num}`}
                      onClick={() => jumpToQuestion(num)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50 text-xs font-bold transition-colors border border-yellow-200 dark:border-yellow-800"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No flagged questions.</p>
              )}
            </div>

            {/* Skipped Section */}
            <div>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-gray-500" /> Skipped Questions
              </h3>
              {skippedIndices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skippedIndices.map((num) => (
                    <button
                      key={`skip-${num}`}
                      onClick={() => jumpToQuestion(num)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 text-xs font-bold transition-colors border border-gray-200 dark:border-gray-700"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">All questions answered!</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowSaveConfirm(true)}>
                <Save className="w-4 h-4 mr-2" /> Save & Exit
              </Button>
              <Button variant="outline" onClick={() => setShowSummaryModal(false)}>Keep Reviewing</Button>
              <Button onClick={() => handleSubmit(true)} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20">
                Confirm Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save & Exit?</AlertDialogTitle>
            <AlertDialogDescription>Your progress will be saved. You can resume later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndLeave} className="bg-blue-600">
              <Save className="w-4 h-4 mr-2" /> Save & Exit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Access Denied Modal */}
      <AlertDialog open={showAccessDenied} onOpenChange={setShowAccessDenied}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Access Restricted
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base pt-2">
              {accessDeniedMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* Conditionally show help only if it's an enrollment error */}
          {(accessDeniedMessage.toLowerCase().includes('enrolled') || accessDeniedMessage.toLowerCase().includes('series')) && (
            <div className="py-4 flex flex-col gap-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium">💡 How to get access:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Go to your Dashboard</li>
                  <li>Browse available Series</li>
                  <li>Enroll in the required series</li>
                </ul>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => router.push('/dashboard/student')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Go to Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Loading Overlay */}
      {
        isSubmitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 p-8 bg-white dark:bg-gray-900 shadow-2xl rounded-2xl">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-gray-800 dark:text-gray-200 font-medium">Submitting...</p>
            </div>
          </div>
        )
      }

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h1 className="text-base sm:text-lg font-semibold truncate max-w-[200px] sm:max-w-md text-gray-900 dark:text-gray-100">
                  {quiz.title}
                </h1>
                {isAdmin && <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Admin Mode</Badge>}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Save Status */}
              {!isAdmin && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${saveState.status === 'saving' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                    saveState.status === 'saved' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' :
                      saveState.status === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
                        'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                    }`}
                  onClick={saveState.status === 'error' ? retrySave : undefined}
                  title={saveState.status === 'error' ? 'Click to retry' : saveState.lastSavedAt ? `Last saved: ${saveState.lastSavedAt.toLocaleTimeString()}` : 'Auto-saving'}
                >
                  {saveState.status === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /><span className="hidden sm:inline">Saving...</span></>}
                  {saveState.status === 'saved' && <><Cloud className="w-3 h-3" /><span className="hidden sm:inline">Saved</span></>}
                  {saveState.status === 'error' && <><CloudOff className="w-3 h-3" /><span className="hidden sm:inline">Retry</span></>}
                  {saveState.status === 'idle' && <><Cloud className="w-3 h-3" /><span className="hidden sm:inline">Auto-save</span></>}
                </div>
              )}

              {/* Timer */}
              <QuizTimer
                initialTime={timeRef.current}
                onTimeUp={() => handleSubmitRef.current?.(true)}
                timeRef={timeRef}
                isAdmin={isAdmin}
              />

              <ModeToggle />

              {/* Save & Exit */}
              {!isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowSaveConfirm(true)} className="hidden sm:flex">
                  <LogOut className="w-4 h-4 mr-2" />
                  Save & Exit
                </Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${attemptedPercent}%` }} />
          </div>
        </div>
      </header>

      {/* Admin Controls */}
      {
        isAdmin && (
          <div className="max-w-6xl mx-auto px-4 mt-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-yellow-700 dark:text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200">Admin Mode</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">Timer disabled. Unlimited attempts.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <span className="text-sm font-medium">Show Answers</span>
                  <div
                    onClick={() => setShowAnswers(!showAnswers)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${showAnswers ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showAnswers ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>
                <Button variant="outline" onClick={() => setShowDownloadModal(true)} className="bg-white dark:bg-gray-800">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4">
        <Card className="shadow-md border-none bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex justify-between items-center text-gray-900 dark:text-gray-100">
              <span>Questions {startIdx + 1}–{Math.min(endIdx, flattenedQuestions.length)} / {flattenedQuestions.length}</span>
              {isAdmin && showAnswers && <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">Answers Visible</span>}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-10">
            {Object.entries(pageGroupedQuestions).map(([subject, questions]) => (
              <div key={subject} className="space-y-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 border-b dark:border-gray-800 pb-2">{subject}</h2>
                {questions.map((q, idx) => {
                  const globalIdx = flattenedQuestions.findIndex((fq) => fq.id === q.id);
                  const isCorrectVisible = isAdmin && showAnswers;

                  return (
                    <div key={q.id} className={`space-y-4 p-4 rounded-lg ${isCorrectVisible ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800' : ''}`}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-lg font-medium prose dark:prose-invert max-w-none flex-1 group relative break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                          <span className="font-bold text-slate-700 dark:text-slate-300">Q{globalIdx + 1}. </span>
                          <span dangerouslySetInnerHTML={{ __html: q.questionText }} />
                          {isAdmin && (
                            <a
                              href={`/admin/questions/create?edit=${q.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-600"
                            >
                              <Edit className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => toggleFlag(q.id)}
                          className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${flags[q.id] ? 'text-yellow-500' : 'text-slate-300 dark:text-slate-600'}`}
                        >
                          <Flag className="w-5 h-5 fill-current" />
                        </button>
                      </div>

                      <div className="grid gap-3">
                        {q.options.map((opt, i) => {
                          const isSelected = answers[q.id] === opt;
                          const isCorrect = isCorrectVisible && opt === q.correctAnswer;

                          let borderClass = 'border-gray-200 dark:border-gray-700';
                          let bgClass = 'bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800';

                          if (isSelected) {
                            borderClass = 'border-blue-500 ring-1 ring-blue-500';
                            bgClass = 'bg-blue-50 dark:bg-blue-900/20';
                          }
                          if (isCorrect) {
                            borderClass = 'border-green-500 ring-2 ring-green-500';
                            bgClass = 'bg-green-50 dark:bg-green-900/20';
                          }

                          return (
                            <label
                              key={i}
                              className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${borderClass} ${bgClass} relative overflow-hidden group`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                value={opt}
                                checked={isSelected}
                                onChange={() => handleAnswer(q.id, opt)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="ml-3 text-sm font-medium flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-500 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-600 transition-colors">
                                  {['A', 'B', 'C', 'D'][i]}
                                </div>
                                <span className="prose dark:prose-invert max-w-none break-words" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }} dangerouslySetInnerHTML={{ __html: opt }} />
                              </div>
                              {isCorrect && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-green-500" />}
                            </label>
                          );
                        })}
                      </div>

                      {isCorrectVisible && q.explanation && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200">
                          <p className="font-bold flex items-center gap-2 mb-1">
                            <Info className="w-4 h-4" /> Explanation:
                          </p>
                          <div
                            className="prose dark:prose-invert max-w-none break-words overflow-auto"
                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                            dangerouslySetInnerHTML={{ __html: q.explanation }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Navigation */}
            <div className="flex justify-between pt-8 border-t dark:border-gray-800">
              <Button variant="outline" onClick={handlePrevPage} disabled={currentPage === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button onClick={isLastPage ? () => handleSubmit() : handleNextPage} className={isLastPage ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}>
                {isLastPage ? 'Submit Quiz' : 'Next'} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Scroll Buttons */}
      <div className="fixed right-4 bottom-6 z-50 flex flex-col items-center gap-3">
        {showScrollTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <ArrowUp className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
        )}
        {showScrollBottom && (
          <button
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
            className="bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <ArrowDown className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
        )}
      </div>
    </div >
  );
};

// --- Page Wrapper ---
const StartQuizPage = () => {
  return (
    <React.Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
        </div>
      }
    >
      <StartQuizPageContent />
    </React.Suspense>
  );
};

export default StartQuizPage;
