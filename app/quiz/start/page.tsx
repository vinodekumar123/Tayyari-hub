// ... all imports unchanged ...
import { ArrowLeft, ArrowRight, Info, BookOpen, Clock, Send, Download, CheckCircle, Check } from 'lucide-react';
// ...rest unchanged...

// ...rest unchanged...

const StartQuizPage: React.FC = () => {
  // ...all original hooks and logic unchanged...

  // Modern UI styles (can move to CSS file, but here for clarity)
  const styles = {
    card: "rounded-2xl shadow-xl bg-white p-6 mb-8 border border-gray-100 flex flex-col gap-6",
    questionHeader: "flex items-center mb-3 gap-3",
    badge: "flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white text-lg font-bold shadow",
    questionText: "font-semibold text-lg text-gray-900 font-sans",
    optionsList: "flex flex-col gap-4 mt-2",
    option: "flex items-center px-4 py-3 rounded-xl border text-base font-medium font-sans shadow-sm cursor-pointer transition-all select-none w-full",
    optionDefault: "border-gray-300 bg-white text-black hover:bg-gray-50",
    optionSelected: "border-blue-600 bg-blue-600 text-white shadow-md",
    optionCheck: "ml-2",
    optionLabel: "flex items-center gap-2 w-full text-left font-medium",
    radio: "h-5 w-5 text-blue-600 mr-3",
  };

  // ...loading check unchanged...

  return (
    <div className="min-h-screen bg-gray-50 px-4">
      {/* ...modals unchanged... */}
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        {/* ...unchanged... */}
      </header>
      <main className="max-w-6xl w-full mx-auto p-4">
        {/* ...admin mode unchanged... */}

        <Card className="shadow-md w-full">
          <CardHeader>
            {/* ...unchanged... */}
            <Progress
              value={((startIdx + questionsPerPage) / flattenedQuestions.length) * 100}
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="space-y-10">
            {Object.entries(pageGroupedQuestions).map(([subject, questions]) => (
              <div key={subject} className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 border-b-2 border-blue-500 pb-2">
                  {subject}
                </h2>
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className={styles.card}
                    style={{ fontFamily: 'Inter, Segoe UI, Arial, sans-serif', fontSize: '1rem' }}
                  >
                    {/* Question Header: badge and question */}
                    <div className={styles.questionHeader}>
                      <div className={styles.badge}>{startIdx + idx + 1}</div>
                      <span className={styles.questionText}>
                        <span dangerouslySetInnerHTML={{ __html: q.questionText }} />
                      </span>
                    </div>
                    {/* Options UI */}
                    <div className={styles.optionsList}>
                      {q.options.map((opt, i) => {
                        const selected = answers[q.id] === opt;
                        return (
                          <label
                            key={i}
                            htmlFor={`opt-${q.id}-${i}`}
                            className={[
                              styles.option,
                              selected ? styles.optionSelected : styles.optionDefault
                            ].join(' ')}
                            style={{
                              borderWidth: selected ? '2px' : '1px',
                              boxShadow: selected
                                ? '0 2px 10px 0 rgba(37,99,235,0.11)'
                                : '0 1px 4px 0 rgba(0,0,0,0.04)',
                              background: selected ? '#2563EB' : undefined,
                              color: selected ? '#fff' : undefined,
                              fontWeight: selected ? 600 : 500,
                              transition: 'background 0.2s, color 0.2s',
                            }}
                          >
                            <input
                              type="radio"
                              id={`opt-${q.id}-${i}`}
                              name={q.id}
                              value={opt}
                              checked={answers[q.id] === opt}
                              onChange={() => handleAnswer(q.id, opt)}
                              className={styles.radio}
                              // DO NOT hide input, for accessibility & auto-save!
                            />
                            <span className={styles.optionLabel}>
                              <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                              <span className="prose max-w-none" dangerouslySetInnerHTML={{ __html: opt }} />
                            </span>
                            {/* Show checkmark if selected */}
                            {selected && (
                              <span className={styles.optionCheck}><Check className="w-5 h-5 text-white" /></span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {/* Explanation if applicable */}
                    {quiz.resultVisibility === 'immediate' && q.showExplanation && answers[q.id] && (
                      <div className="bg-blue-50 border border-blue-200 p-3 text-blue-800 rounded-md flex items-start gap-2 mt-4">
                        <Info className="h-5 w-5 mt-1" />
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {/* Controls */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((i) => Math.max(0, i - 1))}
                disabled={currentPage === 0 || showTimeoutModal || showSubmissionModal}
              >
                <ArrowLeft className="mr-2" /> Previous
              </Button>
              <Button
                onClick={isLastPage ? handleSubmit : () => setCurrentPage((i) => i + 1)}
                disabled={showTimeoutModal || showSubmissionModal}
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

export default StartQuizPage;
