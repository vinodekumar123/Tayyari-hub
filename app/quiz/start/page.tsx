'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../firebase';
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
import { ArrowLeft, ArrowRight, Info, BookOpen, Clock, Send, Download, CheckCircle, Flag } from 'lucide-react';
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
        setCurrentPage(Math.floor(questionIndex / quizData.questionsPerPage));
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

  const generatePDF = (includeAnswers: boolean) => {
    if (!quiz) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(0, 51, 102);
    doc.text(quiz.title, pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Date: August 04, 2025`, pageWidth / 2, y, { align: 'center' });
    y += 20;

    const groupedQuestions = quiz.selectedQuestions.reduce((acc, question) => {
      const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
      if (!acc[subjectName]) {
        acc[subjectName] = [];
      }
      acc[subjectName].push(question);
      return acc;
    }, {} as Record<string, Question[]>);

    Object.entries(groupedQuestions).sort(([a], [b]) => a.localeCompare(b)).forEach(([subject, questions], subjectIndex) => {
      if (y > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        y = margin;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(0, 51, 102);
      doc.text(subject, margin, y);
      y += 10;

      questions.forEach((q, qIndex) => {
        if (y > doc.internal.pageSize.getHeight() - 50) {
          doc.addPage();
          y = margin;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(0);
        const questionText = `Q${subjectIndex * questions.length + qIndex + 1}. ${stripHtml(q.questionText)}`;
        const questionLines = doc.splitTextToSize(questionText, maxWidth);
        doc.text(questionLines, margin, y);
        y += questionLines.length * 7 + 5;

        q.options.forEach((opt, i) => {
          const optionText = `${String.fromCharCode(65 + i)}. ${stripHtml(opt)}`;
          const optionLines = doc.splitTextToSize(optionText, maxWidth - 10);
          doc.text(optionLines, margin + 10, y);
          y += optionLines.length * 7 + 3;
        });

        if (includeAnswers && q.correctAnswer) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 128, 0);
          const answerText = `Correct Answer: ${stripHtml(q.correctAnswer)}`;
          const answerLines = doc.splitTextToSize(answerText, maxWidth);
          doc.text(answerLines, margin, y);
          y += answerLines.length * 7 + 5;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0);
        }
      });

      y += 10;
    });

    const fileName = `${quiz.title}${includeAnswers ? '_with_answers' : ''}.pdf`;
    doc.save(fileName);
  };

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
              <DialogTitle>Download Quiz as PDF</DialogTitle>
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
                Download Questions Only
              </Button>
              <Button
                onClick={() => {
                  generatePDF(true);
                  setShowDownloadModal(false);
                }}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Download className="mr-2 h-5 w-5" />
                Download with Answers
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showSummaryModal && (
        <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
          <DialogContent className="w-[90vw] max-w-md sm:max-w-lg">
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-red-600" />
                <span className="font-mono font-semibold text-red-600">{formatTime(timeLeft)}</span>
              </div>
              <div className="w-48">
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
                Download PDF
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
                  <div key={q.id} className="space-y-4 relative">
                    <div className="absolute right-0 top-0 flex items-center gap-2">
                      <button
                        onClick={() => toggleFlag(q.id)}
                        className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition ${
                          flags[q.id] ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                        }`}
                        title={flags[q.id] ? 'Unflag question' : 'Flag question'}
                      >
                        <Flag className={`h-4 w-4 ${flags[q.id] ? 'text-yellow-600' : 'text-gray-400'}`} />
                        {flags[q.id] ? 'Flagged' : 'Flag'}
                      </button>
                    </div>

                    <div className="text-lg font-medium prose max-w-none">
                      <span className="font-semibold">Q{startIdx + idx + 1}. </span>
                      <span
                        dangerouslySetInnerHTML={{ __html: q.questionText }}
                      />
                    </div>

                    <div className="grid gap-3">
                      {q.options.map((opt, i) => (
                        <label
                          key={i}
                          htmlFor={`opt-${q.id}-${i}`}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition hover:bg-gray-100 ${
                            answers[q.id] === opt ? 'border-blue-500 bg-blue-50' : ''
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
    </div>
  );
};

export default StartQuizPage;
