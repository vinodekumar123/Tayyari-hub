import React from 'react';
import { Flag, Edit, Info } from 'lucide-react';
import DOMPurify from 'dompurify';
import { toast } from 'sonner';
import { Question } from '@/types';

interface QuestionCardProps {
    question: Question;
    index: number;
    totalIndex: number;
    answer: string | undefined;
    isFlagged: boolean;
    isAdmin: boolean;
    showAnswers: boolean;
    onAnswer: (questionId: string, answer: string) => void;
    onToggleFlag: (questionId: string) => void;
    totalAnswered: number;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
    question: q,
    index,
    totalIndex,
    answer,
    isFlagged,
    isAdmin,
    showAnswers,
    onAnswer,
    onToggleFlag,
    totalAnswered
}) => {
    const isCorrectAnswerVisible = isAdmin && showAnswers;

    return (
        <div id={`question-${q.id}`} className={`space-y-4 p-4 rounded-lg transition-colors ${isCorrectAnswerVisible ? 'bg-slate-50 border border-slate-100' : ''}`}>
            <div className="flex justify-between items-start gap-4 overflow-hidden">
                <div
                    className="text-lg font-medium prose max-w-none flex-1 group relative dark:prose-invert"
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                >
                    <span className="font-bold text-slate-700 dark:text-slate-300">Q{totalIndex + 1}. </span>
                    <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(q.questionText || '') }} />

                    {isAdmin && (
                        <a
                            href={`/admin/questions/create?edit=${q.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute -right-6 top-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-blue-600"
                            title="Edit Question"
                        >
                            <Edit className="w-4 h-4" />
                        </a>
                    )}
                </div>
                <button onClick={() => onToggleFlag(q.id)} className={`p-2 rounded-full hover:bg-slate-100 ${isFlagged ? 'text-yellow-500' : 'text-slate-300'}`}>
                    <Flag className="w-5 h-5 fill-current" />
                </button>
            </div>

            <div className="grid gap-3">
                {(q.options || []).map((opt: string, i: number) => {
                    const isSelected = answer === opt;
                    const isCorrect = isCorrectAnswerVisible && opt === q.correctAnswer;

                    let borderClass = 'border-gray-200 dark:border-gray-700';
                    let bgClass = 'bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800';

                    if (isSelected) {
                        borderClass = 'border-blue-500 ring-1 ring-blue-500 dark:border-blue-400 dark:ring-blue-400';
                        bgClass = 'bg-blue-50 dark:bg-blue-900/20';
                    }
                    if (isCorrect) {
                        borderClass = 'border-green-500 ring-2 ring-green-500 dark:border-green-400 dark:ring-green-400';
                        bgClass = 'bg-green-50 dark:bg-green-900/20';
                    }

                    return (
                        <label key={i} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${borderClass} ${bgClass} relative overflow-hidden group`}>
                            <div className="flex items-center h-5 flex-shrink-0">
                                <input
                                    type="radio"
                                    name={q.id}
                                    value={opt}
                                    checked={isSelected}
                                    onChange={() => {
                                        onAnswer(q.id, opt);
                                        if (!isSelected) {
                                            if (totalAnswered > 0 && totalAnswered % 5 === 0) {
                                                toast.success(`Great momentum! ${totalAnswered} questions answered!`, {
                                                    icon: '🔥',
                                                    duration: 2000,
                                                    position: 'bottom-center'
                                                });
                                            }
                                        }
                                    }}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                />
                            </div>
                            <div className="ml-3 text-sm font-medium flex-1 min-w-0 flex items-center gap-3">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-500 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-300 transition-colors flex-shrink-0">
                                    {['A', 'B', 'C', 'D'][i]}
                                </div>
                                <span
                                    className="prose max-w-none"
                                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opt) }}
                                />
                            </div>
                            {isCorrect && (
                                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-green-500"></div>
                            )}
                        </label>
                    );
                })}
            </div>

            {isCorrectAnswerVisible && q.explanation && (
                <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg text-sm text-green-800 animate-in fade-in slide-in-from-top-2">
                    <p className="font-bold flex items-center gap-2 mb-1"><Info className="w-4 h-4" /> Explanation:</p>
                    <p>{q.explanation}</p>
                </div>
            )}
        </div>
    );
};
