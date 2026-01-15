'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ArrowLeft, ArrowRight, Info, BookOpen, Clock, Send, Download, CheckCircle, Flag, ArrowUp, ArrowDown, Edit, WifiOff, AlertTriangle, Save, LogOut, Loader2 } from 'lucide-react';
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

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  showExplanation?: boolean;
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
  const quizId = searchParams.get('id')!;
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loader state
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restoredRef = useRef(false);
  const handleSubmitRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  const [pageStartTime, setPageStartTime] = useState<number>(Date.now());
  const [timeLogs, setTimeLogs] = useState<Record<string, number>>({});

  // scroll button visibility states
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const [violationCount, setViolationCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

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

    // 3. Tab Visibility (Tab Switch Detection)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolationCount(prev => {
          const newCount = prev + 1;
          toast.warning(`Warning: Please stay on this tab! (${newCount}/3 violations)`, {
            icon: <AlertTriangle className="text-yellow-500" />,
            duration: 4000,
          });
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
  const timeoutPromise = (ms: number, promise: Promise<any>) => {
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

  // Save to backup on change
  useEffect(() => {
    if (!quizId || !user) return;
    const backupKey = `quiz_backup_${user.uid}_${quizId}`;
    localStorage.setItem(backupKey, JSON.stringify({ answers, flags }));
  }, [answers, flags, quizId, user]);


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

  useEffect(() => {
    if (!quizId || !user) return;

    const load = async () => {
      const qSnap = await getDoc(doc(db, 'quizzes', quizId));
      if (!qSnap.exists()) {
        router.push('/quiz-bank');
        return;
      }

      const data = qSnap.data();
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

      // Series Enrollment Check
      if (!isAdmin && data.series && Array.isArray(data.series) && data.series.length > 0) {
        try {
          const enrollmentsRef = collection(db, 'enrollments');
          const qEnrol = query(enrollmentsRef, where('studentId', '==', user.uid), where('status', '==', 'active'));
          const enrollmentsSnap = await getDocs(qEnrol);
          const enrolledSeriesIds = new Set(enrollmentsSnap.docs.map(doc => doc.data().seriesId));

          const hasAccess = data.series.some((sId: string) => enrolledSeriesIds.has(sId));

          if (!hasAccess) {
            toast.error('Access Denied: You are not enrolled in the required Series for this quiz.');
            router.push('/dashboard/student');
            return;
          }
        } catch (err) {
          console.error("Error checking enrollment:", err);
          toast.error("Failed to verify enrollment status.");
          return;
        }
      }

      // Fetch completed attempts to check eligibility
      // Admin Bypass: Admins can always attempt, skipping the check logic effectively or just alerting
      if (!isAdmin) {
        const attemptsSnapshot = await getDocs(collection(db, 'users', user.uid, 'quizAttempts'));
        let currentAttemptCount = 0;
        attemptsSnapshot.docs.forEach((docSnap) => {
          if (docSnap.id === quizId && docSnap.data()?.completed) {
            currentAttemptCount = docSnap.data().attemptNumber || 1;
          }
        });

        if (currentAttemptCount >= quizData.maxAttempts) {
          toast.error('Maximum attempts reached for this quiz.');
          router.push(isAdmin ? '/admin/quizzes/quizebank' : '/dashboard/student');
          return;
        }
        setAttemptCount(currentAttemptCount);
      } else {
        // for admin, just get attempt count for info but don't block
        setAttemptCount(0); // or fetch real count if desired, but 0 is fine for "unlimited" feel
      }

      // Check for an incomplete attempt
      const resumeSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));
      if (resumeSnap.exists() && !resumeSnap.data().completed && resumeSnap.data().attemptNumber === undefined) {
        // Resume incomplete attempt
        const rt = resumeSnap.data();
        setAnswers(rt.answers || {});
        setFlags(rt.flags || {});
        const questionIndex = rt.currentIndex || 0;
        setCurrentPage(Math.floor(questionIndex / (quizData.questionsPerPage || 1)));
        if (!isAdmin && rt.remainingTime !== undefined) {
          setTimeLeft(rt.remainingTime);
        } else {
          setTimeLeft(quizData.duration * 60);
        }
      } else {
        // New attempt: reset timer and initialize quizAttempts
        setTimeLeft(quizData.duration * 60);
        setAnswers({});
        setFlags({});
        setCurrentPage(0);
        await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
          startedAt: serverTimestamp(),
          answers: {},
          flags: {},
          currentIndex: 0,
          completed: false,
          remainingTime: quizData.duration * 60,
        }, { merge: true });
      }

      setHasLoadedTime(true);
      setLoading(false);
    };

    load();
  }, [quizId, user, isAdmin, router]);

  useEffect(() => {
    // Admin Bypass: Timer Logic Disabled
    if (isAdmin) return;

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
  }, [loading, quiz, showTimeoutModal, showSubmissionModal, hasLoadedTime, timeLeft, isAdmin]);

  useEffect(() => {
    const handleUnload = () => {
      if (user && quiz && !isAdmin && !hasSubmittedRef.current) {
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
  }, [answers, flags, currentPage, timeLeft, quiz, user, isAdmin, quizId]);

  // ... (keeping existing handlers unchanged, showing shortened for brevity where logic is same)
  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    if (user && quiz && !isAdmin) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), { answers: updatedAnswers, remainingTime: timeLeft }, { merge: true });
    }
  };

  const toggleFlag = (qid: string) => {
    const updatedFlags = { ...flags, [qid]: !flags[qid] };
    if (!updatedFlags[qid]) delete updatedFlags[qid];
    setFlags(updatedFlags);
    if (user && quiz && !isAdmin) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), { flags: updatedFlags }, { merge: true });
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
  const handleNextPage = () => { updateTimeSpent(); setCurrentPage(prev => prev + 1); };
  const handlePrevPage = () => { updateTimeSpent(); setCurrentPage(prev => Math.max(0, prev - 1)); };

  const handleSubmit = async (force: boolean = false) => {
    // If we are forcing (from modal), ignore isSubmitting initially to allow re-entry, 
    // BUT checking isSubmitting later is vital.
    if (!force && (isSubmitting || hasSubmittedRef.current)) return;

    // logic...
    setIsSubmitting(true);
    updateTimeSpent();

    if (!force && !hasSubmittedRef.current && !showSummaryModal) {
      if (timeLeft > 0 && !isAdmin) {
        setShowSummaryModal(true);
        setIsSubmitting(false); // Reset if just showing modal
        return;
      }
    }

    // Explicitly hide modal if we proceed
    setShowSummaryModal(false);

    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    if (!user || !quiz || isSubmitting) return;

    setIsSubmitting(true);
    updateTimeSpent();

    if (!user || !quiz) return;
    const total = quiz.selectedQuestions.length;
    let score = 0;
    for (const question of quiz.selectedQuestions) {
      if (question.graceMark || answers[question.id] === question.correctAnswer) {
        score += 1;
      }
    }
    const newAttemptCount = attemptCount + 1;
    // ... saving logic ...
    // ... saving logic ...
    try {
      if (!navigator.onLine) throw new Error("No Internet Connection");

      // Sanitize inputs to remove undefined values
      const cleanAnswers = JSON.parse(JSON.stringify(answers));
      const cleanFlags = JSON.parse(JSON.stringify(flags));

      const resultData = { quizId, title: quiz.title, score, total, timestamp: serverTimestamp(), answers: cleanAnswers, flags: cleanFlags, attemptNumber: newAttemptCount };

      // Parallelize critical saves with timeout
      await timeoutPromise(15000, Promise.all([
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId, 'results', quizId), resultData),
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), { submittedAt: serverTimestamp(), completed: true, remainingTime: 0, attemptNumber: newAttemptCount }, { merge: true })
      ]));

      // Stats update (Async - don't block main submission flow if possible, or include if critical)
      // We will safeguard this part too so it doesn't hang the UI
      try {
        const { updateStudentStats } = await import('@/app/lib/student-stats');
        const { recordQuestionPerformance } = await import('@/app/lib/analytics');
        await updateStudentStats(user.uid, {
          quizId, score, total, answers, selectedQuestions: quiz.selectedQuestions,
          subject: Array.isArray(quiz.subject) ? quiz.subject.map((s: any) => s.name || s) : (typeof quiz.subject === 'object' ? (quiz.subject as any)?.name : quiz.subject),
          timestamp: serverTimestamp() as any
        }, 'admin');

        const questionResults = quiz.selectedQuestions.map(q => ({
          questionId: q.id,
          isCorrect: q.graceMark || answers[q.id] === q.correctAnswer, // Auto-correct if grace
          chosenOption: answers[q.id] || 'unanswered',
          timeSpent: timeLogs[q.id] || 0,
          graceMark: q.graceMark || false
        }));
        await recordQuestionPerformance(user.uid, quizId, questionResults);
      } catch (statsErr) {
        console.warn("Non-critical stats update failed:", statsErr);
        // Don't fail submission for stats
      }

    } catch (error: any) {
      console.error("Submission failed", error);
      if (error.message === "No Internet Connection") {
        toast.error("No Internet Connection", { description: "Cannot submit quiz. Please check your connection." });
      } else if (error.message?.includes('timed out')) {
        toast.error("Submission Timed Out", { description: "Server is not responding. Please try again." });
      } else {
        toast.error("Submission failed. Please try again.");
      }
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
      return;
    }

    setShowSubmissionModal(true);
    setShowSummaryModal(false);
    setTimeout(() => {
      setShowSubmissionModal(false);
      // Admin always goes to results
      router.push('/quiz/results?id=' + quizId);
      // Don't reset isSubmitting here, wait for redirect
    }, 2000);
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

  const formatTime = (sec: number) => {
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
      const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
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

  if (loading || !quiz) return <p className="text-center py-10">Loading...</p>;

  // (Group questions logic same)
  const questionsPerPage = quiz.questionsPerPage || 1;
  const groupedQuestions = quiz.selectedQuestions.reduce((acc, question) => {
    const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
    if (!acc[subjectName]) acc[subjectName] = [];
    acc[subjectName].push(question);
    return acc;
  }, {} as Record<string, Question[]>);
  const flattenedQuestions = Object.entries(groupedQuestions).sort(([a], [b]) => a.localeCompare(b)).flatMap(([_, questions]) => questions);
  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = flattenedQuestions.slice(startIdx, endIdx);
  const pageGroupedQuestions = qSlice.reduce((acc, question) => {
    const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
    if (!acc[subjectName]) acc[subjectName] = [];
    acc[subjectName].push(question);
    return acc;
  }, {} as Record<string, Question[]>);
  const totalPages = Math.ceil(flattenedQuestions.length / questionsPerPage);
  const isLastPage = currentPage >= totalPages - 1;
  const attemptedCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
  const flaggedCount = Object.keys(flags).filter((k) => flags[k]).length;
  const attemptedPercent = Math.round((attemptedCount / flattenedQuestions.length) * 100);

  // Indexes helpers (same)
  const skippedQuestionIndexes = flattenedQuestions.map((q, idx) => ({ q, idx })).filter(({ q }) => !answers[q.id] || answers[q.id] === '').map(({ idx }) => idx + 1);
  const flaggedQuestionIndexes = flattenedQuestions.map((q, idx) => ({ q, idx })).filter(({ q }) => flags[q.id]).map(({ idx }) => idx + 1);
  const jumpToQuestion = (oneBasedIndex: number) => { setCurrentPage(Math.floor((oneBasedIndex - 1) / questionsPerPage)); setShowSummaryModal(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 transition-colors duration-300">
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

      {/* Header - Always visible, adapts for Zen Mode */}
      <header className={`bg-white dark:bg-gray-900 border-b dark:border-gray-800 sticky top-0 z-40 shadow-sm transition-all duration-300`}>
        {!isOnline && (
          <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top">
            <WifiOff className="w-4 h-4" /> You are offline. Don&apos;t worry, your answers are saved locally and will sync when you reconnect.
          </div>
        )}

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
              {!isAdmin && (
                <div className="flex items-center gap-2 font-mono text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-full border border-red-100 dark:border-red-900/30">
                  <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
                </div>
              )}
              <ModeToggle />
              {/* Save & Exit Button */}
              {!isAdmin && (
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

      <main className={`max-w-6xl w-full mx-auto p-4 transition-all duration-500`}>
        {isAdmin && (
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

        <Card className="shadow-md w-full border-none transition-all duration-500 bg-white dark:bg-gray-900">
          <CardHeader>
            <div className="flex flex-col w-full">
              <CardTitle className="text-lg font-semibold flex justify-between items-center text-gray-900 dark:text-gray-100">
                <span>Questions {startIdx + 1}–{Math.min(endIdx, flattenedQuestions.length)} / {flattenedQuestions.length}</span>
                <div className="flex gap-2">
                  {isAdmin && showAnswers && <span className="text-xs font-normal text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded border border-green-100 dark:border-green-900/50">Answer Key Visible</span>}
                </div>
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="space-y-10">
            {Object.entries(pageGroupedQuestions).map(([subject, questions]) => (
              <div key={subject} className="space-y-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 border-b dark:border-gray-800 pb-2">{subject}</h2>
                {questions.map((q, idx) => {
                  const isCorrectAnswerVisible = isAdmin && showAnswers;
                  return (
                    <div key={q.id} className={`space-y-4 p-4 rounded-lg transition-colors ${isCorrectAnswerVisible ? 'bg-slate-50 border border-slate-100' : ''}`}>
                      <div className="flex justify-between items-start gap-4">
                        <div className="text-lg font-medium prose max-w-none flex-1 group relative dark:prose-invert">
                          <span className="font-bold text-slate-700 dark:text-slate-300">Q{startIdx + idx + 1}. </span>
                          <span dangerouslySetInnerHTML={{ __html: q.questionText }} />

                          {/* Admin Quick Edit Link */}
                          {isAdmin && (
                            <a
                              href={`/admin/questions/create?edit=${q.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-600"
                              title="Edit Question"
                            >
                              <Edit className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        <button onClick={() => toggleFlag(q.id)} className={`p-2 rounded-full hover:bg-slate-100 ${flags[q.id] ? 'text-yellow-500' : 'text-slate-300'}`}>
                          <Flag className="w-5 h-5 fill-current" />
                        </button>
                      </div>

                      <div className="grid gap-3">
                        {q.options.map((opt, i) => {
                          const isSelected = answers[q.id] === opt;
                          const isCorrect = isCorrectAnswerVisible && opt === q.correctAnswer;

                          let borderClass = 'border-gray-200 dark:border-gray-700';
                          let bgClass = 'bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800';

                          if (isSelected) {
                            borderClass = 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400';
                            bgClass = 'bg-blue-50 dark:bg-blue-900/20';
                          }
                          if (isCorrect) {
                            borderClass = 'border-green-500 ring-2 ring-green-500 dark:border-green-400 dark:ring-green-400';
                            bgClass = 'bg-green-50 dark:bg-green-900/20';
                          }

                          return (
                            <label key={i} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${borderClass} ${bgClass} relative overflow-hidden group`}>
                              <div className="flex items-center h-5">
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt}
                                  checked={isSelected}
                                  onChange={() => {
                                    handleAnswer(q.id, opt);
                                    if (!isSelected) {
                                      // Motivational Toast every 5 answers
                                      const count = Object.keys(answers).length + 1;
                                      if (count > 0 && count % 5 === 0) {
                                        toast.success(`Great momentum! ${count} questions answered!`, {
                                          icon: '🔥',
                                          duration: 2000,
                                          position: 'bottom-center'
                                        });
                                      }
                                    }
                                  }}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                />
                              </div>
                              <div className="ml-3 text-sm font-medium w-full flex items-center gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-500 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                                  {['A', 'B', 'C', 'D'][i]}
                                </div>
                                <span className="prose max-w-none" dangerouslySetInnerHTML={{ __html: opt }} />
                              </div>
                              {isCorrect && (
                                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-green-500"></div>
                              )}
                            </label>
                          );
                        })}
                      </div>

                      {/* Show explanation immediately for admin answering mode */}
                      {isCorrectAnswerVisible && q.explanation && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg text-sm text-green-800 animate-in fade-in slide-in-from-top-2">
                          <p className="font-bold flex items-center gap-2 mb-1"><Info className="w-4 h-4" /> Explanation:</p>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="flex justify-between pt-8 border-t dark:border-gray-800">
              <Button variant="outline" onClick={currentPage === 0 ? undefined : handlePrevPage} disabled={currentPage === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <Button onClick={isLastPage ? () => handleSubmit() : handleNextPage} className={isLastPage ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}>
                {isLastPage ? 'Submit Quiz' : 'Next'} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>


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
