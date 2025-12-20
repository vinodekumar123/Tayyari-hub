'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, Info, BookOpen, Clock, Send, Download, CheckCircle, Flag, ArrowUp, ArrowDown } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

const StartQuizPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quizId = searchParams.get('id')!;
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // scroll button visibility states
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

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

      // Fetch completed attempts to check eligibility
      const attemptsSnapshot = await getDocs(collection(db, 'users', user.uid, 'quizAttempts'));
      let currentAttemptCount = 0;
      attemptsSnapshot.docs.forEach((docSnap) => {
        if (docSnap.id === quizId && docSnap.data()?.completed) {
          currentAttemptCount = docSnap.data().attemptNumber || 1;
        }
      });

      if (currentAttemptCount >= quizData.maxAttempts && !isAdmin) {
        alert('You have reached the maximum number of attempts for this quiz.');
        router.push('/quiz-bank');
        return;
      }

      setAttemptCount(currentAttemptCount);

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
  }, [quizId, user, isAdmin]);

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
  }, [answers, flags, currentPage, timeLeft, quiz, user, isAdmin]);

  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);

    if (user && quiz && !isAdmin) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
        answers: updatedAnswers,
        flags,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft,
      }, { merge: true });
    }
  };

  const toggleFlag = (qid: string) => {
    const updatedFlags = { ...flags, [qid]: !flags[qid] };
    // Remove false keys to keep data tidy
    if (!updatedFlags[qid]) {
      delete updatedFlags[qid];
    }
    setFlags(updatedFlags);

    if (user && quiz && !isAdmin) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
        answers,
        flags: updatedFlags,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft,
      }, { merge: true });
    }
  };

  const handleSubmit = async () => {
    // If this is triggered by user clicking final Submit, we show summary first.
    if (!hasSubmittedRef.current && !showSummaryModal) {
      // But if the call is due to timeout, we must bypass the summary.
      // We'll detect timeout by checking timeLeft === 0.
      if (timeLeft > 0) {
        setShowSummaryModal(true);
        return;
      }
    }

    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    if (!user || !quiz) return;

    const total = quiz.selectedQuestions.length;
    let score = 0;

    for (const question of quiz.selectedQuestions) {
      if (answers[question.id] === question.correctAnswer) {
        score += 1;
      }
    }

    const newAttemptCount = attemptCount + 1;
    const resultData = {
      quizId,
      title: quiz.title || 'Untitled Quiz',
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
      flags,
      attemptNumber: newAttemptCount,
    };

    await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
      submittedAt: serverTimestamp(),
      answers,
      flags,
      completed: true,
      remainingTime: 0,
      attemptNumber: newAttemptCount,
    }, { merge: true });

    await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId, 'results', quizId), resultData);

    setShowSubmissionModal(true);
    setShowSummaryModal(false);
    setTimeout(() => {
      setShowSubmissionModal(false);
      if (isAdmin || quiz.resultVisibility === 'immediate') {
        router.push('/quiz/results?id=' + quizId);
      } else {
        router.push('/dashboard/student');
      }
    }, 3000);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper: build the export HTML (used for Word and PDF canvas rendering)
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
          /* ensure pretty print when rendered to canvas */
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
        // questionText may contain HTML — we want the rendered HTML for PDF capture,
        // but when building a string we will include it as-is so the canvas render includes formatting.
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

    html += `
      </body>
      </html>
    `;
    return html;
  };

  // New PDF generation: render the HTML using html2canvas and then write image(s) into jsPDF.
  // This preserves web fonts and special symbols because we capture the rendered DOM.
  const generatePDF = async (includeAnswers: boolean) => {
    if (!quiz || typeof window === 'undefined') return;

    // Build HTML and insert hidden container in DOM for rendering
    const htmlString = buildExportHtmlString(includeAnswers);
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px'; // off-screen
    container.style.top = '0';
    container.style.width = '800px'; // set a width that matches a reasonable page width; higher gives better fidelity
    container.style.background = '#ffffff';
    container.innerHTML = htmlString;
    document.body.appendChild(container);

    try {
      // Use a higher scale for better resolution of text/symbols
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // Create PDF in mm A4
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Convert canvas px to PDF size in mm by matching widths
      // imgWidth in pdf units (mm)
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // First page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add extra pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight; // negative offset to show next slice
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const fileNameSafe = quiz.title.replace(/[\\/:"*?<>|]+/g, '');
      const fileName = `${fileNameSafe}${includeAnswers ? '_with_answers' : ''}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      // Fallback: if canvas rendering fails, fall back to previous text-based PDF (less accurate for symbols)
      console.error('PDF generation via html2canvas failed:', err);
      // Optionally implement a fallback here (not done to keep behavior explicit)
      alert('PDF export failed. Check console for details.');
    } finally {
      // Clean up DOM
      document.body.removeChild(container);
    }
  };

  // Word export - using HTML blob that Word can open (.doc)
  const generateWord = (includeAnswers: boolean) => {
    if (!quiz) return;

    const escapeHtml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Build HTML content
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

  // Scroll helpers
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

      // show top button if scrolled down > 300px
      setShowScrollTop(scrollY > 300);

      // show bottom button if not near bottom (100px threshold) and page is scrollable
      if (docHeight > innerH + 50) {
        setShowScrollBottom((innerH + scrollY) < (docHeight - 100));
      } else {
        setShowScrollBottom(false);
      }
    };

    // initialize
    updateScrollButtons();
    window.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      window.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [loading, quiz]);

  if (loading || !quiz) return <p className="text-center py-10">Loading...</p>;

  const questionsPerPage = quiz.questionsPerPage || 1;

  const groupedQuestions = quiz.selectedQuestions.reduce((acc, question) => {
    const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
    if (!acc[subjectName]) {
      acc[subjectName] = [];
    }
    acc[subjectName].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  const flattenedQuestions = Object.entries(groupedQuestions)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([_, questions]) => questions);

  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = flattenedQuestions.slice(startIdx, endIdx);

  const pageGroupedQuestions = qSlice.reduce((acc, question) => {
    const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
    if (!acc[subjectName]) {
      acc[subjectName] = [];
    }
    acc[subjectName].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  const totalPages = Math.ceil(flattenedQuestions.length / questionsPerPage);
  const isLastPage = currentPage >= totalPages - 1;

  const attemptedCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '').length;
  const flaggedCount = Object.keys(flags).filter((k) => flags[k]).length;
  const attemptedPercent = Math.round((attemptedCount / flattenedQuestions.length) * 100);

  const skippedQuestionIndexes = flattenedQuestions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !answers[q.id] || answers[q.id] === '')
    .map(({ idx }) => idx + 1); // human 1-based

  const flaggedQuestionIndexes = flattenedQuestions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => flags[q.id])
    .map(({ idx }) => idx + 1);

  const jumpToQuestion = (oneBasedIndex: number) => {
    const zeroIndex = oneBasedIndex - 1;
    const newPage = Math.floor(zeroIndex / questionsPerPage);
    setCurrentPage(newPage);
    setShowSummaryModal(false);
    // Optionally scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      {showTimeoutModal && (
        <Dialog open={showTimeoutModal} onOpenChange={setShowTimeoutModal}>
          <DialogContent className="w-[90vw] max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-red-600" />
                Time is Out!
              </DialogTitle>
              <DialogDescription>
                Time's up. Your answers have been submitted.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}

      {showSubmissionModal && (
        <Dialog open={showSubmissionModal}>
          <DialogContent className="w-[90vw] max-w-md sm:max-w-lg bg-white rounded-xl shadow-2xl animate-fade-in">
            <DialogHeader className="text-center">
              <DialogTitle className="flex flex-col items-center gap-2">
                <CheckCircle className="h-12 w-12 text-green-600 animate-bounce" />
                <span className="text-2xl font-bold text-gray-900">Quiz Submitted!</span>
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-lg">
                Your quiz has been successfully submitted. Redirecting to dashboard...
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}

      {showDownloadModal && (
        <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
          <DialogContent className="w-[90vw] max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Download Quiz</DialogTitle>
              <DialogDescription>Choose an option for downloading the quiz:</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                onClick={() => {
                  generatePDF(false);
                  setShowDownloadModal(false);
                }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Download className="mr-2 h-5 w-5" />
                Download PDF (Questions Only)
              </Button>
              <Button
                onClick={() => {
                  generatePDF(true);
                  setShowDownloadModal(false);
                }}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Download className="mr-2 h-5 w-5" />
                Download PDF (With Answers)
              </Button>

              <Button
                onClick={() => {
                  generateWord(false);
                  setShowDownloadModal(false);
                }}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Word (Questions Only)
              </Button>
              <Button
                onClick={() => {
                  generateWord(true);
                  setShowDownloadModal(false);
                }}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Word (With Answers)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showSummaryModal && (
        <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
          <DialogContent className="w-[90vw] max-w-md sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Summary before Submission</DialogTitle>
              <DialogDescription>Review skipped and flagged questions before final submission.</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="font-semibold">Answered: {attemptedCount} / {flattenedQuestions.length}</p>
                <p className="font-semibold">Flagged: {flaggedCount}</p>
              </div>

              <div>
                <h3 className="font-semibold">Skipped Questions ({skippedQuestionIndexes.length})</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skippedQuestionIndexes.length === 0 ? (
                    <span className="text-sm text-gray-600">None</span>
                  ) : (
                    skippedQuestionIndexes.map((n) => (
                      <Button key={n} variant="outline" onClick={() => jumpToQuestion(n)} className="text-sm">
                        {n}
                      </Button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold">Flagged Questions ({flaggedQuestionIndexes.length})</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {flaggedQuestionIndexes.length === 0 ? (
                    <span className="text-sm text-gray-600">None</span>
                  ) : (
                    flaggedQuestionIndexes.map((n) => (
                      <Button key={n} variant="ghost" onClick={() => jumpToQuestion(n)} className="text-sm">
                        <Flag className="mr-2 h-4 w-4 text-yellow-600" /> {n}
                      </Button>
                    ))
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowSummaryModal(false)}>Review</Button>
                <Button onClick={() => handleSubmit()} className="bg-red-600 text-white hover:bg-red-700">
                  Confirm Submit
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold">{quiz.title}</h1>
              {quiz.course && (
                <p className="text-sm text-gray-600">
                  {typeof quiz.course === 'object' ? quiz.course.name : quiz.course}
                </p>
              )}
            </div>
          </div>
          {!isAdmin && (
            // Responsive: stack into column on small screens so progress moves to a new line
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-600" />
                <span className="font-mono font-semibold text-red-600">{formatTime(timeLeft)}</span>
              </div>
              <div className="w-full sm:w-48">
                <div className="text-xs text-gray-600">Progress: {attemptedCount}/{flattenedQuestions.length}</div>
                <Progress value={attemptedPercent} className="mt-1" />
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto p-4">
        {isAdmin && (
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-sm mb-4">
            <p>🛠 Admin Mode: Timer is disabled.</p>
            <div className="mt-2 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDownloadModal(true)}
                className="flex items-center gap-2"
              >
                <Download className="h-5 w-5" />
                Download PDF / Word
              </Button>
            </div>
          </div>
        )}

        <Card className="shadow-md w-full">
          <CardHeader>
            <div className="flex flex-col w-full">
              <CardTitle className="text-lg font-semibold">
                Questions {startIdx + 1}–{Math.min(endIdx, flattenedQuestions.length)} / {flattenedQuestions.length}
              </CardTitle>
              <div className="mt-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">Attempted: {attemptedCount}/{flattenedQuestions.length}</div>
                  <div className="text-sm text-gray-600">Flagged: {flaggedCount}</div>
                </div>
                <div className="w-1/3">
                  <Progress
                    value={attemptedPercent}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-10">
            {Object.entries(pageGroupedQuestions).map(([subject, questions]) => (
              <div key={subject} className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 border-b-2 border-blue-500 pb-2">
                  {subject}
                </h2>
                {questions.map((q, idx) => (
                  <div key={q.id} className="space-y-4">
                    {/* Responsive header: on small screens the button moves below the question text (flex-col),
                        on sm+ screens it's shown to the right of the question (flex-row) */}
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                      <div className="text-lg font-medium prose max-w-none">
                        <span className="font-semibold">Q{startIdx + idx + 1}. </span>
                        <span
                          dangerouslySetInnerHTML={{ __html: q.questionText }}
                        />
                      </div>

                      <div className="flex items-center">
                        <button
                          onClick={() => toggleFlag(q.id)}
                          className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition ${flags[q.id] ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                          title={flags[q.id] ? 'Unflag question' : 'Flag question'}
                        >
                          <Flag className={`h-4 w-4 ${flags[q.id] ? 'text-yellow-600' : 'text-gray-400'}`} />
                          {flags[q.id] ? 'Flagged' : 'Flag'}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {q.options.map((opt, i) => (
                        <label
                          key={i}
                          htmlFor={`opt-${q.id}-${i}`}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition hover:bg-gray-100 ${answers[q.id] === opt ? 'border-blue-500 bg-blue-50' : ''
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
                          <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                          <span
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: opt }}
                          />
                        </label>
                      ))}
                    </div>
                    {quiz.resultVisibility === 'immediate' && q.showExplanation && answers[q.id] && (
                      <div className="bg-blue-50 border border-blue-200 p-3 text-blue-800 rounded-md flex items-start gap-2">
                        <Info className="h-5 w-5 mt-1" />
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((i) => Math.max(0, i - 1))}
                disabled={currentPage === 0 || showTimeoutModal || showSubmissionModal}
              >
                <ArrowLeft className="mr-2" /> Previous
              </Button>
              <Button
                onClick={isLastPage ? () => {
                  // Show summary first when user submits manually (unless admin or forced submit)
                  if (isAdmin || timeLeft === 0) {
                    handleSubmit();
                  } else {
                    setShowSummaryModal(true);
                  }
                } : () => setCurrentPage((i) => i + 1)}
                disabled={showTimeoutModal || showSubmissionModal}
                className={isLastPage ? 'bg-red-600 text-white hover:bg-red-700' : ''}
              >
                {isLastPage ? (
                  <>
                    <Send className="mr-2" /> Submit
                  </>
                ) : (
                  <>
                    Next <ArrowRight className="ml-2" />
                  </>
                )}
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
