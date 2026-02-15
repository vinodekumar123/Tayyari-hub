'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { X, Shuffle, ArrowRight, ArrowLeft, RotateCcw, CheckCircle, Repeat, Trophy, Timer, Keyboard } from 'lucide-react';
import { SanitizedContent } from '@/components/SanitizedContent';
import { toast } from 'sonner';
import { Flashcard } from './FlashcardItem';

interface StudyModeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    cards: Flashcard[];
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function StudyModeDialog({ isOpen, onClose, cards }: StudyModeDialogProps) {
    const [studyIndex, setStudyIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isShuffled, setIsShuffled] = useState(false);
    const [shuffledCards, setShuffledCards] = useState<Flashcard[]>([]);
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

    // Initial load
    useEffect(() => {
        if (isOpen) {
            startSession();
        }
    }, [isOpen]);

    const studyCards = useMemo(() => {
        return isShuffled ? shuffledCards : cards;
    }, [isShuffled, shuffledCards, cards]);

    const startSession = () => {
        setStudyIndex(0);
        setIsFlipped(false);
        setIsShuffled(false);
        setShuffledCards([]);
        setSelectedAnswer(null);
        setStudyStartTime(new Date());
        setShowCompletionDialog(false);
    };

    const handleShuffle = () => {
        if (isShuffled) {
            setIsShuffled(false);
            setShuffledCards([]);
            toast.success("Cards restored to original order");
        } else {
            const shuffled = shuffleArray(cards);
            setShuffledCards(shuffled);
            setIsShuffled(true);
            toast.success("Cards shuffled!");
        }
        setStudyIndex(0);
        setIsFlipped(false);
        setSelectedAnswer(null);
    };

    const nextCard = useCallback(() => {
        if (studyIndex < studyCards.length - 1) {
            setStudyIndex(prev => prev + 1);
            setIsFlipped(false);
            setSelectedAnswer(null);
        } else {
            setShowCompletionDialog(true);
        }
    }, [studyIndex, studyCards.length]);

    const prevCard = useCallback(() => {
        if (studyIndex > 0) {
            setStudyIndex(prev => prev - 1);
            setIsFlipped(false);
            setSelectedAnswer(null);
        }
    }, [studyIndex]);

    const flipCard = useCallback(() => {
        setIsFlipped(prev => !prev);
    }, []);

    const handleAnswerSelect = (option: string) => {
        setSelectedAnswer(option);
        setTimeout(() => setIsFlipped(true), 300);
    };

    const restartStudySession = () => {
        setStudyIndex(0);
        setIsFlipped(false);
        setSelectedAnswer(null);
        setShowCompletionDialog(false);
        setStudyStartTime(new Date());
        if (isShuffled) {
            setShuffledCards(shuffleArray(cards));
        }
    };

    const getStudyDuration = () => {
        if (!studyStartTime) return '0:00';
        const diff = Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    nextCard();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    prevCard();
                    break;
                case ' ':
                    e.preventDefault();
                    flipCard();
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextCard, prevCard, flipCard, onClose]);

    const currentCard = studyCards[studyIndex];
    if (!currentCard && studyCards.length > 0) return null; // Should not happen

    const studyProgress = studyCards.length > 0 ? ((studyIndex + 1) / studyCards.length) * 100 : 0;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-4xl h-[90vh] md:h-[85vh] flex flex-col p-0 gap-0 bg-gray-50 dark:bg-slate-950 border-none overflow-hidden">
                    <DialogTitle className="sr-only">Study Flashcards</DialogTitle>

                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                    Card {studyIndex + 1} of {studyCards.length}
                                </Badge>
                                {currentCard?.subject && (
                                    <Badge variant="secondary" className="hidden sm:inline-flex">
                                        {currentCard.subject}
                                    </Badge>
                                )}
                                {isShuffled && (
                                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                        <Shuffle className="w-3 h-3 mr-1" /> Shuffled
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={handleShuffle} title={isShuffled ? "Restore Order" : "Shuffle Cards"}>
                                    <Shuffle className={`w-5 h-5 ${isShuffled ? 'text-amber-500' : ''}`} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={onClose}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                            <Progress value={studyProgress} className="h-2" />
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>{Math.round(studyProgress)}% complete</span>
                                <span className="flex items-center gap-1">
                                    <Timer className="w-3 h-3" /> {getStudyDuration()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Card Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center relative">
                        {studyCards.length > 0 && currentCard ? (
                            <div
                                className="w-full max-w-2xl cursor-pointer group"
                                onClick={flipCard}
                                style={{ perspective: '1000px' }}
                            >
                                <div
                                    className="relative w-full min-h-[400px] md:min-h-[450px] transition-transform duration-500"
                                    style={{
                                        transformStyle: 'preserve-3d',
                                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                                    }}
                                >
                                    {/* Front - Question */}
                                    <div
                                        className="absolute w-full h-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 p-6 md:p-8 flex flex-col"
                                        style={{ backfaceVisibility: 'hidden' }}
                                    >
                                        <h3 className="text-lg md:text-xl font-medium text-gray-800 dark:text-gray-100 mb-4 font-serif text-center">
                                            Question
                                        </h3>
                                        <SanitizedContent
                                            className="prose dark:prose-invert max-w-none text-base md:text-lg mb-6 question-content"
                                            content={currentCard.questionText}
                                        />

                                        {/* MCQ Options */}
                                        {currentCard.options && currentCard.options.length > 0 && (
                                            <div className="space-y-2 flex-1">
                                                {currentCard.options.map((opt, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleAnswerSelect(opt);
                                                        }}
                                                        className={`w-full p-3 rounded-lg border text-sm text-left flex items-start gap-3 transition-all ${selectedAnswer === opt
                                                            ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-200 dark:ring-indigo-800'
                                                            : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-750'
                                                            }`}
                                                    >
                                                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border ${selectedAnswer === opt
                                                            ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300'
                                                            : 'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-500 dark:text-gray-400'
                                                            }`}>
                                                            {String.fromCharCode(65 + i)}
                                                        </div>
                                                        <span className="flex-1 text-gray-700 dark:text-gray-300">{opt}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        <div className="mt-4 text-sm text-gray-400 dark:text-gray-500 flex items-center justify-center gap-2 animate-pulse">
                                            <Repeat className="w-4 h-4" /> Click card or press Space to flip
                                        </div>
                                    </div>

                                    {/* Back - Answer */}
                                    <div
                                        className="absolute w-full h-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-900 dark:to-indigo-950/30 rounded-2xl shadow-xl border-2 border-indigo-100 dark:border-indigo-900/30 p-6 md:p-8 flex flex-col overflow-y-auto"
                                        style={{
                                            backfaceVisibility: 'hidden',
                                            transform: 'rotateY(180deg)'
                                        }}
                                    >
                                        <h3 className="text-lg md:text-xl font-medium text-indigo-600 dark:text-indigo-400 mb-4 font-serif text-center">
                                            Answer
                                        </h3>

                                        {/* Show if user selected answer */}
                                        {selectedAnswer && (
                                            <div className={`mb-4 p-3 rounded-lg text-center ${selectedAnswer === currentCard.correctAnswer
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                }`}>
                                                {selectedAnswer === currentCard.correctAnswer ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <CheckCircle className="w-5 h-5" /> Correct!
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <X className="w-5 h-5" /> Incorrect - You selected: {selectedAnswer}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 text-center bg-white/50 dark:bg-slate-800/50 p-4 rounded-lg">
                                            <span className="text-green-600 dark:text-green-400">✓</span> {currentCard.correctAnswer}
                                        </div>

                                        {currentCard.explanation && (
                                            <div className="flex-1 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg text-sm md:text-base text-gray-600 dark:text-gray-300">
                                                <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-xs uppercase tracking-wide block mb-2">Explanation:</span>
                                                <SanitizedContent className="question-content" content={currentCard.explanation} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-gray-500">No cards accessible to study.</p>
                            </div>
                        )}
                    </div>

                    {/* Footer Navigation */}
                    <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="flex justify-between items-center gap-4">
                            <Button
                                variant="outline"
                                onClick={prevCard}
                                disabled={studyIndex === 0}
                                className="w-28 md:w-32"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
                            </Button>
                            <div className="text-xs text-gray-400 hidden md:flex items-center gap-2">
                                <Keyboard className="w-4 h-4" />
                                <span>← → to navigate • Space to flip • Esc to close</span>
                            </div>
                            <Button
                                onClick={nextCard}
                                className="w-28 md:w-32 bg-indigo-600 text-white hover:bg-indigo-700"
                            >
                                {studyIndex === studyCards.length - 1 ? (
                                    <>Finish <Trophy className="w-4 h-4 ml-2" /></>
                                ) : (
                                    <>Next <ArrowRight className="w-4 h-4 ml-2" /></>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <div className="flex justify-center mb-4">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                                <Trophy className="w-10 h-10 text-white" />
                            </div>
                        </div>
                        <DialogTitle className="text-center text-2xl">Session Complete! 🎉</DialogTitle>
                        <DialogDescription className="text-center">
                            Great job! You reviewed all the flashcards in this session.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-4">
                        <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/50">
                            <CardContent className="pt-4 text-center">
                                <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{studyCards.length}</div>
                                <div className="text-xs text-indigo-500 dark:text-indigo-500 uppercase tracking-wide">Cards Reviewed</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50">
                            <CardContent className="pt-4 text-center">
                                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{getStudyDuration()}</div>
                                <div className="text-xs text-green-500 dark:text-green-500 uppercase tracking-wide">Time Spent</div>
                            </CardContent>
                        </Card>
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="outline" onClick={onClose} className="flex-1">
                            Exit Study Mode
                        </Button>
                        <Button onClick={restartStudySession} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Repeat className="w-4 h-4 mr-2" /> Study Again
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
