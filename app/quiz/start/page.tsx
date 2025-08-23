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

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: string;
}

interface Quiz {
  id: string;
  title: string;
  duration: number;
  questions: Question[];
}

export default function QuizStartPage() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ✅ Track Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  // ✅ Fetch quiz and previous attempt
  useEffect(() => {
    if (!user) return;

    const quizId = "sampleQuiz"; // <-- Replace with dynamic ID
    const quizRef = doc(db, "quizzes", quizId);
    const attemptRef = doc(db, "attempts", `${user.uid}_${quizId}`);

    const fetchData = async () => {
      try {
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists()) {
          alert("❌ Quiz not found!");
          setLoadingQuiz(false);
          return;
        }
        const quizData = quizSnap.data() as Quiz;
        setQuiz(quizData);

        const attemptSnap = await getDoc(attemptRef);
        if (attemptSnap.exists()) {
          setAnswers(attemptSnap.data().answers || {});
        }
      } catch (err) {
        console.error("Error fetching quiz:", err);
        alert("❌ Failed to load quiz.");
      } finally {
        setLoadingQuiz(false);
      }
    };

    fetchData();

    // ✅ Subscribe to realtime updates for auto-sync
    const unsub = onSnapshot(quizRef, (snapshot) => {
      if (snapshot.exists()) setQuiz(snapshot.data() as Quiz);
    });

    return () => unsub();
  }, [user]);

  const handleAnswerChange = async (qId: string, option: string) => {
    if (!user || !quiz) return;

    const newAnswers = { ...answers, [qId]: option };
    setAnswers(newAnswers);

    try {
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
    } catch (err) {
      console.error("Error saving answer:", err);
    }
  };

  const handleSubmit = async () => {
    if (!user || !quiz) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "attempts", `${user.uid}_${quiz.id}`), {
        submitted: true,
        submittedAt: new Date(),
      });
      alert("✅ Quiz Submitted!");
    } catch (err) {
      console.error("Submit error:", err);
      alert("❌ Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAuth || loadingQuiz) return <p className="p-4">Loading quiz...</p>;
  if (!quiz) return <p className="p-4 text-red-500">Quiz not available!</p>;

  const total = quiz.questions.length;
  const attempted = Object.keys(answers).length;
  const progress = Math.round((attempted / total) * 100);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{quiz.title}</h1>
      <p className="text-gray-600">
        Duration: {quiz.duration} minutes | Questions: {total}
      </p>

      <Progress value={progress} className="h-3" />
      <p className="text-sm mt-1">
        {attempted}/{total} answered ({progress}%)
      </p>

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

      <div className="text-center">
        <Button onClick={handleSubmit} disabled={submitting} className="px-6 py-3 text-lg">
          {submitting ? "Submitting..." : "Submit Quiz"}
        </Button>
      </div>
    </div>
  );
}
