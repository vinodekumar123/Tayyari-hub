'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from 'app/firebase';
import {
  doc, getDoc, setDoc, serverTimestamp, getDocs, collection, updateDoc, arrayUnion, query, where,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, ArrowRight, BookOpen, Clock, Send, CheckCircle, Flag } from 'lucide-react';

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
}

const stripHtml = (html: string): string => {
  if (typeof window === 'undefined') return html;
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// Utility to replace all undefined with null recursively
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

const StartUserQuizPage: React.FC = () => {
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
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasLoadedTime, setHasLoadedTime] = useState(false);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [attemptCount, setAttemptCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!quizId || !user) return;
    const load = async () => {
      try {
        const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
        if (!quizSnap.exists()) {
          setError('Quiz not found.');
          router.push('/admin/quizzes/user-created-quizzes');
          return;
        }
        const quizData = quizSnap.data() as UserQuizDoc;
        setQuiz(quizData);

        const selectedQuestions = quizData.selectedQuestions || [];
        let loadedQuestions: Question[] = [];

        loadedQuestions = selectedQuestions.map((q: any) => ({
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

        const attemptDocRef = doc(db, 'users', user.uid, 'quizAttempts', quizId);
        const attemptSnap = await getDoc(attemptDocRef);
        let currentAttempt = 0;
        if (attemptSnap.exists() && attemptSnap.data().completed) {
          currentAttempt = attemptSnap.data().attemptNumber || 1;
        }
        setAttemptCount(currentAttempt);

        if (attemptSnap.exists() && !attemptSnap.data().completed) {
          const at = attemptSnap.data();
          setAnswers(at.answers || {});
          setFlags(at.flags || {});
          setCurrentPage(at.currentIndex ? Math.floor(at.currentIndex / 1) : 0);
          setTimeLeft(at.remainingTime ?? quizData.duration * 60);
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
        setHasLoadedTime(true);
        setLoading(false);
      } catch (err: any) {
        setError('Error loading quiz: ' + (err?.message || String(err)));
        setLoading(false);
      }
    };
    load();
  }, [quizId, user, router]);

  useEffect(() => {
    if (loading || !quiz || showSubmissionModal || !hasLoadedTime) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [loading, quiz, showSubmissionModal, hasLoadedTime]);

  useEffect(() => {
    if (!user || !quiz) return;
    const timeout = setTimeout(() => {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
        answers,
        flags,
        currentIndex: currentPage,
        remainingTime: timeLeft,
      }, { merge: true });
    }, 800);
    return () => clearTimeout(timeout);
  }, [answers, flags, currentPage, timeLeft, quiz, user, quizId]);

  useEffect(() => {
    const handleUnload = () => {
      if (user && quiz && !hasSubmittedRef.current) {
        setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
          answers,
          flags,
          currentIndex: currentPage,
          remainingTime: timeLeft,
        }, { merge: true });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [answers, flags, currentPage, timeLeft, quiz, user, quizId]);

  const handleAnswer = (qid: string, val: string) => {
    const updatedAnswers = { ...answers, [qid]: val };
    setAnswers(updatedAnswers);
    if (user && quiz) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
        answers: updatedAnswers,
        flags,
        currentIndex: currentPage,
        remainingTime: timeLeft,
      }, { merge: true });
    }
  };
  const toggleFlag = (qid: string) => {
    const updatedFlags = { ...flags, [qid]: !flags[qid] };
    if (!updatedFlags[qid]) delete updatedFlags[qid];
    setFlags(updatedFlags);
    if (user && quiz) {
      setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), {
        answers,
        flags: updatedFlags,
        currentIndex: currentPage,
        remainingTime: timeLeft,
      }, { merge: true });
    }
  };

  const handleSubmit = async () => {
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    if (!user || !quiz) {
      setError('User or quiz not loaded. Please wait and try again.');
      hasSubmittedRef.current = false;
      return;
    }

    try {
      let score = 0;
      const detailed: Array<{
        questionId: string;
        questionText: string;
        selected: string | null;
        correct: string | null;
        isCorrect: boolean;
        explanation?: string | null;
        options: string[];
        chapter?: string | null;
        subject?: string | null;
        difficulty?: string | null;
      }> = [];
      for (const q of questions) {
        const selected = answers[q.id] === undefined ? null : answers[q.id];
        const correct = q.correctAnswer === undefined ? null : q.correctAnswer;
        const isCorrect = (selected && correct && selected === correct) ?? false;
        detailed.push({
          questionId: q.id,
          questionText: stripHtml(q.questionText),
          selected,
          correct,
          isCorrect,
          explanation: q.explanation === undefined ? null : q.explanation,
          options: q.options,
          chapter: q.chapter === undefined ? null : q.chapter,
          subject: q.subject === undefined ? null : q.subject,
          difficulty: q.difficulty === undefined ? null : q.difficulty,
        });
        if (isCorrect) score += 1;
      }

      const cleanedDetailed = cleanObject(detailed);

      const attemptPath = doc(db, 'users', user.uid, 'quizAttempts', quizId);
      await setDoc(attemptPath, {
        submittedAt: serverTimestamp(),
        answers: cleanObject(answers),
        flags: cleanObject(flags),
        completed: true,
        remainingTime: 0,
        attemptNumber: attemptCount + 1,
        quizType: 'user',
        detailed: cleanedDetailed,
        score,
        total: questions.length,
      }, { merge: true });

      await updateDoc(doc(db, "users", user.uid), {
        usedMockQuestionIds: arrayUnion(...questions.map(q => q.id)),
      });

      setShowSubmissionModal(true);
      setShowSummaryModal(false);
      setTimeout(() => {
        setShowSubmissionModal(false);
        router.push(`/user-quizzes/${quizId}/result`);
      }, 2500);
    } catch (err: any) {
      setError('Submission failed: ' + (err?.message || String(err)));
      setShowSubmissionModal(false);
      hasSubmittedRef.current = false;
      console.error('Quiz submission error:', err);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (error) return <div className="text-red-600 text-center py-10">{error}</div>;
  if (loading || !quiz || questions.length === 0) return <p className="text-center py-10">Loading...</p>;

  const questionsPerPage = 1;
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

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      {showSubmissionModal && (
        <Dialog open={showSubmissionModal}>
          <DialogContent className="w-[90vw] max-w-md sm:max-w-lg bg-white rounded-xl shadow-2xl animate-fade-in">
            <DialogHeader className="text-center">
              <DialogTitle className="flex flex-col items-center gap-2">
                <CheckCircle className="h-12 w-12 text-green-600 animate-bounce" />
                <span className="text-2xl font-bold text-gray-900">Quiz Submitted!</span>
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-lg">
                Your quiz has been successfully submitted. Redirecting to results...
              </DialogDescription>
            </DialogHeader>
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
                <p className="font-semibold">Answered: {attemptedCount} / {questions.length}</p>
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
                <Button
                  onClick={() => handleSubmit()}
                  className="bg-red-600 text-white hover:bg-red-700"
                  disabled={loading || !user || !quiz || showSubmissionModal}
                >
                  Confirm Submit
                </Button>
              </div>
              {error &&
                <div className="text-red-600 text-center mt-2">{error}</div>
              }
            </div>
          </DialogContent>
        </Dialog>
      )}

      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold">{quiz.name}</h1>
              {quiz.subject && (
                <p className="text-sm text-gray-600">{quiz.subject}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-600" />
              <span className="font-mono font-semibold text-red-600">{formatTime(timeLeft)}</span>
            </div>
            <div className="w-full sm:w-48">
              <div className="text-xs text-gray-600">Progress: {attemptedCount}/{questions.length}</div>
              <Progress value={attemptedPercent} className="mt-1" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl w-full mx-auto p-4">
        <Card className="shadow-md w-full">
          <CardHeader>
            <div className="flex flex-col w-full">
              <CardTitle className="text-lg font-semibold">
                Questions {startIdx + 1}–{endIdx} / {questions.length}
              </CardTitle>
              <div className="mt-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">Attempted: {attemptedCount}/{questions.length}</div>
                  <div className="text-sm text-gray-600">Flagged: {flaggedCount}</div>
                </div>
                <div className="w-1/3">
                  <Progress value={attemptedPercent} className="mt-2" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-10">
            {qSlice.map((q, idx) => (
              <div key={q.id} className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div className="text-lg font-medium prose max-w-none">
                    <span className="font-semibold">Q{startIdx + idx + 1}. </span>
                    <span dangerouslySetInnerHTML={{ __html: q.questionText }} />
                  </div>
                  <div className="flex items-center">
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
                      <span className="prose max-w-none" dangerouslySetInnerHTML={{ __html: opt }} />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((i) => Math.max(0, i - 1))}
                disabled={currentPage === 0 || showSubmissionModal}
              >
                <ArrowLeft className="mr-2" /> Previous
              </Button>
              <Button
                onClick={isLastPage ? () => setShowSummaryModal(true) : () => setCurrentPage((i) => i + 1)}
                disabled={showSubmissionModal}
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

export default StartUserQuizPage;
