'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw, X, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { SanitizedContent } from '@/components/SanitizedContent';
import { Timestamp } from 'firebase/firestore';

export interface Flashcard {
    id: string;
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    subject?: string;
    topic?: string;
    savedAt?: Timestamp;
    isDeleted?: boolean;
    [key: string]: any;
}

interface FlashcardItemProps {
    card: Flashcard;
    isRevealed: boolean;
    onToggleReveal: (id: string) => void;
    onDelete?: (card: Flashcard) => void;
    onRestore?: (card: Flashcard) => void;
    onPermanentDelete?: (card: Flashcard) => void;
    isRecycleBin?: boolean;
}

export function FlashcardItem({
    card,
    isRevealed,
    onToggleReveal,
    onDelete,
    onRestore,
    onPermanentDelete,
    isRecycleBin = false
}: FlashcardItemProps) {

    if (isRecycleBin) {
        return (
            <Card className="opacity-75 hover:opacity-100 transition-opacity bg-gray-50 border-gray-200 dark:bg-slate-900/60 dark:border-slate-800">
                <CardHeader className="pb-2">
                    <div className="flex justify-between">
                        <Badge variant="secondary" className="dark:bg-slate-800 dark:text-slate-300">{card.subject || 'General'}</Badge>
                        <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 shadow-none hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50">Deleted</Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    <SanitizedContent className="line-clamp-3 text-sm text-gray-600 dark:text-gray-400 mb-4" content={card.questionText} />
                    <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline" className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 dark:border-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/20" onClick={() => onRestore?.(card)}>
                            <RotateCcw className="w-4 h-4 mr-2" /> Restore
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1 dark:bg-red-900/50 dark:hover:bg-red-900/70" onClick={() => onPermanentDelete?.(card)}>
                            <X className="w-4 h-4 mr-2" /> Delete
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="group hover:shadow-xl transition-all duration-300 border-t-4 border-t-indigo-500 dark:border-t-indigo-500 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-x border-b border-gray-200 dark:border-slate-800">
            <CardHeader className="bg-gray-50/50 dark:bg-slate-800/50 pb-3">
                <div className="flex justify-between items-start gap-2">
                    <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                        {card.subject || 'General'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 -mt-1 -mr-2" onClick={() => onDelete?.(card)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
                {card.topic && <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{card.topic}</div>}
            </CardHeader>
            <CardContent className="pt-4 flex-1 flex flex-col">
                <SanitizedContent className="flex-1 mb-4 text-gray-800 dark:text-gray-100 question-content" content={card.questionText} />

                {/* Options Display */}
                {card.options && card.options.length > 0 && (
                    <div className="space-y-2 mb-4">
                        {card.options.map((opt, i) => {
                            const isCorrect = card.correctAnswer === opt;
                            // If revealed, highlight correct answer. If not revealed, generic style.
                            const styleClass = isRevealed && isCorrect
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-300 font-medium ring-1 ring-green-200 dark:ring-green-800"
                                : "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300";

                            return (
                                <div key={i} className={`p-3 rounded-lg border text-sm flex items-start gap-3 transition-colors ${styleClass}`}>
                                    <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs border ${isRevealed && isCorrect ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400' : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-gray-400'}`}>
                                        {String.fromCharCode(65 + i)}
                                    </div>
                                    <span className="flex-1">{opt}</span>
                                    {isRevealed && isCorrect && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />}
                                </div>
                            );
                        })}
                    </div>
                )}

                {isRevealed ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-3 bg-green-50 dark:bg-green-900/10 p-4 rounded-lg text-sm border border-green-100 dark:border-green-900/30">
                        <div>
                            <span className="font-bold text-green-800 dark:text-green-400 block mb-1">Correct Answer:</span>
                            <span className="text-green-900 dark:text-green-300 font-medium">{card.correctAnswer}</span>
                        </div>
                        {card.explanation && (
                            <div className="pt-2 border-t border-green-200/50 dark:border-green-800/30">
                                <span className="font-bold text-green-800 dark:text-green-400 text-xs uppercase tracking-wide block mb-1">Explanation:</span>
                                <SanitizedContent className="text-green-900 dark:text-green-300" content={card.explanation} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-slate-800 h-24 rounded-lg border border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-750 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={() => onToggleReveal(card.id)}>
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Click to reveal answer
                        </div>
                    </div>
                )}
            </CardContent>
            <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => onToggleReveal(card.id)} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                    {isRevealed ? <><EyeOff className="w-3 h-3 mr-1" /> Hide Answer</> : <><Eye className="w-3 h-3 mr-1" /> Show Answer</>}
                </Button>
            </div>
        </Card>
    );
}
