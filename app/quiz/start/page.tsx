"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "@/app/firebase";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress"; // ✅ shadcn/ui Progress

// ✅ Debounce helper
function debounce(func: (...args: any[]) => void, delay: number) {
  let timeout: any;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

export default function QuizPage({ quizId, quizData }: any) {
  const [user, setUser] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(quizData.duration * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasSubmittedRef = useRef(false);
  const timerRef = useRef<any>(null);

  // ✅ Track user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsub();
  }, []);

  // ✅ Real-time auto-resume
  useEffect(() => {
    if (!user) return;
    const attemptRef = doc(db, "users", user.uid, "quizAttempts", quizId);

    const unsub = onSnapshot(attemptRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (!data.completed) {
          setAnswers(data.answers || {});
          setCurrentPage(Math.floor((data.currentIndex || 0) / quizData.questionsPerPage));
          setTimeLeft(data.remainingTime ?? quizData.duration * 60);
        }
      }
    });

    return () => unsub();
  }, [user, quizId, quizData.duration, quizData.questionsPerPage]);

  // ✅ Debounced Firestore sync
  const saveProgress = useCallback(
    debounce(async (newAnswers: any, index: number, remaining: number) => {
      if (!user) return;
      const attemptRef = doc(db, "users", user.uid, "quizAttempts", quizId);
      await setDoc(
        attemptRef,
        {
          answers: newAnswers,
          currentIndex: index,
          remainingTime: remaining,
          completed: false,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }, 1000),
    [user, quizId]
  );

  // ✅ Answer select handler
  const handleAnswer = (questionId: string, option: string, index: number) => {
    const newAnswers = { ...answers, [questionId]: option };
    setAnswers(newAnswers);
    saveProgress(newAnswers, index, timeLeft);
  };

  // ✅ Timer
  useEffect(() => {
    if (timeLeft <= 0 && !hasSubmittedRef.current) {
      handleSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!hasSubmittedRef.current) handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  // ✅ Submit handler
  const handleSubmit = async () => {
    if (!user || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setIsSubmitting(true);

    const attemptRef = doc(db, "users", user.uid, "quizAttempts", quizId);
    await setDoc(
      attemptRef,
      {
        answers,
        completed: true,
        attemptNumber: 1, // since we overwrite always
        submittedAt: new Date(),
      },
      { merge: true }
    );

    setIsSubmitting(false);
    alert("✅ Quiz submitted successfully!");
  };

  // ✅ Format timer
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // ✅ Render
  const questions = quizData.questions.slice(
    currentPage * quizData.questionsPerPage,
    (currentPage + 1) * quizData.questionsPerPage
  );

  // ✅ Progress calculation
  const totalQuestions = quizData.questions.length;
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  return (
    <div className="max-w-3xl mx-auto p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📘 {quizData.title}</h1>
        <div className="px-4 py-2 bg-gray-100 rounded-lg font-semibold">
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1 font-medium text-gray-700">
          <span>Progress</span>
          <span>
            {answeredCount} / {totalQuestions} answered
          </span>
        </div>
        <Progress value={progressPercent} className="h-3 rounded-full" />
      </div>

      {/* Questions */}
      {questions.map((q: any, idx: number) => (
        <Card key={q.id} className="w-full shadow-md rounded-2xl mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Q{currentPage * quizData.questionsPerPage + idx + 1}.
              </CardTitle>
              <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-600 rounded-full">
                {q.subject}
              </span>
            </div>
          </CardHeader>

          <CardContent>
            <p className="text-gray-800 font-medium mb-4">{q.text}</p>
            <RadioGroup
              value={answers[q.id] || ""}
              onValueChange={(val) =>
                handleAnswer(q.id, val, currentPage * quizData.questionsPerPage + idx)
              }
              className="space-y-3"
            >
              {q.options.map((opt: string, oidx: number) => (
                <div
                  key={oidx}
                  className={`flex items-center space-x-2 border rounded-lg px-3 py-2 cursor-pointer transition 
                    ${
                      answers[q.id] === opt
                        ? "bg-blue-50 border-blue-500"
                        : "hover:bg-gray-50"
                    }`}
                >
                  <RadioGroupItem value={opt} id={`q${q.id}-opt${oidx}`} />
                  <Label htmlFor={`q${q.id}-opt${oidx}`} className="cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      ))}

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <Button
          disabled={currentPage === 0}
          onClick={() => setCurrentPage((p) => p - 1)}
        >
          ⬅ Prev
        </Button>
        {currentPage < Math.ceil(quizData.questions.length / quizData.questionsPerPage) - 1 ? (
          <Button onClick={() => setCurrentPage((p) => p + 1)}>Next ➡</Button>
        ) : (
          <Button
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="bg-green-600 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}
