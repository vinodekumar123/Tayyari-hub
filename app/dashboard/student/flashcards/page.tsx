'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bookmark, Trash2, RotateCcw, X, Eye, EyeOff, Search, Clock, BookOpen, BarChart3, Grid, CheckCircle, Play, ArrowRight, ArrowLeft, Repeat, Shuffle, Trophy, Timer, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { format } from 'date-fns';
import { UnifiedHeader } from '@/components/unified-header';
import { Progress } from '@/components/ui/progress';

interface Flashcard {
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

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export default function FlashcardsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [timeFilter, setTimeFilter] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState<Flashcard | null>(null);
    const [activeTab, setActiveTab] = useState('active');

    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // Study Mode State
    const [isStudyOpen, setIsStudyOpen] = useState(false);
    const [studyIndex, setStudyIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isShuffled, setIsShuffled] = useState(false);
    const [shuffledCards, setShuffledCards] = useState<Flashcard[]>([]);
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, u => {
            setUser(u);
            if (!u) setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const loadMoreCards = async () => {
        if (!user || !lastDoc) return;
        setLoadingMore(true);

        try {
            const q = query(
                collection(db, 'users', user.uid, 'flashcards'),
                orderBy('savedAt', 'desc'),
                limit(12),
                startAfter(lastDoc)
            );

            const snap = await getDocs(q);
            const newCards = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Flashcard[];

            setFlashcards(prev => [...prev, ...newCards]);

            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(snap.docs.length === 12);
        } catch (e) {
            console.error("Error fetching flashcards", e);
            toast.error("Failed to load cards");
        } finally {
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!user) return;

        const loadInitial = async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'users', user.uid, 'flashcards'),
                    orderBy('savedAt', 'desc'),
                    limit(12)
                );

                const snap = await getDocs(q);
                const newCards = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Flashcard[];

