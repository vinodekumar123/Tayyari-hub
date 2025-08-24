"use client";

import React, { useState, useEffect } from "react";

export const dynamic = "force-dynamic"; // ✅ prevents Vercel build crash

type Question = {
  id: number;
  question: string;
  options: string[];
  answer: string;
};

export default function EnhancedQuizApp({ quiz }: { quiz?: Question[] }) {
  const questionsPerPage = 5;

  // ✅ ensure quiz is always defined at runtime
  const safeQuiz: Question[] = quiz ?? [];

  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: string }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());

  const totalPages = safeQuiz.length
    ? Math.ceil(safeQuiz.length / questionsPerPage)
    : 0;

  const currentQuestions = safeQuiz.slice(
    currentPage * questionsPerPage,
    (currentPage + 1) * questionsPerPage
  );

  const handleOptionSelect = (questionId: number, option: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
  };

  const toggleFlag = (questionId: number) => {
    setFlaggedQuestions((prev) => {
      const newFlags = new Set(prev);
      if (newFlags.has(questionId)) newFlags.delete(questionId);
      else newFlags.add(questionId);
      return newFlags;
    });
  };

  const handleSubmit = () => {
    const unanswered = safeQuiz.filter((q) => !selectedOptions[q.id]);
    if (
      !window.confirm(
        `You are about to submit.\nUnanswered: ${unanswered.length}\nFlagged: ${flaggedQuestions.size}\n\nDo you want to continue?`
      )
    ) {
      return;
    }
    console.log("Submitted Answers:", selectedOptions);
    alert("Quiz submitted successfully!");
  };

  // Scroll buttons
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6">Quiz</h1>

      {safeQuiz.length === 0 ? (
        <p className="text-gray-400">Loading quiz questions...</p>
      ) : (
        <>
          {currentQuestions.map((q) => (
            <div
              key={q.id}
              className="w-full max-w-3xl bg-gray-800 p-4 rounded-2xl shadow-lg mb-6"
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold">
                  Q{q.id}. {q.question}
                </h2>
                <button
                  onClick={() => toggleFlag(q.id)}
                  className={`px-2 py-1 rounded text-sm ${
                    flaggedQuestions.has(q.id)
                      ? "bg-yellow-500 text-black"
                      : "bg-gray-700"
                  }`}
                >
                  {flaggedQuestions.has(q.id) ? "🚩 Flagged" : "Flag"}
                </button>
              </div>

              <div className="space-y-2">
                {q.options.map((option, i) => {
                  const isSelected = selectedOptions[q.id] === option;
                  return (
                    <button
                      key={i}
                      onClick={() => handleOptionSelect(q.id, option)}
                      className={`w-full text-left px-4 py-2 rounded-lg border transition-colors ${
                        isSelected
                          ? "bg-blue-600 border-blue-400"
                          : "bg-gray-700 border-gray-600 hover:bg-gray-600"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex justify-between items-center w-full max-w-3xl mt-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(p + 1, totalPages - 1))
              }
              disabled={currentPage === totalPages - 1}
              className="px-4 py-2 bg-gray-700 rounded-lg disabled:opacity-40"
            >
              Next
            </button>
          </div>

          {/* Flagged Question Navigator */}
          {flaggedQuestions.size > 0 && (
            <div className="w-full max-w-3xl mt-6 bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Flagged Questions</h3>
              <div className="flex flex-wrap gap-2">
                {[...flaggedQuestions].map((id) => (
                  <button
                    key={id}
                    onClick={() =>
                      setCurrentPage(Math.floor((id - 1) / questionsPerPage))
                    }
                    className="px-3 py-1 bg-yellow-600 rounded-lg hover:bg-yellow-500"
                  >
                    Q{id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="mt-6 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-2xl text-lg shadow-lg"
          >
            Submit Quiz
          </button>
        </>
      )}

      {/* Scroll Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button
          onClick={scrollToTop}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 shadow-lg"
        >
          ⬆️
        </button>
        <button
          onClick={scrollToBottom}
          className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 shadow-lg"
        >
          ⬇️
        </button>
      </div>
    </div>
  );
}
