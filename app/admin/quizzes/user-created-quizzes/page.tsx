'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from 'app/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { BadgeCheck, PlayCircle, Clock, RefreshCw } from 'lucide-react';

export default function StartUserQuizPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id') as string;

  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        router.push('/login');
        return;
      }
      // Load quiz meta
      const quizSnap = await getDoc(doc(db, 'user-quizzes', quizId));
      if (!quizSnap.exists()) {
        setError('Quiz not found.');
        setLoading(false);
        return;
      }
      setQuiz(quizSnap.data());

      // Check for previous attempt for this user and quiz
      const attemptRef = doc(db, 'users', u.uid, 'user-quizattempts', quizId);
      const attemptSnap = await getDoc(attemptRef);
      if (attemptSnap.exists()) {
        setAttempt(attemptSnap.data());
      }
      setLoading(false);
    });
    return () => unsub();
  }, [quizId, router]);

  // Start quiz handler
  const handleStartQuiz = async () => {
    if (!user || !quizId) return;
    setError(null);

    try {
      const attemptRef = doc(db, 'users', user.uid, 'user-quizattempts', quizId);
      const attemptSnap = await getDoc(attemptRef);
      if (!attemptSnap.exists()) {
        // Create a new attempt with startedAt
        await setDoc(attemptRef, {
          startedAt: serverTimestamp(),
          attemptNumber: 1,
          answers: {},
          flags: {},
          completed: false,
          score: 0,
          total: quiz.selectedQuestions.length,
          detailed: [],
        });
        router.push(`/quiz/take?id=${quizId}`);
      } else {
        // Resume if not completed
        if (!attemptSnap.data().completed) {
          router.push(`/quiz/take?id=${quizId}`);
        }
      }
    } catch (err) {
      setError('Failed to start/resume quiz. Try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-white">
        <div className="text-xl font-bold text-indigo-700 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-white">
        <div className="text-xl font-bold text-red-700">{error}</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-white">
        <div className="text-xl font-bold text-gray-700">Quiz not found.</div>
      </div>
    );
  }

  // Determine quiz status
  let statusTag = (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      <Clock className="h-4 w-4" /> Not Started
    </span>
  );
  let startedAt = null;

  if (attempt) {
    if (attempt.completed) {
      statusTag = (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <BadgeCheck className="h-4 w-4" /> Attempted
        </span>
      );
    } else {
      statusTag = (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          <RefreshCw className="h-4 w-4" /> In Progress
        </span>
      );
    }
    startedAt = attempt?.startedAt?.toDate
      ? attempt?.startedAt?.toDate().toLocaleString()
      : attempt?.startedAt?.seconds
      ? new Date(attempt?.startedAt?.seconds * 1000).toLocaleString()
      : null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex items-center justify-center">
      <div className="max-w-lg w-full mx-auto bg-white rounded-2xl shadow-xl p-8 border border-indigo-100">
        <div className="flex items-center gap-4 mb-6">
          <PlayCircle className="h-12 w-12 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-indigo-700">{quiz.title || quiz.name}</h1>
            <div className="flex gap-2 items-center mt-1">
              {quiz.subjects ? (
                quiz.subjects.map((sub: string) => (
                  <span
                    key={sub}
                    className="inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-semibold"
                  >
                    {sub}
                  </span>
                ))
              ) : quiz.subject ? (
                <span className="inline-block bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-semibold">
                  {quiz.subject}
                </span>
              ) : null}
              {quiz.chapters && quiz.chapters.length > 0 && (
                quiz.chapters.map((ch: string) => (
                  <span
                    key={ch}
                    className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold"
                  >
                    {ch}
                  </span>
                ))
              )}
              {statusTag}
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-semibold text-indigo-800">Duration:</span>{' '}
            <span className="text-indigo-700">{quiz.duration} min</span>
          </div>
          <div>
            <span className="font-semibold text-indigo-800">Questions:</span>{' '}
            <span className="text-indigo-700">{quiz.questionCount || (quiz.selectedQuestions ? quiz.selectedQuestions.length : '')}</span>
          </div>
          <div>
            <span className="font-semibold text-indigo-800">Questions Per Page:</span>{' '}
            <span className="text-indigo-700">{quiz.questionsPerPage || 1}</span>
          </div>
          {startedAt && (
            <div>
              <span className="font-semibold text-indigo-800">Started At:</span>{' '}
              <span className="text-indigo-700">{startedAt}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4 mt-8">
          {/* Only show Start if not started */}
          {!attempt && (
            <Button
              onClick={handleStartQuiz}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold py-2 rounded-xl shadow transition-all flex items-center justify-center gap-2"
            >
              <PlayCircle className="h-6 w-6" /> Start Quiz
            </Button>
          )}
          {/* Show Resume if started but not completed */}
          {attempt && !attempt.completed && (
            <Button
              onClick={handleStartQuiz}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold py-2 rounded-xl shadow transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-6 w-6" /> Resume Quiz
            </Button>
          )}
          {/* Show attempted info if completed */}
          {attempt && attempt.completed && (
            <div className="w-full flex flex-col items-center gap-2">
              <BadgeCheck className="h-8 w-8 text-green-600" />
              <span className="text-green-700 font-bold text-lg">You have already attempted this test.</span>
              <span className="text-gray-500 text-sm">Only one attempt is allowed.</span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => router.push('/students/user-quizzes')}
            className="w-full text-indigo-700 border-indigo-300 font-semibold py-2 rounded-xl shadow mt-2"
          >
            Back to My Quizzes
          </Button>
        </div>
      </div>
    </div>
  );
}
