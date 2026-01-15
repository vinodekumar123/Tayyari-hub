'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDebounce } from './hooks/useDebounce';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/app/firebase';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Info, BookOpen, Clock, Send, Download, CheckCircle, Flag, ArrowUp, ArrowDown, Edit, WifiOff, AlertTriangle, Save, LogOut, Loader2, Grip, X } from 'lucide-react';
import { QuestionCard } from './components/QuestionCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ModeToggle } from '@/components/mode-toggle';
import DOMPurify from 'dompurify'; // XSS protection
import { Question } from '@/types';



// FIX: Extract magic numbers to constants
const AUTOSAVE_DEBOUNCE_MS = 3000;
const LOCALSTORAGE_DEBOUNCE_MS = 2000;
const REDIRECT_DELAY_MS = 2000;
const SCROLL_BUTTON_THRESHOLD_PX = 300;
const SCROLL_BOTTOM_OFFSET_PX = 100;
const MAX_VIOLATION_COUNT = 3;
const VIOLATION_AUTO_SUBMIT_DELAY_MS = 1000;

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
  accessType?: 'public' | 'series' | 'free' | 'paid';
  series?: string[];
}

const stripHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

const StartQuizPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  // FIX: Validate quiz ID exists
  const quizId = searchParams.get('id');

  // Declare all state FIRST before any effects that use them
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'teacher' | 'student'>('student');
  const [quizMode, setQuizMode] = useState<'preview' | 'attempt' | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // Track auth loading state
  const [quiz, setQuiz] = useState<QuizData | null>(null);

  // Early return if no quiz ID - but wait for auth to load first
  useEffect(() => {
    if (!quizId && user !== null) {
      // Only redirect after we know the user's role
      router.push(isAdmin ? '/dashboard/admin' : '/dashboard/student');
    }
  }, [quizId, router, isAdmin, user]);

  if (!quizId) {
    return <div className="flex justify-center items-center min-h-screen">Redirecting...</div>;
  }
  const [showAnswers, setShowAnswers] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [timeLogs, setTimeLogs] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loader state
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showNavGrid, setShowNavGrid] = useState(false);
  const [validationError, setValidationError] = useState<{ title: string; message: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restoredRef = useRef(false);
  const handleSubmitRef = useRef<((force?: boolean) => Promise<void>) | null>(null);

  // FIX: Single source of truth for time tracking
  const [quizStartTime] = useState(Date.now());
  const [pageStartTime, setPageStartTime] = useState<number>(Date.now());
  const [currentPageQuestions, setCurrentPageQuestions] = useState<string[]>([]);

  // scroll button visibility states
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [violationCount, setViolationCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  // FIX: Debounced autosave to API (reduces Firestore writes by 90%)
  const debouncedAutosave = useDebounce(async (data: {
    answers: Record<string, string>;
    flags: Record<string, boolean>;
    currentIndex: number;
    remainingTime: number;
  }) => {
    // Skip autosave for admins to avoid cluttering DB
    if (!user || !quizId || isAdmin) return;

    try {
      const response = await fetch('/api/quiz/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          userId: user.uid,
          ...data
        })
      });

      if (!response.ok) {
        console.error('Autosave failed:', await response.text());
      }
    } catch (error) {
      console.error('Autosave error:', error);
    }
  }, 3000); // Save every 3 seconds max

  // FIX: Debounced localStorage writes to avoid blocking main thread
  const debouncedLocalSave = useDebounce((data: { answers: Record<string, string>; flags: Record<string, boolean> }) => {
    if (!quizId || !user) return;
    const backupKey = `quiz_backup_${user.uid}_${quizId}`;
    try {
      localStorage.setItem(backupKey, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage save failed:', e);
    }
  }, 2000); // Save to localStorage every 2 seconds

  // Anti-Cheating & Robustness Hooks
  useEffect(() => {
    if (isAdmin) return; // Admins are exempt

    // 1. Connectivity Monitoring
    const handleOnline = () => { setIsOnline(true); toast.success("You are back online!"); };
    const handleOffline = () => { setIsOnline(false); toast.error("You are offline. Answers will be saved locally."); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Disable Context Menu & Copy/Paste
    const preventEvents = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', preventEvents);
    document.addEventListener('copy', preventEvents);
    document.addEventListener('paste', preventEvents);
    document.addEventListener('cut', preventEvents);
    document.addEventListener('selectstart', preventEvents);

    // 3. Tab Visibility (Tab Switch Detection with ENFORCEMENT)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationCount(prev => {
          const newCount = prev + 1;

          // FIX: Enforce auto-submit after 3 violations
          if (newCount >= 3) {
            toast.error('Maximum violations reached. Auto-submitting quiz.', {
              icon: <AlertTriangle className="text-red-500" />,
              duration: 3000
            });
            // Auto-submit via ref to avoid deps issue
            setTimeout(() => {
              handleSubmitRef.current?.(true);
            }, 1000);
          } else {
            toast.warning(`Warning: Please stay on this tab! (${newCount}/3 violations)`, {
              icon: <AlertTriangle className="text-yellow-500" />,
              duration: 4000
            });
          }
          return newCount;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('contextmenu', preventEvents);
      document.removeEventListener('copy', preventEvents);
      document.removeEventListener('paste', preventEvents);
      document.removeEventListener('cut', preventEvents);
      document.removeEventListener('selectstart', preventEvents);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdmin]);

  // Helper: Timeout Promise
  const timeoutPromise = <T,>(ms: number, promise: Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Operation timed out (15s)')), ms);
      promise.then(
        (res) => { clearTimeout(timer); resolve(res); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  };

  // Keyboard Shortcuts Removed per request

  // Local Storage Backup Hook
  useEffect(() => {
    if (!quizId || !user) return;
    const backupKey = `quiz_backup_${user.uid}_${quizId}`;

    // Restore only once on mount if there is a saved backup; avoid directly reading `answers` to satisfy lint rules
    if (restoredRef.current) return;
    const saved = localStorage.getItem(backupKey);
    if (saved) {
      try {
        const { answers: savedAnswers, flags: savedFlags } = JSON.parse(saved);
        if (savedAnswers) {
          setAnswers(prev => (Object.keys(prev).length === 0 ? { ...prev, ...savedAnswers } : prev));
        }
        if (savedFlags) {
          setFlags(prev => (Object.keys(prev).length === 0 ? { ...prev, ...savedFlags } : prev));
        }
        toast.info("Restored progress from local backup");
      } catch (e) { console.error("Backup load failed", e); }
    }
    restoredRef.current = true;
  }, [quizId, user]);

  // FIX: Use debounced localStorage save instead of blocking main thread
  useEffect(() => {
    if (!quizId || !user) return;
    debouncedLocalSave({ answers, flags });
  }, [answers, flags, quizId, user, debouncedLocalSave]);


  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userSnap = await getDoc(doc(db, 'users', u.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          // Enhanced role detection - check multiple possible fields
          let role: 'admin' | 'teacher' | 'student' = 'student';

          if (data.admin === true) {
            role = 'admin';
          } else if (data.role === 'teacher' || data.role === 'Teacher' || data.isTeacher === true || data.teacher === true) {
            role = 'teacher';
          } else if (data.role === 'admin' || data.role === 'Admin') {
            role = 'admin';
          } else if (data.role) {
            role = data.role.toLowerCase() as 'admin' | 'teacher' | 'student';
          }

          setUserRole(role);
          setIsAdmin(role === 'admin' || role === 'teacher');
        }
      }
      // Mark auth as loaded after determining admin status
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Wait for auth to complete before validating
    if (!quizId || !user || authLoading) return;

    const load = async () => {
      let loadedQuiz: QuizData;
      // Server-side validation integration
      try {
        const validationRes = await timeoutPromise(15000, fetch('/api/quiz/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizId, userId: user.uid, userRole })
        }));

        if (!validationRes.ok) {
          const errorData = await validationRes.json();
          const errorMessage = errorData.primaryError || errorData.error || 'Access Denied';
          const errorDescription = errorData.errors?.join(' ') || 'Unable to access this quiz.';

          // Show clear error and set state
          setValidationError({ title: errorMessage, message: errorDescription });
          setLoading(false);
          return; // Don't redirect - show error modal instead
        }

        const { valid, quiz: quizDataRes, mode, currentAttemptCount, maxAttempts } = await validationRes.json();
        loadedQuiz = quizDataRes;

        setQuiz(loadedQuiz as QuizData);
        setQuizMode(mode || 'attempt');
        if (mode === 'attempt') setAttemptCount(currentAttemptCount || 0);

      } catch (err: any) {
        console.error("Validation error:", err);
        // Show detailed error in modal instead of redirecting
        setValidationError({
          title: "Connection Error",
          message: err.message || "Failed to validate quiz access. Please check your internet connection and try again."
        });
        setLoading(false);
        return;
      }


      // Check for an incomplete attempt
      const resumeSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));
      if (resumeSnap.exists() && !resumeSnap.data().completed && resumeSnap.data().attemptNumber === undefined) {
        // Resume incomplete attempt
        const rt = resumeSnap.data() as any;
        setAnswers(rt.answers || {});
        setFlags(rt.flags || {});
        const questionIndex = rt.currentIndex || 0;
        setCurrentPage(Math.floor(questionIndex / (loadedQuiz.questionsPerPage || 1)));
        if (!isAdmin && rt.remainingTime !== undefined) {
          setTimeLeft(rt.remainingTime);
        } else {
          setTimeLeft(loadedQuiz.duration * 60);
        }
      } else {
        // New attempt: reset timer and THEN initialize doc (after validation)
        setTimeLeft(loadedQuiz.duration * 60);
        setAnswers({});
        setFlags({});
        setCurrentPage(0);
        await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
          startedAt: serverTimestamp(),
          answers: {},
          flags: {},
          currentIndex: 0,
          completed: false,
          remainingTime: loadedQuiz.duration * 60,
        }, { merge: true });
      }

      setHasLoadedTime(true);
      setLoading(false);
    };

    load();
  }, [quizId, user, userRole, authLoading, router]);

  useEffect(() => {
    // Preview Mode Bypass: Timer Logic Disabled for admin/teacher
    if (quizMode === 'preview') return;

    if (loading || !quiz || showTimeoutModal || showSubmissionModal || !hasLoadedTime) return;

    if (timeLeft <= 0) {
      // call via ref to avoid adding handleSubmit to effect deps
      handleSubmitRef.current?.();
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current!);
  }, [loading, quiz, showTimeoutModal, showSubmissionModal, hasLoadedTime, timeLeft, quizMode]);

  useEffect(() => {
    const handleUnload = () => {
      if (user && quiz && quizMode !== 'preview' && !hasSubmittedRef.current) {
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
          answers,
          flags,
          currentIndex: currentPage * (quiz.questionsPerPage || 1),
          remainingTime: timeLeft,
        }, { merge: true });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [answers, flags, currentPage, timeLeft, quiz, user, quizMode, quizId]);

  // FIX: Use debounced API autosave instead of direct Firestore write
  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);

    // Debounced save via API - skip in preview mode
    if (user && quiz && quizMode !== 'preview') {
      debouncedAutosave({
        answers: updatedAnswers,
        flags,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft
      });
    }
  };

  // FIX: Use debounced API autosave instead of direct Firestore write
  const toggleFlag = (qid: string) => {
    const updatedFlags = { ...flags, [qid]: !flags[qid] };
    if (!updatedFlags[qid]) delete updatedFlags[qid];
    setFlags(updatedFlags);

    // Debounced save via API - skip in preview mode
    if (user && quiz && quizMode !== 'preview') {
      debouncedAutosave({
        answers,
        flags: updatedFlags,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft
      });
    }
  };

  // ... (keep updateTimeSpent and other helpers same)
  const updateTimeSpent = () => {
    // same implementation
    if (!quiz) return;
    const now = Date.now();
    const spent = Math.floor((now - pageStartTime) / 1000);
    const questionsPerPage = quiz.questionsPerPage || 1;
    const startIdx = currentPage * questionsPerPage;
    const endIdx = startIdx + questionsPerPage;
    const qSlice = flattenedQuestions.slice(startIdx, endIdx);
    if (qSlice.length === 0) return;
    const perQuestionTime = Math.max(1, Math.floor(spent / qSlice.length));
    setTimeLogs(prev => {
      const next = { ...prev };
      qSlice.forEach(q => { next[q.id] = (next[q.id] || 0) + perQuestionTime; });
      return next;
    });
    setPageStartTime(now);
  };
  // FIX: Only update time on page change, not every navigation
  const handleNextPage = () => {
    if (quiz) updateTimeSpent();
    setCurrentPage(prev => prev + 1);
  };
  const handlePrevPage = () => {
    if (quiz) updateTimeSpent();
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  // FIX: Consolidated submission logic with single guard and timer cleanup
  const handleSubmit = async (force: boolean = false) => {
    // Preview Mode: Just return to dashboard
    if (quizMode === 'preview') {
      toast.info('Preview mode - returning to dashboard');
      const dashboardPath = userRole === 'admin' ? '/dashboard/admin' : userRole === 'teacher' ? '/dashboard/teacher' : '/dashboard/student';
      router.push(dashboardPath);
      return;
    }
    // SINGLE GUARD: Check if already submitting or submitted
    if (hasSubmittedRef.current || isSubmitting) {
      console.log('Submission blocked: already in progress or completed');
      return;
    }

    // Show summary modal if time remaining (unless forced)
    if (!force && timeLeft > 0 && !isAdmin && !showSummaryModal) {
      setShowSummaryModal(true);
      return;
    }

    // Mark as submitted IMMEDIATELY to prevent double submission
    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setShowSummaryModal(false);

    // FIX: Clear timer to prevent memory leaks and duplicate submissions
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    updateTimeSpent();

    if (!user || !quiz) {
      console.error('Missing user or quiz data');
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
      return;
    }

    try {
      if (!navigator.onLine) throw new Error("No Internet Connection");

      // Sanitize inputs
      const cleanAnswers = JSON.parse(JSON.stringify(answers));
      const cleanFlags = JSON.parse(JSON.stringify(flags));
      const cleanTimeLogs = JSON.parse(JSON.stringify(timeLogs));

      // Use server-side submission API for security
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId,
          userId: user.uid,
          answers: cleanAnswers,
          flags: cleanFlags,
          timeLogs: cleanTimeLogs,
          attemptNumber: attemptCount + 1,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Submission failed');
      }

      const result = await response.json();

      // Show success and conditional redirect
      setShowSubmissionModal(true);
      toast.success(`Quiz submitted! Score: ${result.score}/${result.total}`);

      setTimeout(() => {
        setShowSubmissionModal(false);
        if (quiz.resultVisibility === 'immediate') {
          router.push('/dashboard/student/responses?id=' + quizId);
        } else {
          // For non-immediate results, just show alert and return to dashboard
          toast.success("Quiz submitted successfully!");
          router.push('/dashboard/student');
        }
      }, 2000);

    } catch (error: any) {
      console.error("Submission failed", error);

      if (error.message === "No Internet Connection") {
        toast.error("No Internet Connection", {
          description: "Cannot submit quiz. Please check your connection."
        });
      } else if (error.message?.includes('timed out')) {
        toast.error("Submission Timed Out", {
          description: "Server is not responding. Please try again."
        });
      } else {
        toast.error(error.message || "Submission failed. Please try again.");
      }

      // Reset states to allow retry
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
      return;
    }
  };

  // Keep a stable ref to the latest handleSubmit so effects (timer) can call it without needing it in deps
  // Assign directly to avoid creating a useEffect dep on `handleSubmit`.
  handleSubmitRef.current = handleSubmit;



  const handleSaveAndLeave = async () => {
    if (!user || !quiz || isSubmitting) return;

    // 1. Connectivity Check
    if (!navigator.onLine) {
      toast.error("No Internet Connection", { description: "Please check your network and try again." });
      return;
    }

    setIsSubmitting(true);
    updateTimeSpent();

    try {
      // 2. Timeout Wrapper (15s)
      const cleanAnswers = JSON.parse(JSON.stringify(answers));
      const cleanFlags = JSON.parse(JSON.stringify(flags));

      await timeoutPromise(15000, setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
        answers: cleanAnswers,
        flags: cleanFlags,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft,
        completed: false
      }, { merge: true }));

      toast.success("Progress saved successfully!", {
        description: "You can resume this quiz from your dashboard anytime.",
        duration: 3000,
        icon: <Save className="w-5 h-5 text-green-600" />
      });

      router.push('/dashboard/student');
    } catch (e: any) {
      console.error("Save failed", e);
      if (e.message?.includes('timed out')) {
        toast.error("Connection Timed Out", { description: "Saving is taking too long. Please check your internet." });
      } else {
        toast.error("Failed to save progress. Please try again.");
      }
    } finally {
      setIsSubmitting(false); // 3. Guaranteed Reset
    }
  };

  // FIX: Format time with hours support for long quizzes
  const formatTime = (sec: number) => {
    if (sec >= 3600) {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
      const s = (sec % 60).toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    }
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const buildExportHtmlString = (includeAnswers: boolean) => {
    const escapeHtml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (!quiz) return '';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(quiz.title)}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; color: #222; padding: 20px; background: #fff; }
          h1 { color: #003366; text-align: center; margin-bottom: 4px; }
          h2 { color: #003366; margin-top: 20px; border-bottom: 2px solid #cce0ff; padding-bottom: 6px; }
          .question { margin: 12px 0 8px 0; }
          .options { margin-left: 18px; }
          .answer { color: #006600; margin-top: 6px; font-weight: bold; }
          .meta { text-align: center; color: #666; margin-bottom: 8px; font-size: 12px; }
          .qnum { font-weight: bold; margin-right: 6px; }
          * { box-sizing: border-box; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(quiz.title)}</h1>
        <div class="meta">Date: ${new Date().toLocaleDateString()}</div>
    `;

    const groupedQuestions = quiz.selectedQuestions.reduce((acc, question) => {
      const subj = question.subject as any;
      const subjectName = typeof subj === 'object' ? subj?.name : subj || 'Uncategorized';
      if (!acc[subjectName]) {
        acc[subjectName] = [];
      }
      acc[subjectName].push(question);
      return acc;
    }, {} as Record<string, Question[]>);

    const orderedSubjects = Object.entries(groupedQuestions).sort(([a], [b]) => a.localeCompare(b));

    let globalIndex = 0;
    orderedSubjects.forEach(([subject, questions]) => {
      html += `<h2>${escapeHtml(subject)}</h2>`;
      questions.forEach((q) => {
        globalIndex += 1;
        html += `<div class="question"><span class="qnum">Q${globalIndex}.</span> ${q.questionText}</div>`;
        html += `<div class="options">`;
        q.options.forEach((opt, i) => {
          html += `<div>${String.fromCharCode(65 + i)}. ${opt}</div>`;
        });
        html += `</div>`;
        if (includeAnswers && q.correctAnswer) {
          html += `<div class="answer">Correct Answer: ${escapeHtml(stripHtml(q.correctAnswer))}</div>`;
        }
      });
    });

    html += `</body></html>`;
    return html;
  };

  const generatePDF = async (includeAnswers: boolean) => {
    if (!quiz || typeof window === 'undefined') return;

    const htmlString = buildExportHtmlString(includeAnswers);
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.background = '#ffffff';
    container.innerHTML = htmlString;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const fileNameSafe = quiz.title.replace(/[\\/:"*?<>|]+/g, '');
      const fileName = `${fileNameSafe}${includeAnswers ? '_with_answers' : ''}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation via html2canvas failed:', err);
      alert('PDF export failed. Check console for details.');
    } finally {
      document.body.removeChild(container);
    }
  };

  const generateWord = (includeAnswers: boolean) => {
    if (!quiz) return;
    const html = buildExportHtmlString(includeAnswers);
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileNameSafe = quiz.title.replace(/[\\/:"*?<>|]+/g, '');
    a.download = `${fileNameSafe}${includeAnswers ? '_with_answers' : ''}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const scrollToTop = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    if (typeof window === 'undefined') return;
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  };

  // Manage visibility of the floating scroll buttons based on scroll position
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateScrollButtons = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const innerH = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      setShowScrollTop(scrollY > 300);
      if (docHeight > innerH + 50) {
        setShowScrollBottom((innerH + scrollY) < (docHeight - 100));
      } else {
        setShowScrollBottom(false);
      }
    };
    updateScrollButtons();
    window.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      window.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [loading, quiz]);

  // FIX: Memoize expensive computations (prevents recalculation on every render)
  const questionsPerPage = quiz?.questionsPerPage || 1;

  const flattenedQuestions = useMemo(() => {
    if (!quiz) return [];
    const groupedQuestions = quiz.selectedQuestions.reduce((acc, question) => {
      const subj = question.subject as any;
      const subjectName = typeof subj === 'object' ? subj?.name : subj || 'Uncategorized';
      if (!acc[subjectName]) acc[subjectName] = [];
      acc[subjectName].push(question);
      return acc;
    }, {} as Record<string, Question[]>);

    return Object.entries(groupedQuestions)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([_, questions]) => questions);
  }, [quiz]);

  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = flattenedQuestions.slice(startIdx, endIdx);

  const pageGroupedQuestions = useMemo(() => {
    return qSlice.reduce((acc, question) => {
      const subj = question.subject as any;
      const subjectName = typeof subj === 'object' ? subj?.name : subj || 'Uncategorized';
      if (!acc[subjectName]) acc[subjectName] = [];
      acc[subjectName].push(question);
      return acc;
    }, {} as Record<string, Question[]>);
  }, [qSlice]);

  const totalPages = Math.ceil(flattenedQuestions.length / questionsPerPage);
  const isLastPage = currentPage >= totalPages - 1;
  const attemptedCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
  const flaggedCount = Object.keys(flags).filter((k) => flags[k]).length;
  const attemptedPercent = Math.round((attemptedCount / flattenedQuestions.length) * 100);

  // Indexes helpers (same)
  const skippedQuestionIndexes = flattenedQuestions.map((q, idx) => ({ q, idx })).filter(({ q }) => !answers[q.id] || answers[q.id] === '').map(({ idx }) => idx + 1);
  const flaggedQuestionIndexes = flattenedQuestions.map((q, idx) => ({ q, idx })).filter(({ q }) => flags[q.id]).map(({ idx }) => idx + 1);
  const jumpToQuestion = (oneBasedIndex: number) => { setCurrentPage(Math.floor((oneBasedIndex - 1) / questionsPerPage)); setShowSummaryModal(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (loading || !quiz) return <p className="text-center py-10">Loading...</p>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-0 sm:px-4 transition-colors duration-300">
      {/* (Modals same) */}
      {showTimeoutModal && (<Dialog open={showTimeoutModal} onOpenChange={setShowTimeoutModal}> <DialogContent> <DialogHeader> <DialogTitle>Time is Out!</DialogTitle> </DialogHeader> </DialogContent> </Dialog>)}

      {showDownloadModal && (
        <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
          <DialogContent>
            <DialogHeader><DialogTitle>Download Quiz</DialogTitle></DialogHeader>
            {/* ... download buttons ... */}
            <div className="flex flex-col gap-2 mt-4">
              <Button onClick={() => { generatePDF(false); setShowDownloadModal(false); }}>Download PDF (Questions)</Button>
              <Button onClick={() => { generatePDF(true); setShowDownloadModal(false); }}>Download PDF (Answers)</Button>
              <Button onClick={() => { generateWord(false); setShowDownloadModal(false); }}>Download Word (Questions)</Button>
              <Button onClick={() => { generateWord(true); setShowDownloadModal(false); }}>Download Word (Answers)</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {showSummaryModal && (
        <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Summary</DialogTitle></DialogHeader>
            {/* ... summary content ... */}
            <div className="space-y-4">
              <p>Answered: {attemptedCount}/{flattenedQuestions.length}</p>
              <div className="flex justify-end gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setShowSaveConfirm(true)} className="mr-auto text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-900/30">
                  <Save className="w-4 h-4 mr-2" /> Save & Later
                </Button>
                <Button variant="outline" onClick={() => setShowSummaryModal(false)}>Review</Button>
                <Button onClick={() => handleSubmit(true)} className="bg-red-600 text-white">Confirm Submit</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Validation Error Alert Dialog */}
      <AlertDialog open={!!validationError} onOpenChange={() => { }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <AlertDialogTitle className="text-xl">{validationError?.title || 'Access Denied'}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base mt-4 text-gray-600 dark:text-gray-400">
              {validationError?.message || 'You are not authorized to access this quiz.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogAction
              onClick={() => {
                const dashboardPath = userRole === 'admin' ? '/dashboard/admin' : userRole === 'teacher' ? '/dashboard/teacher' : '/dashboard/student';
                router.push(dashboardPath);
              }}
              className="bg-blue-600 hover:bg-blue-700 w-full"
            >
              Return to Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FIX: Fixed positioning to prevent layout shift */}
      <header className={`bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-40 shadow-sm transition-all duration-300`}>
        {!isOnline && (
          <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top fixed top-0 left-0 right-0 z-50">
            <WifiOff className="w-4 h-4" /> You are offline. Don&apos;t worry, your answers are saved locally and will sync when you reconnect.
          </div>
        )}

        {/* Mobile Navigation Modal */}
        <Dialog open={showNavGrid} onOpenChange={setShowNavGrid}>
          <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Question Navigator</DialogTitle>
              <DialogDescription>Jump to any question instantly</DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Progress: {Object.keys(answers).length}/{flattenedQuestions.length}</span>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Done</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full ring-2 ring-yellow-400"></div> Flag</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-1 mt-2">
              <div className="grid grid-cols-5 gap-2">
                {flattenedQuestions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isFlagged = !!flags[q.id];
                  const isCurrent = idx >= currentPage * (quiz?.questionsPerPage || 1) && idx < (currentPage + 1) * (quiz?.questionsPerPage || 1);

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        const targetPage = Math.floor(idx / (quiz?.questionsPerPage || 1));
                        setCurrentPage(targetPage);
                        setShowNavGrid(false);
                        setTimeout(() => {
                          const el = document.getElementById(`question-${q.id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      className={`
                      aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all
                      ${isCurrent ? 'ring-2 ring-offset-2 ring-blue-600 z-10' : ''}
                      ${isAnswered
                          ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}
                      ${isFlagged ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}
                    `}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mobile Nav Trigger Button - Sticky on Right Side */}
        <button
          onClick={() => setShowNavGrid(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 lg:hidden bg-blue-600 text-white p-3 rounded-l-xl shadow-lg border-y border-l border-blue-700 active:scale-95 transition-transform"
          aria-label="Open Question Navigator"
        >
          <Grip className="w-5 h-5" />
        </button>

        {/* Save & Leave Confirmation Dialog */}
        <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save & Attempt Later?</AlertDialogTitle>
              <AlertDialogDescription>
                Your progress (including answers and time spent) will be saved safely. You can resume this quiz from your dashboard at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSaveAndLeave} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" /> Save & Exit
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Full-Screen Modern Loader Overlay */}
        {isSubmitting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-4 p-8 bg-white/90 shadow-2xl rounded-2xl border border-gray-100/50">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin relative z-10" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-gray-800">Processing...</h3>
                <p className="text-sm text-gray-500 font-medium animate-pulse">Saving your progress securely</p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
              <BookOpen className="h-6 w-6 text-blue-600 flex-shrink-0" />
              <div>
                <h1 className="text-base sm:text-lg font-semibold truncate max-w-[200px] sm:max-w-md text-gray-900 dark:text-gray-100">{quiz.title}</h1>
                {isAdmin && <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-300">Admin Mode</Badge>}
              </div>
            </div>

            {/* Right Side Controls (Timer) */}
            <div className="flex items-center gap-4 ml-auto">
              {quizMode !== 'preview' && (
                <div className="flex items-center gap-2 font-mono text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full border border-red-100 dark:border-red-900/30">
                  <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
                </div>
              )}
              <ModeToggle />
              {/* Save & Exit Button - Hide in preview mode */}
              {quizMode !== 'preview' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveConfirm(true)}
                  className="hidden sm:flex items-center gap-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 border-gray-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Save & Exit</span>
                </Button>
              )}
            </div>
          </div>
          {/* Sticky Progress Bar in Header */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${attemptedPercent}%` }} />
          </div>
        </div>
      </header>

      {/* Main content with sidebar */}
      <div className="flex max-w-7xl w-full mx-auto px-0 sm:px-4 gap-6">
        {/* Sticky Question Navigator Sidebar - Hidden on mobile */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3">
              <h3 className="font-bold text-sm">Question Navigator</h3>
              <p className="text-xs opacity-80 mt-0.5">
                {Object.keys(answers).length}/{flattenedQuestions.length} answered
              </p>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-5 gap-2">
                {flattenedQuestions.map((q, idx) => {
                  const isAnswered = !!answers[q.id];
                  const isFlagged = !!flags[q.id];
                  const isCurrent = idx >= startIdx && idx < endIdx;

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        const targetPage = Math.floor(idx / (quiz?.questionsPerPage || 1));
                        setCurrentPage(targetPage);
                        // Scroll to question after page change
                        setTimeout(() => {
                          const el = document.getElementById(`question-${q.id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      className={`
                        w-8 h-8 rounded-lg text-xs font-bold transition-all
                        ${isCurrent ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                        ${isAnswered
                          ? 'bg-green-500 text-white hover:bg-green-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}
                        ${isFlagged ? 'ring-2 ring-yellow-400' : ''}
                      `}
                      title={`Q${idx + 1}${isAnswered ? ' (Answered)' : ''}${isFlagged ? ' (Flagged)' : ''}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Legend */}
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-green-500 rounded"></span>
                <span className="text-gray-600 dark:text-gray-400">Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded ring-2 ring-yellow-400"></span>
                <span className="text-gray-600 dark:text-gray-400">Flagged</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-gray-100 dark:bg-gray-700 rounded ring-2 ring-blue-500"></span>
                <span className="text-gray-600 dark:text-gray-400">Current</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Quiz Content */}
        <main className="flex-1 min-w-0 transition-all duration-500">
          {/* Preview Mode Banner */}
          {quizMode === 'preview' && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 px-6 py-4 rounded-xl shadow-md mb-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-yellow-100 rounded-full">
                    <Info className="w-5 h-5 text-yellow-700" />
                  </div>
                  <div>
                    <p className="font-bold text-yellow-900 text-lg">Preview Mode Active</p>
                    <p className="text-sm text-yellow-800 mt-1">
                      You are viewing this quiz as {userRole === 'admin' ? 'an administrator' : 'a teacher'}.
                      Your responses will not be recorded.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 px-3 py-1">
                    {userRole.toUpperCase()}
                  </Badge>
                  {/* Answer Toggle for Preview Mode */}
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-yellow-200">
                    <span className="text-sm font-medium text-gray-700">Show Answers</span>
                    <div
                      onClick={() => setShowAnswers(!showAnswers)}
                      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${showAnswers ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showAnswers ? 'left-5' : 'left-0.5'
                          }`}
                      ></div>
                    </div>
                  </div>
                  {/* Export Button for Preview Mode */}
                  <Button
                    variant="outline"
                    onClick={() => setShowDownloadModal(true)}
                    className="bg-white hover:bg-yellow-50 border-yellow-300 text-yellow-800"
                  >
                    <Download className="h-4 w-4 mr-2" /> Export PDF
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Old Admin Controls - Only show if NOT in preview mode (legacy support) */}
          {isAdmin && quizMode !== 'preview' && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-6 py-4 rounded-xl shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-full"><Info className="w-5 h-5 text-yellow-700" /></div>
                <div>
                  <p className="font-semibold text-lg">Admin Controls Enabled</p>
                  <p className="text-sm opacity-80">Timer disabled. Attempt limits ignored.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-yellow-200">
                  <span className="text-sm font-medium">View Answers</span>
                  <div
                    onClick={() => setShowAnswers(!showAnswers)}
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${showAnswers ? 'bg-green-500' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${showAnswers ? 'left-5' : 'left-0.5'}`}></div>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setShowDownloadModal(true)} className="bg-white hover:bg-yellow-50 border-yellow-300 text-yellow-800">
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </div>
            </div>
          )}

          <Card className="shadow-none sm:shadow-md w-full border-none rounded-none sm:rounded-xl transition-all duration-500 bg-white dark:bg-gray-900">
            <CardHeader>
              <div className="flex flex-col w-full">
                <CardTitle className="text-lg font-semibold flex justify-between items-center text-gray-900 dark:text-gray-100">
                  <span>Questions {startIdx + 1}–{Math.min(endIdx, flattenedQuestions.length)} / {flattenedQuestions.length}</span>
                  <div className="flex gap-2 items-center">
                    {isAdmin && showAnswers && <span className="text-xs font-normal text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded border border-green-100 dark:border-green-900/50">Answer Key Visible</span>}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNavGrid(true)}
                      className="gap-2 h-8"
                    >
                      <Grip className="h-4 w-4" />
                      <span className="hidden sm:inline">Overview</span>
                    </Button>
                  </div>
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-10 p-3 sm:p-6 pt-0 sm:pt-0">
              {Object.entries(pageGroupedQuestions).map(([subject, questions]) => (
                <div key={subject} className="space-y-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 border-b dark:border-gray-800 pb-2">{subject}</h2>
                  {questions.map((q, idx) => (
                    <QuestionCard
                      key={q.id}
                      question={q}
                      index={idx}
                      totalIndex={startIdx + idx}
                      answer={answers[q.id]}
                      isFlagged={!!flags[q.id]}
                      isAdmin={isAdmin}
                      showAnswers={showAnswers}
                      onAnswer={handleAnswer}
                      onToggleFlag={toggleFlag}
                      totalAnswered={Object.keys(answers).length}
                    />
                  ))}
                </div>
              ))}

              <div className="flex justify-between pt-8 border-t dark:border-gray-800">
                <Button
                  variant="outline"
                  onClick={currentPage === 0 ? undefined : handlePrevPage}
                  disabled={currentPage === 0 || isSubmitting}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                {/* FIX: Disable button and show loading state during submission */}
                <Button
                  onClick={isLastPage ? () => handleSubmit() : handleNextPage}
                  className={isLastPage ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}
                  disabled={isSubmitting}
                >
                  {isSubmitting && isLastPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLastPage ? 'Submit Quiz' : 'Next'} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Floating scroll buttons */}
      <div className="fixed right-4 bottom-6 z-50 flex flex-col items-center gap-3">
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            title="Scroll to top"
            aria-label="Scroll to top"
            className="bg-white shadow-lg rounded-full p-2 hover:bg-gray-100 transition flex items-center justify-center"
          >
            <ArrowUp className="h-5 w-5 text-gray-700" />
          </button>
        )}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
            className="bg-white shadow-lg rounded-full p-2 hover:bg-gray-100 transition flex items-center justify-center"
          >
            <ArrowDown className="h-5 w-5 text-gray-700" />
          </button>
        )}
      </div>

      {/* Navigation Grid Modal */}
      <Dialog open={showNavGrid} onOpenChange={setShowNavGrid}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto w-[90vw]">
          <DialogHeader>
            <DialogTitle>Question Navigator</DialogTitle>
            <DialogDescription>
              Jump to any question. Legend:
              <span className="inline-block w-3 h-3 bg-green-500 rounded-full mx-1"></span>Answered
              <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full mx-1"></span>Flagged
              <span className="inline-block w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded-full mx-1"></span>Unseen
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mt-4">
            {flattenedQuestions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isFlagged = flags[q.id];
              const questionsPerPage = quiz?.questionsPerPage || 1;
              const isCurrent = idx >= currentPage * questionsPerPage && idx < (currentPage + 1) * questionsPerPage;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    const newPage = Math.floor(idx / questionsPerPage);
                    if (quiz) updateTimeSpent();
                    setCurrentPage(newPage);
                    setShowNavGrid(false);
                  }}
                  className={`
                    h-10 w-10 text-xs font-bold rounded-lg border flex items-center justify-center transition-all relative
                    ${isCurrent ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                    ${isFlagged ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                      isAnswered ? 'bg-green-100 text-green-700 border-green-300' :
                        'bg-gray-50 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100'}
                  `}
                >
                  {idx + 1}
                  {isFlagged && <Flag className="w-3 h-3 absolute -top-1 -right-1 fill-yellow-500 text-yellow-500" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StartQuizPage = () => {
  return (
    <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <StartQuizPageContent />
    </React.Suspense>
  );
};

export default StartQuizPage;
