'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Download, Send, BookOpen, Info } from 'lucide-react';
import jsPDF from 'jspdf';

// --- UI Helper ---
const stripHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// --- Types ---
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

// --- Main ---
const StartQuizPage: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quizId = searchParams.get('id')!;
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Auth & Admin ---
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

  // --- Quiz Loading & Resume ---
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

      // Check attempts
      const attemptsSnapshot = await getDocs(collection(db, 'users', user.uid, 'quizAttempts'));
      let currentAttemptCount = 0;
      attemptsSnapshot.docs.forEach((doc) => {
        if (doc.id === quizId && doc.data()?.completed) {
          currentAttemptCount = doc.data().attemptNumber || 1;
        }
      });
      if (currentAttemptCount >= quizData.maxAttempts && !isAdmin) {
        alert('You have reached the maximum number of attempts for this quiz.');
        router.push('/quiz-bank');
        return;
      }
      setAttemptCount(currentAttemptCount);

      // Resume or start
      const resumeSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));
      if (resumeSnap.exists() && !resumeSnap.data().completed && resumeSnap.data().attemptNumber === undefined) {
        // Resume
        const rt = resumeSnap.data();
        setAnswers(rt.answers || {});
        setCurrentPage(Math.floor((rt.currentIndex || 0) / quizData.questionsPerPage));
        setTimeLeft(!isAdmin && rt.remainingTime !== undefined ? rt.remainingTime : quizData.duration * 60);
      } else {
        // New
        setTimeLeft(quizData.duration * 60);
        setAnswers({});
        setCurrentPage(0);
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
    load();
  }, [quizId, user, isAdmin]);

  // --- Timer ---
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

  // --- Auto Sync ---
  useEffect(() => {
    const handleUnload = () => {
      if (user && quiz && !isAdmin && !hasSubmittedRef.current) {
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
          answers,
          currentIndex: currentPage * (quiz.questionsPerPage || 1),
          remainingTime: timeLeft,
        }, { merge: true });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [answers, currentPage, timeLeft, quiz, user, isAdmin]);

  // --- Answer ---
  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    if (user && quiz && !isAdmin) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
        answers: updatedAnswers,
        currentIndex: currentPage * (quiz.questionsPerPage || 1),
        remainingTime: timeLeft,
      }, { merge: true });
    }
  };

  // --- Submit ---
  const handleSubmit = async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    if (!user || !quiz) return;
    const total = quiz.selectedQuestions.length;
    let score = 0;
    for (const question of quiz.selectedQuestions) {
      if (answers[question.id] === question.correctAnswer) score += 1;
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
      attemptNumber: newAttemptCount,
    };
    await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
      submittedAt: serverTimestamp(),
      answers,
      completed: true,
      remainingTime: 0,
      attemptNumber: newAttemptCount,
    }, { merge: true });
    await setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId, 'results', quizId), resultData);
    setShowSubmissionModal(true);
    setTimeout(() => {
      setShowSubmissionModal(false);
      if (isAdmin || quiz.resultVisibility === 'immediate') {
        router.push('/quiz/results?id=' + quizId);
      } else {
        router.push('/dashboard/student');
      }
    }, 3000);
  };

  // --- Time Format ---
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // --- PDF ---
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
      if (!acc[subjectName]) acc[subjectName] = [];
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

  // --- Loading ---
  if (loading || !quiz) return <p className="text-center py-10">Loading...</p>;

  // --- Data ---
  const questionsPerPage = quiz.questionsPerPage || 1;
  const groupedQuestions = quiz.selectedQuestions.reduce((acc, question) => {
    const subjectName = typeof question.subject === 'object' ? question.subject?.name : question.subject || 'Uncategorized';
    if (!acc[subjectName]) acc[subjectName] = [];
    acc[subjectName].push(question);
    return acc;
  }, {} as Record<string, Question[]>);
  const flattenedQuestions = Object.entries(groupedQuestions)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([_, questions]) => questions);
  const startIdx = currentPage * questionsPerPage;
  const endIdx = startIdx + questionsPerPage;
  const qSlice = flattenedQuestions.slice(startIdx, endIdx);
  const totalPages = Math.ceil(flattenedQuestions.length / questionsPerPage);
  const isLastPage = currentPage >= totalPages - 1;

  // --- Modern Card UI ---
  return (
    <div className="min-h-screen bg-gray-50 px-2 sm:px-4 font-sans">
      {/* --- Modals --- */}
      {showTimeoutModal && (
        <Dialog open={showTimeoutModal} onOpenChange={setShowTimeoutModal}>
          <DialogContent className="max-w-md sm:max-w-lg rounded-xl shadow-2xl">
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
          <DialogContent className="max-w-md sm:max-w-lg bg-white rounded-xl shadow-2xl animate-fade-in">
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
          <DialogContent className="max-w-md sm:max-w-lg rounded-xl shadow-2xl">
            <DialogHeader>
              <DialogTitle>Download Quiz as PDF</DialogTitle>
              <DialogDescription>Choose an option for downloading the quiz:</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  generatePDF(false);
                  setShowDownloadModal(false);
                }}
                className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 shadow flex items-center justify-center"
              >
                <Download className="mr-2 h-5 w-5" />
                Download Questions Only
              </button>
              <button
                onClick={() => {
                  generatePDF(true);
                  setShowDownloadModal(false);
                }}
                className="bg-green-600 text-white hover:bg-green-700 rounded-lg px-4 py-2 shadow flex items-center justify-center"
              >
                <Download className="mr-2 h-5 w-5" />
                Download with Answers
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* --- Header --- */}
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
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-600" />
              <span className="font-mono font-semibold text-red-600">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </header>
      {/* --- Main --- */}
      <main className="max-w-xl w-full mx-auto py-8">
        {isAdmin && (
          <div className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded-md text-sm mb-4">
            <p>🛠 Admin Mode: Timer is disabled.</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setShowDownloadModal(true)}
                className="flex items-center gap-2 border border-yellow-400 rounded-lg px-3 py-1 hover:bg-yellow-200"
              >
                <Download className="h-5 w-5" />
                Download PDF
              </button>
            </div>
          </div>
        )}
        {/* --- Quiz Card --- */}
        <div className="rounded-2xl shadow-xl bg-white p-6 mb-6 flex flex-col gap-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white font-semibold w-8 h-8 mr-2">
                {startIdx + 1}
              </span>
              <span className="font-bold text-lg text-gray-900">
                {stripHtml(qSlice[0]?.questionText || '')}
              </span>
            </div>
            <span className="text-gray-500 text-sm font-medium">
              {`Question ${startIdx + 1} of ${flattenedQuestions.length}`}
            </span>
          </div>
          {/* --- Options --- */}
          <div className="flex flex-col gap-4 mt-4">
            {qSlice[0]?.options.map((opt, i) => {
              const selected = answers[qSlice[0].id] === opt;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswer(qSlice[0].id, opt)}
                  className={`transition flex items-center justify-between px-4 py-3 rounded-xl shadow 
                    border text-left font-medium text-base
                    ${selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-black border-gray-200 hover:bg-gray-100'}
                  `}
                  style={{
                    boxShadow: selected
                      ? '0 2px 8px -2px #2563EB33'
                      : '0 2px 8px -2px #CBD5E133',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
                    <span dangerouslySetInnerHTML={{ __html: opt }} />
                  </span>
                  {selected && (
                    <span className="flex items-center ml-2">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {/* --- Explanation --- */}
          {quiz.resultVisibility === 'immediate' &&
            qSlice[0]?.showExplanation &&
            answers[qSlice[0].id] && (
              <div className="bg-blue-50 border border-blue-200 p-3 text-blue-800 rounded-md flex items-start gap-2 mt-4">
                <Info className="h-5 w-5 mt-1" />
                <p>{qSlice[0].explanation}</p>
              </div>
            )}
          {/* --- Progress & Navigation --- */}
          <div className="flex items-center justify-between pt-6">
            <button
              type="button"
              onClick={() => setCurrentPage((i) => Math.max(0, i - 1))}
              disabled={currentPage === 0 || showTimeoutModal || showSubmissionModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-100 transition"
            >
              <ArrowLeft className="mr-1" /> Previous
            </button>
            <button
              type="button"
              onClick={isLastPage ? handleSubmit : () => setCurrentPage((i) => i + 1)}
              disabled={showTimeoutModal || showSubmissionModal}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                isLastPage
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
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
            </button>
          </div>
          <div className="mt-6">
            <Progress
              value={((startIdx + 1) / flattenedQuestions.length) * 100}
              className="h-2 rounded-lg bg-gray-100"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default StartQuizPage;
