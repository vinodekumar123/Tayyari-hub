'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bookmark, Trash2, RotateCcw, X, Eye, EyeOff, Search, Clock, BookOpen, BarChart3, Grid, CheckCircle, Play, ArrowRight, ArrowLeft, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { format } from 'date-fns';
import { UnifiedHeader } from '@/components/unified-header';

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

    const startStudySession = () => {
        if (flashcards.length === 0) {
            toast.error("No cards to study!");
            return;
        }
        setStudyIndex(0);
        setIsFlipped(false);
        setIsStudyOpen(true);
    };

    const nextCard = () => {
        if (studyIndex < filteredCards.length - 1) {
            setStudyIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    };

    const prevCard = () => {
        if (studyIndex > 0) {
            setStudyIndex(prev => prev - 1);
            setIsFlipped(false);
        }
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

        // Time filter logic could be added here if needed
        return list;

    }, [flashcards, activeTab, subjectFilter, searchTerm]);

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


    if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div></div>;

    return (
        <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Unified Header */}
            <UnifiedHeader
                title="My Flashcards"
                subtitle="Review your saved questions and concepts."
                icon={<BookOpen className="w-6 h-6" />}
            >
                <div className="flex items-center gap-4">
                    <Button onClick={startStudySession} className="hidden md:flex bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                        <Play className="w-4 h-4 fill-current" /> Study Mode
                    </Button>
                    <Card className="bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/50 px-4 py-2 h-10 flex items-center justify-center min-w-[120px]">
                        <div className="flex items-center gap-2">
                            <div className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{analytics.total}</div>
                            <div className="text-[10px] text-indigo-400 dark:text-indigo-500 font-medium uppercase tracking-wider">Saved Cards</div>
                        </div>
                    </Card>
                </div>
            </UnifiedHeader>

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
                        <div className="relative">
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
                                            <div className="flex-1 mb-4 text-gray-800 dark:text-gray-100" dangerouslySetInnerHTML={{ __html: card.questionText }} />

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

                {/* Load More Button */}
                {hasMore && activeTab === 'active' && !subjectFilter && !searchTerm && (
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
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 bg-gray-50 dark:bg-slate-950 border-none overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                Card {studyIndex + 1} of {filteredCards.length}
                            </Badge>
                            {filteredCards[studyIndex]?.subject && (
                                <Badge variant="secondary" className="hidden sm:inline-flex">
                                    {filteredCards[studyIndex].subject}
                                </Badge>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsStudyOpen(false)}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center relative">
                        {filteredCards.length > 0 && filteredCards[studyIndex] ? (
                            <div
                                className="w-full max-w-2xl aspect-video md:aspect-[4/3] perspective-1000 cursor-pointer group"
                                onClick={() => setIsFlipped(!isFlipped)}
                            >
                                <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                                    {/* Front */}
                                    <div className="absolute w-full h-full backface-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 p-8 flex flex-col items-center justify-center text-center">
                                        <h3 className="text-xl md:text-2xl font-medium text-gray-800 dark:text-gray-100 mb-6 font-serif">
                                            Question
                                        </h3>
                                        <div
                                            className="prose dark:prose-invert max-w-none text-lg md:text-xl"
                                            dangerouslySetInnerHTML={{ __html: filteredCards[studyIndex].questionText }}
                                        />
                                        <div className="mt-8 text-sm text-gray-400 dark:text-gray-500 flex items-center gap-2 animate-pulse">
                                            <Repeat className="w-4 h-4" /> Click to flip
                                        </div>
                                    </div>

                                    {/* Back */}
                                    <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-indigo-50 dark:bg-slate-900 rounded-2xl shadow-xl border-2 border-indigo-100 dark:border-indigo-900/30 p-8 flex flex-col items-center justify-center text-center overflow-y-auto">
                                        <h3 className="text-xl md:text-2xl font-medium text-indigo-600 dark:text-indigo-400 mb-6 font-serif">
                                            Answer
                                        </h3>
                                        <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                                            {filteredCards[studyIndex].correctAnswer}
                                        </div>
                                        {filteredCards[studyIndex].explanation && (
                                            <div className="mt-4 p-4 bg-white/50 dark:bg-slate-800/50 rounded-lg text-sm md:text-base text-gray-600 dark:text-gray-300 max-h-[200px] overflow-y-auto">
                                                <div dangerouslySetInnerHTML={{ __html: filteredCards[studyIndex].explanation }} />
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

                    <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={prevCard}
                            disabled={studyIndex === 0}
                            className="w-32"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" /> Previous
                        </Button>
                        <div className="text-sm text-gray-400 hidden sm:block">
                            Use arrow keys to navigate
                        </div>
                        <Button
                            onClick={nextCard}
                            disabled={studyIndex === filteredCards.length - 1}
                            className="w-32 bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                            Next <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
