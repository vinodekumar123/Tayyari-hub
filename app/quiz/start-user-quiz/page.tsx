'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db, auth } from 'app/firebase';
import {
  doc, getDoc, setDoc, serverTimestamp, updateDoc, arrayUnion,
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
  questionsPerPage?: number; // <-- Add this optional field
}

// Utility functions omitted for brevity (keep your cleanObject, stripHtml, etc.)

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

  // --- New state to block reattempts ---
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  // --- New state for dynamic questionsPerPage ---
  const [questionsPerPage, setQuestionsPerPage] = useState(1);

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

        // --- Get questionsPerPage from quiz doc or default to 1 ---
        setQuestionsPerPage(quizData.questionsPerPage || 1);

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

        const attemptDocRef = doc(db, 'users', user.uid, 'user-quizattempts', quizId);
        const attemptSnap = await getDoc(attemptDocRef);
        let currentAttempt = 0;
        if (attemptSnap.exists() && attemptSnap.data().completed) {
          // --- Block reattempt if completed ---
          setAlreadyCompleted(true);
          setLoading(false);
          return;
        }
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

  // ...rest of your useEffects and handlers (unchanged)...

  // Update navigation logic to use dynamic questionsPerPage:
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const isLastPage = currentPage >= totalPages - 1;
  const startIdx = currentPage * questionsPerPage;
  const endIdx = Math.min(startIdx + questionsPerPage, questions.length);
  const qSlice = questions.slice(startIdx, endIdx);

  // ...rest of your logic...

  // --- Block UI if user has already completed this quiz ---
  if (alreadyCompleted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Card className="max-w-md w-full shadow-lg p-8">
          <CardHeader>
            <CardTitle className="text-red-600">Quiz Already Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">
              You have already completed this quiz. Reattempt is not allowed.
            </p>
            <Button onClick={() => router.push('/admin/students/user-responses?id=' + quizId)}>
              View Your Results
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) return <div className="text-red-600 text-center py-10">{error}</div>;
  if (loading || !quiz || questions.length === 0) return <p className="text-center py-10">Loading...</p>;

  // ...rest of your JSX (unchanged), except remove the local questionsPerPage variable and use the state variable...

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      {/* ...rest of your modals and UI */}
      <main className="max-w-3xl w-full mx-auto p-4">
        <Card className="shadow-md w-full">
          <CardHeader>
            <div className="flex flex-col w-full">
              <CardTitle className="text-lg font-semibold">
                Questions {startIdx + 1}–{endIdx} / {questions.length}
              </CardTitle>
              {/* ...rest of your progress UI */}
            </div>
          </CardHeader>
          <CardContent className="space-y-10">
            {qSlice.map((q, idx) => (
              // ...your question rendering logic
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