                setFlashcards(newCards);
                setLastDoc(snap.docs[snap.docs.length - 1] || null);
                setHasMore(snap.docs.length === 12);
            } catch (e) {
                console.error("Error fetching flashcards", e);
                toast.error("Failed to load cards");
            } finally {
                setLoading(false);
            }
        };

        loadInitial();
    }, [user]);

    // Filter Logic
    const filteredCards = useMemo(() => {
        let list = activeTab === 'active' ? flashcards.filter(c => !c.isDeleted) : flashcards.filter(c => c.isDeleted);

        if (subjectFilter !== 'all') {
            list = list.filter(c => (c.subject || 'Unknown') === subjectFilter);
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(c => c.questionText.toLowerCase().includes(lower) || c.topic?.toLowerCase().includes(lower));
        }

        return list;

    }, [flashcards, activeTab, subjectFilter, searchTerm]);

    // Get study cards (either shuffled or filtered)
    const studyCards = useMemo(() => {
        return isShuffled ? shuffledCards : filteredCards;
    }, [isShuffled, shuffledCards, filteredCards]);

    const startStudySession = () => {
        const activeCards = filteredCards.filter(c => !c.isDeleted);
        if (activeCards.length === 0) {
            toast.error("No cards to study!");
            return;
        }
        setStudyIndex(0);
        setIsFlipped(false);
        setIsShuffled(false);
        setShuffledCards([]);
        setSelectedAnswer(null);
        setStudyStartTime(new Date());
        setIsStudyOpen(true);
    };

    const handleShuffle = () => {
        if (isShuffled) {
            // Unshuffle - go back to original order
            setIsShuffled(false);
            setShuffledCards([]);
        } else {
            // Shuffle the cards
            const shuffled = shuffleArray(filteredCards);
            setShuffledCards(shuffled);
            setIsShuffled(true);
        }
        setStudyIndex(0);
        setIsFlipped(false);
        setSelectedAnswer(null);
        toast.success(isShuffled ? "Cards restored to original order" : "Cards shuffled!");
    };

    const nextCard = useCallback(() => {
        if (studyIndex < studyCards.length - 1) {
            setStudyIndex(prev => prev + 1);
            setIsFlipped(false);
            setSelectedAnswer(null);
        } else {
            // Reached the end - show completion dialog
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

    const closeStudyMode = useCallback(() => {
        setIsStudyOpen(false);
        setShowCompletionDialog(false);
    }, []);

    // Keyboard navigation for study mode
    useEffect(() => {
        if (!isStudyOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
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
                    closeStudyMode();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isStudyOpen, nextCard, prevCard, flipCard, closeStudyMode]);

    const handleAnswerSelect = (option: string) => {
        setSelectedAnswer(option);
        // Auto-flip to show answer after selection
        setTimeout(() => setIsFlipped(true), 300);
    };

    const restartStudySession = () => {
        setStudyIndex(0);
        setIsFlipped(false);
        setSelectedAnswer(null);
        setShowCompletionDialog(false);
        setStudyStartTime(new Date());
        if (isShuffled) {
            setShuffledCards(shuffleArray(filteredCards));
        }
    };

    // Calculate study session duration
    const getStudyDuration = () => {
        if (!studyStartTime) return '0:00';
        const diff = Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle soft delete
    const handleDelete = async (card: Flashcard) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'flashcards', card.id), {
                isDeleted: true
            });
            setFlashcards(prev => prev.map(c => c.id === card.id ? { ...c, isDeleted: true } : c));
            toast.success("Moved to Recycle Bin");
        } catch (e) {
            toast.error("Failed to delete");
        }
    };

    // Handle restore
    const handleRestore = async (card: Flashcard) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'flashcards', card.id), {
                isDeleted: false
            });
            setFlashcards(prev => prev.map(c => c.id === card.id ? { ...c, isDeleted: false } : c));
            toast.success("Restored card");
        } catch (e) {
            toast.error("Failed to restore");
        }
    };

    // Handle permanent delete
    const handlePermanentDelete = async () => {
        if (!user || !cardToDelete) return;
        try {
            await deleteDoc(doc(db, 'users', user.uid, 'flashcards', cardToDelete.id));
            setFlashcards(prev => prev.filter(c => c.id !== cardToDelete.id));
            toast.success("Permanently deleted");
            setDeleteDialogOpen(false);
        } catch (e) {
            toast.error("Failed to delete permanently");
        }
    };

    const confirmPermanentDelete = (card: Flashcard) => {
        setCardToDelete(card);
        setDeleteDialogOpen(true);
    };

    const toggleReveal = (id: string) => {
        const newSet = new Set(revealedCards);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setRevealedCards(newSet);
    };

    const revealAllCards = () => {
        const allIds = new Set(filteredCards.map(c => c.id));
        setRevealedCards(allIds);
        toast.success("All answers revealed!");
    };

    const hideAllCards = () => {
        setRevealedCards(new Set());
        toast.success("All answers hidden!");
    };

    const analytics = useMemo(() => {
        const activeCards = flashcards.filter(c => !c.isDeleted);
        const total = activeCards.length;

        const subjectCounts: Record<string, number> = {};
        activeCards.forEach(c => {
            const sub = c.subject || 'Unknown';
            subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
        });

        const subjectData = Object.entries(subjectCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { total, subjectData };
    }, [flashcards]);

    const uniqueSubjects = useMemo(() => {
        const subjects = new Set(flashcards.map(c => c.subject || 'Unknown'));
        return Array.from(subjects).sort();
    }, [flashcards]);

    // Progress percentage for study mode
    const studyProgress = studyCards.length > 0 ? ((studyIndex + 1) / studyCards.length) * 100 : 0;


    if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950">
            {/* Unified Header */}
            <UnifiedHeader
                title="My Flashcards"
                subtitle="Review your saved questions and concepts."
                icon={<BookOpen className="w-6 h-6" />}
            >
                <div className="flex items-center gap-2 md:gap-4">
                    <Button onClick={startStudySession} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                        <Play className="w-4 h-4 fill-current" /> <span className="hidden sm:inline">Study Mode</span>
                    </Button>
                    <Card className="bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/50 px-4 py-2 h-10 flex items-center justify-center min-w-[80px] md:min-w-[120px]">
                        <div className="flex items-center gap-2">
                            <div className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{analytics.total}</div>
                            <div className="text-[10px] text-indigo-400 dark:text-indigo-500 font-medium uppercase tracking-wider hidden sm:block">Saved Cards</div>
                        </div>
                    </Card>
                </div>
            </UnifiedHeader>
            <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

                {/* Analytics Section */}
                {analytics.total > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-0 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Subject Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analytics.subjectData} layout="vertical" margin={{ left: 10 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'rgba(255, 255, 255, 0.9)', color: '#1f2937' }} itemStyle={{ color: '#4f46e5' }} />
                                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="border-0 shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Distribution</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[200px] flex justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analytics.subjectData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={70}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {analytics.subjectData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444'][index % 5]} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                        <TabsList>
                            <TabsTrigger value="active" className="gap-2">
                                <Grid className="w-4 h-4" /> Active Cards
                            </TabsTrigger>
                            <TabsTrigger value="recycle" className="gap-2">
                                <Trash2 className="w-4 h-4" /> Recycle Bin
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex flex-1 md:flex-none w-full md:w-auto gap-2">
                            <div className="relative flex-1 md:flex-none">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                                <Input
                                    placeholder="Search questions..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 w-full md:min-w-[250px] bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder:text-gray-400 dark:placeholder:text-gray-600 text-gray-900 dark:text-gray-100"
                                />
                            </div>
                            <select
                                value={subjectFilter}
                                onChange={(e) => setSubjectFilter(e.target.value)}
                                className="h-10 px-3 rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:outline-none"
                            >
                                <option value="all">All Subjects</option>
                                {uniqueSubjects.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <TabsContent value="active" className="space-y-6">
                        {/* Bulk Actions */}
                        {filteredCards.length > 0 && (
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-900/50 rounded-lg px-4 py-2 border border-gray-100 dark:border-slate-800">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={revealAllCards} className="text-xs">
                                        <Eye className="w-3 h-3 mr-1" /> Reveal All
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={hideAllCards} className="text-xs">
                                        <EyeOff className="w-3 h-3 mr-1" /> Hide All
                                    </Button>
                                </div>
                            </div>
                        )}

                        {filteredCards.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCards.map(card => {
                                    const isRevealed = revealedCards.has(card.id);
                                    return (
                                        <Card key={card.id} className="group hover:shadow-xl transition-all duration-300 border-t-4 border-t-indigo-500 dark:border-t-indigo-500 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-x border-b border-gray-200 dark:border-slate-800">
                                            <CardHeader className="bg-gray-50/50 dark:bg-slate-800/50 pb-3">
                                                <div className="flex justify-between items-start gap-2">
                                                    <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                                                        {card.subject || 'General'}
                                                    </Badge>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 -mt-1 -mr-2" onClick={() => handleDelete(card)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                {card.topic && <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{card.topic}</div>}
                                            </CardHeader>
                                            <CardContent className="pt-4 flex-1 flex flex-col">
                                                <div className="flex-1 mb-4 text-gray-800 dark:text-gray-100 question-content" dangerouslySetInnerHTML={{ __html: card.questionText }} />

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
                                                                <div className="text-green-900 dark:text-green-300" dangerouslySetInnerHTML={{ __html: card.explanation }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 dark:bg-slate-800 h-24 rounded-lg border border-dashed border-gray-300 dark:border-slate-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-750 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" onClick={() => toggleReveal(card.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <Eye className="w-4 h-4" /> Click to reveal answer
                                                        </div>
                                                    </div>
                                                )}
                                            </CardContent>
                                            <div className="p-3 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/30 flex justify-end">
                                                <Button variant="ghost" size="sm" onClick={() => toggleReveal(card.id)} className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                                                    {isRevealed ? <><EyeOff className="w-3 h-3 mr-1" /> Hide Answer</> : <><Eye className="w-3 h-3 mr-1" /> Show Answer</>}
                                                </Button>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                                <Bookmark className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">No active flashcards</h3>
                                <p className="text-gray-500 dark:text-gray-400">Save questions from your quiz results to see them here.</p>
                            </div>
                        )}
                    </TabsContent>

                    {/* Load More Button - Fixed logic */}
                    {hasMore && activeTab === 'active' && (
                        <div className="mt-8 flex justify-center">
                            <Button
                                variant="outline"
                                onClick={loadMoreCards}
                                disabled={loadingMore}
                                className="w-full md:w-auto min-w-[200px]"
                            >
                                {loadingMore ? 'Loading...' : 'Load More Cards'}
                            </Button>
                        </div>
                    )}

                    <TabsContent value="recycle" className="space-y-6">
                        {filteredCards.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCards.map(card => (
                                    <Card key={card.id} className="opacity-75 hover:opacity-100 transition-opacity bg-gray-50 border-gray-200 dark:bg-slate-900/60 dark:border-slate-800">
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between">
                                                <Badge variant="secondary" className="dark:bg-slate-800 dark:text-slate-300">{card.subject || 'General'}</Badge>
                                                <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 shadow-none hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50">Deleted</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-4">
                                            <div className="line-clamp-3 text-sm text-gray-600 dark:text-gray-400 mb-4" dangerouslySetInnerHTML={{ __html: card.questionText }} />
                                            <div className="flex gap-2 mt-4">
                                                <Button size="sm" variant="outline" className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 dark:border-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/20" onClick={() => handleRestore(card)}>
                                                    <RotateCcw className="w-4 h-4 mr-2" /> Restore
                                                </Button>
                                                <Button size="sm" variant="destructive" className="flex-1 dark:bg-red-900/50 dark:hover:bg-red-900/70" onClick={() => confirmPermanentDelete(card)}>
                                                    <X className="w-4 h-4 mr-2" /> Delete
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                                <Trash2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">Recycle Bin is empty</h3>
                                <p className="text-gray-500 dark:text-gray-400">Items you delete will show up here.</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Permanent Deletion</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to permanently delete this flashcard? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handlePermanentDelete}>Delete Forever</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Study Mode Dialog */}
                <Dialog open={isStudyOpen} onOpenChange={setIsStudyOpen}>
                    <DialogContent className="max-w-4xl h-[90vh] md:h-[85vh] flex flex-col p-0 gap-0 bg-gray-50 dark:bg-slate-950 border-none overflow-hidden">
                        <DialogTitle className="sr-only">Study Flashcards</DialogTitle>

                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                        Card {studyIndex + 1} of {studyCards.length}
                                    </Badge>
                                    {studyCards[studyIndex]?.subject && (
                                        <Badge variant="secondary" className="hidden sm:inline-flex">
                                            {studyCards[studyIndex].subject}
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
                                    <Button variant="ghost" size="icon" onClick={closeStudyMode}>
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
                            {studyCards.length > 0 && studyCards[studyIndex] ? (
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
                                            <div
                                                className="prose dark:prose-invert max-w-none text-base md:text-lg mb-6 question-content"
                                                dangerouslySetInnerHTML={{ __html: studyCards[studyIndex].questionText }}
                                            />

                                            {/* MCQ Options */}
                                            {studyCards[studyIndex].options && studyCards[studyIndex].options.length > 0 && (
                                                <div className="space-y-2 flex-1">
                                                    {studyCards[studyIndex].options.map((opt, i) => (
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
                                                <div className={`mb-4 p-3 rounded-lg text-center ${selectedAnswer === studyCards[studyIndex].correctAnswer
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    }`}>
                                                    {selectedAnswer === studyCards[studyIndex].correctAnswer ? (
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
                                                <span className="text-green-600 dark:text-green-400">✓</span> {studyCards[studyIndex].correctAnswer}
                                            </div>

                                            {studyCards[studyIndex].explanation && (
                                                <div className="flex-1 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg text-sm md:text-base text-gray-600 dark:text-gray-300">
                                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 text-xs uppercase tracking-wide block mb-2">Explanation:</span>
                                                    <div className="question-content" dangerouslySetInnerHTML={{ __html: studyCards[studyIndex].explanation }} />
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

                {/* Completion Dialog */}
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
                                Great job! You've reviewed all the flashcards in this session.
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
                            <Button variant="outline" onClick={closeStudyMode} className="flex-1">
                                Exit Study Mode
                            </Button>
                            <Button onClick={restartStudySession} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                                <Repeat className="w-4 h-4 mr-2" /> Study Again
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
