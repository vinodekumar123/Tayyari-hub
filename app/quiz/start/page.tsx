import React, { useState, useEffect } from "react";

export default function EnhancedQuizApp({ quiz }) {
  const questionsPerPage = 5;
  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(quiz.duration * 60);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const totalPages = Math.ceil(quiz.selectedQuestions.length / questionsPerPage);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleAnswer = (qid, option) => {
    setAnswers({ ...answers, [qid]: option });
  };

  const toggleFlag = (qid) => {
    const newFlags = new Set(flags);
    if (newFlags.has(qid)) newFlags.delete(qid);
    else newFlags.add(qid);
    setFlags(newFlags);
  };

  const handleSubmit = () => {
    setShowConfirm(false);
    setSubmitted(true);
  };

  const unanswered = quiz.selectedQuestions.filter((q) => !answers[q.id]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Timer */}
      <div
        className={`p-3 rounded-xl text-center font-bold mb-4 shadow-md transition
        ${timeLeft <= 60 ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200" :
          timeLeft <= 300 ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
          "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"}`}
      >
        Time Left: {formatTime(timeLeft)}
      </div>

      {/* Questions */}
      {quiz.selectedQuestions
        .slice(currentPage * questionsPerPage, (currentPage + 1) * questionsPerPage)
        .map((question, idx) => (
          <div key={question.id} className="mb-6 p-4 rounded-xl border bg-white dark:bg-gray-800 shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold">
                Q{currentPage * questionsPerPage + idx + 1}. {question.text}
              </h3>
              <button
                onClick={() => toggleFlag(question.id)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition ${flags.has(question.id)
                  ? "bg-red-200 text-red-800 dark:bg-red-700 dark:text-white"
                  : "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-white"}`}
              >
                {flags.has(question.id) ? "🚩 Flagged" : "Flag"}
              </button>
            </div>

            <div className="space-y-2">
              {question.options.map((opt, i) => {
                const isSelected = answers[question.id] === opt;
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(question.id, opt)}
                    className={`flex items-center gap-3 p-3 rounded-xl w-full text-left border transition
                      ${isSelected
                        ? "bg-green-100 border-green-400 dark:bg-green-800 dark:border-green-600 shadow-md"
                        : "bg-white border-gray-300 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                      }`}
                  >
                    <span className="font-semibold w-6">{String.fromCharCode(65 + i)}.</span>
                    <span>{opt}</span>
                    {isSelected && <span className="ml-auto text-green-600">✔</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          disabled={currentPage === 0}
          onClick={() => setCurrentPage((p) => p - 1)}
          className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
        >
          Previous
        </button>
        {currentPage < totalPages - 1 ? (
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
          >
            Submit
          </button>
        )}
      </div>

      {/* Flagged Questions List */}
      {flags.size > 0 && (
        <div className="mt-6 p-4 rounded-xl border bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
          <h3 className="font-semibold mb-2">🚩 Flagged Questions</h3>
          <div className="flex flex-wrap gap-2">
            {[...flags].map((qid) => {
              const qIndex = quiz.selectedQuestions.findIndex((q) => q.id === qid);
              const pageForQ = Math.floor(qIndex / questionsPerPage);
              return (
                <button
                  key={qid}
                  onClick={() => setCurrentPage(pageForQ)}
                  className="px-3 py-1 rounded-lg bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-sm font-medium transition"
                >
                  Q{qIndex + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Scroll buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button
          onClick={scrollToTop}
          className="px-3 py-2 rounded-full bg-gray-300 dark:bg-gray-600 shadow hover:bg-gray-400"
        >↑</button>
        <button
          onClick={scrollToBottom}
          className="px-3 py-2 rounded-full bg-gray-300 dark:bg-gray-600 shadow hover:bg-gray-400"
        >↓</button>
      </div>

      {/* Confirm Submit Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-96">
            <h2 className="text-lg font-bold mb-4">Confirm Submission</h2>
            <p className="mb-2">Unanswered Questions: {unanswered.length}</p>
            <p className="mb-4">Flagged Questions: {flags.size}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600"
              >Cancel</button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600"
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {submitted && (
        <div className="mt-8 p-6 bg-green-50 dark:bg-green-900 rounded-xl border shadow">
          <h2 className="font-bold text-lg mb-4">✅ Quiz Submitted!</h2>
          <p>Total Questions: {quiz.selectedQuestions.length}</p>
          <p>Answered: {Object.keys(answers).length}</p>
          <p>Unanswered: {unanswered.length}</p>
          <p>Flagged: {flags.size}</p>
        </div>
      )}
    </div>
  );
}
