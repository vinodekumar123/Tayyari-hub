"use client";

import React, { useState, useEffect } from "react";

type Question = {
  id: number;
  question: string;
  options: string[];
  answer: string;
};

export default function EnhancedQuizApp({ quiz }: { quiz: Question[] }) {
  // Config
  const questionsPerPage = 5;

  // States
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: string }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());

  // Scroll buttons visibility
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const totalPages = Math.ceil(quiz.length / questionsPerPage);

  // Track scroll for auto-hide buttons
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
      setShowScrollBottom(window.innerHeight + window.scrollY < document.body.offsetHeight - 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Helpers
  const currentQuestions = quiz.slice(
    currentPage * questionsPerPage,
    (currentPage + 1) * questionsPerPage
  );

  const toggleFlag = (id: number) => {
    setFlaggedQuestions((prev) => {
      const newFlags = new Set(prev);
      newFlags.has(id) ? newFlags.delete(id) : newFlags.add(id);
      return newFlags;
    });
  };

  const handleOptionSelect = (questionId: number, option: string) => {
    setSelectedOptions((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleSubmit = () => {
    const unanswered = quiz.filter((q) => !selectedOptions[q.id]);
    const confirmSubmit = confirm(
      `You have ${unanswered.length} unanswered questions and ${flaggedQuestions.size} flagged questions.\nAre you sure you want to submit?`
    );
    if (confirmSubmit) {
      alert("Quiz submitted!");
      // You can send results to backend here
    }
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Quiz</h1>

      {/* Flagged question list */}
      {flaggedQuestions.size > 0 && (
        <div className="mb-6 p-3 border rounded bg-yellow-50">
          <h2 className="font-semibold mb-2">🚩 Flagged Questions</h2>
          <ul className="flex flex-wrap gap-2">
            {Array.from(flaggedQuestions).map((id) => (
              <li key={id}>
                <button
                  onClick={() => {
                    const index = quiz.findIndex((q) => q.id === id);
                    if (index !== -1) {
                      const page = Math.floor(index / questionsPerPage);
                      setCurrentPage(page);
                      setTimeout(() => {
                        const el = document.getElementById(`q-${id}`);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 100);
                    }
                  }}
                  className="px-3 py-1 bg-yellow-300 text-sm rounded hover:bg-yellow-400"
                >
                  Q{id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions */}
      {currentQuestions.map((q) => (
        <div
          key={q.id}
          id={`q-${q.id}`}
          className={`p-4 mb-4 border rounded-lg shadow-sm transition 
            ${flaggedQuestions.has(q.id) ? "border-red-400" : "border-gray-300"}`}
        >
          <div className="flex justify-between items-start">
            <h2 className="font-semibold">
              {q.id}. {q.question}
            </h2>
            <button
              onClick={() => toggleFlag(q.id)}
              className={`ml-2 text-sm px-2 py-1 rounded ${
                flaggedQuestions.has(q.id) ? "bg-red-300" : "bg-gray-200"
              }`}
            >
              {flaggedQuestions.has(q.id) ? "Unflag" : "Flag"}
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {q.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleOptionSelect(q.id, option)}
                className={`block w-full text-left p-2 rounded border transition 
                  ${
                    selectedOptions[q.id] === option
                      ? "bg-blue-500 text-white border-blue-600"
                      : "bg-white hover:bg-blue-100 border-gray-300"
                  }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Pagination */}
      <div className="flex justify-between items-center my-6">
        <button
          disabled={currentPage === 0}
          onClick={() => setCurrentPage((p) => p - 1)}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          disabled={currentPage === totalPages - 1}
          onClick={() => setCurrentPage((p) => p + 1)}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Submit Quiz
      </button>

      {/* Scroll Buttons */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-6 px-3 py-2 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600"
        >
          ⬆
        </button>
      )}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-6 right-6 px-3 py-2 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600"
        >
          ⬇
        </button>
      )}
    </div>
  );
}
