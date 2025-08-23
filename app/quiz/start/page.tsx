"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/app/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Types
interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: string; // (hidden for students)
}

interface Quiz {
  id: string;
  title: string;
  duration: number; // minutes
  questions: Question[];
}

export default function QuizStartPage() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ✅ Track Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // ✅ Fetch Quiz + Auto Resume
  useEffect(() => {
    if (!user) return;

    const quizRef = doc(db, "quizzes", "sampleQuiz"); // <-- Replace with dynamic ID
    const attemptRef = doc(db, "attempts", `${user.uid}_sampleQuiz`);

    const unsubQuiz = onSnapshot(quizRef, (snapshot) => {
      if (snapshot.exists()) {
        setQuiz(snapshot.data() as Quiz);
      }
    });

    const fetchAttempt = async () => {
      const attemptSnap = await getDoc(attemptRef);
      if (attemptSnap.exists()) {
        setAnswers(attemptSnap.data().answers || {});
      }
      setLoading(false);
    };

    fetchAttempt();

    return () => unsubQuiz();
  }, [user]);

  // ✅ Save answers live (auto sync)
  const handleAnswerChange = async (qId: string, option: string) => {
    if (!user || !quiz) return;

    const newAnswers = { ...answers, [qId]: option };
    setAnswers(newAnswers);

    await setDoc(
      doc(db, "attempts", `${user.uid}_${quiz.id}`),
      {
        userId: user.uid,
        quizId: quiz.id,
        answers: newAnswers,
        updatedAt: new Date(),
      },
      { merge: true }
    );
  };

  // ✅ Submit final answers
  const handleSubmit = async () => {
    if (!user || !quiz) return;
    setSubmitting(true);

    await updateDoc(doc(db, "attempts", `${user.uid}_${quiz.id}`), {
      submitted: true,
      submittedAt: new Date(),
    });

    setSubmitting(false);
    alert("✅ Quiz Submitted!");
  };

  if (loading || !quiz) return <p className="p-4">Loading quiz...</p>;

  // ✅ Progress
  const total = quiz.questions.length;
  const attempted = Object.keys(answers).length;
  const progress = Math.round((attempted / total) * 100);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{quiz.title}</h1>
      <p className="text-gray-600">
        Duration: {quiz.duration} minutes | Questions: {total}
      </p>

      {/* ✅ Progress Bar */}
      <div>
        <Progress value={progress} className="h-3" />
        <p className="text-sm mt-1">
          {attempted}/{total} answered ({progress}%)
        </p>
      </div>

      {/* ✅ Questions in Cards */}
      <div className="space-y-4">
        {quiz.questions.map((q, idx) => (
          <Card key={q.id}>
            <CardContent className="p-4">
              <p className="font-medium mb-2">
                {idx + 1}. {q.text}
              </p>
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <label
                    key={i}
                    className={`block p-2 border rounded-lg cursor-pointer ${
                      answers[q.id] === opt
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => handleAnswerChange(q.id, opt)}
                      className="mr-2"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ✅ Submit Button with Loader */}
      <div className="text-center">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-3 text-lg"
        >
          {submitting ? "Submitting..." : "Submit Quiz"}
        </Button>
      </div>
    </div>
  );
}
