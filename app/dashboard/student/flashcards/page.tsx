'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, orderBy, limit, startAfter, getDocs, doc, updateDoc, deleteDoc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bookmark, Trash2, Search, BookOpen, Grid, Eye, EyeOff, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UnifiedHeader } from '@/components/unified-header';
import { Card } from '@/components/ui/card';

// Components
import { FlashcardStats } from '@/components/flashcards/FlashcardStats';
import { FlashcardItem, Flashcard } from '@/components/flashcards/FlashcardItem';
import { StudyModeDialog } from '@/components/flashcards/StudyModeDialog';

export default function FlashcardsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [subjectFilter, setSubjectFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('active');

    // Pagination
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // UI State
    const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [cardToDelete, setCardToDelete] = useState<Flashcard | null>(null);
    const [isStudyOpen, setIsStudyOpen] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, u => {
            setUser(u);
            if (!u) setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchCards = async (isInitial = false) => {
        if (!user) return;
        if (isInitial) setLoading(true);
        else setLoadingMore(true);

        try {
            const constraints: any[] = [
                orderBy('savedAt', 'desc'),
                limit(12)
            ];

            if (!isInitial && lastDoc) {
                constraints.push(startAfter(lastDoc));
            }

            const q = query(collection(db, 'users', user.uid, 'flashcards'), ...constraints);
            const snap = await getDocs(q);
            const newCards = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Flashcard[];

            if (isInitial) setFlashcards(newCards);
            else setFlashcards(prev => [...prev, ...newCards]);

            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(snap.docs.length === 12);
        } catch (e) {
            console.error("Error fetching flashcards", e);
            toast.error("Failed to load cards");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (user) fetchCards(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Filter Logic
    const filteredCards = useMemo(() => {
        let list = activeTab === 'active' ? flashcards.filter(c => !c.isDeleted) : flashcards.filter(c => c.isDeleted);

        if (subjectFilter !== 'all') {
            list = list.filter(c => (c.subject || 'Unknown').toLowerCase() === subjectFilter.toLowerCase());
        }

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(c => c.questionText.toLowerCase().includes(lower) || c.topic?.toLowerCase().includes(lower));
        }
        return list;
    }, [flashcards, activeTab, subjectFilter, searchTerm]);

    const activeCardsTotal = useMemo(() => flashcards.filter(c => !c.isDeleted).length, [flashcards]);

    const uniqueSubjects = useMemo(() => {
        const subjects = new Set(flashcards.map(c => c.subject || 'Unknown'));
        return Array.from(subjects).sort();
    }, [flashcards]);

    const analytics = useMemo(() => {
        const activeList = flashcards.filter(c => !c.isDeleted);
        const subjectCounts: Record<string, number> = {};
        activeList.forEach(c => {
            const sub = c.subject || 'Unknown';
            subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
        });
        const subjectData = Object.entries(subjectCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
        return { total: activeList.length, subjectData };
    }, [flashcards]);

    // Handlers
    const handleDelete = async (card: Flashcard) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'flashcards', card.id), { isDeleted: true });
            setFlashcards(prev => prev.map(c => c.id === card.id ? { ...c, isDeleted: true } : c));
            toast.success("Moved to Recycle Bin");
        } catch (e) {
            toast.error("Failed to delete");
        }
    };

    const handleRestore = async (card: Flashcard) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'flashcards', card.id), { isDeleted: false });
            setFlashcards(prev => prev.map(c => c.id === card.id ? { ...c, isDeleted: false } : c));
            toast.success("Restored card");
        } catch (e) {
            toast.error("Failed to restore");
        }
    };

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

    const toggleReveal = (id: string) => {
        const newSet = new Set(revealedCards);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setRevealedCards(newSet);
    };

    const revealAll = () => {
        const allIds = new Set(filteredCards.map(c => c.id));
        setRevealedCards(allIds);
        toast.success("All answers revealed!");
    };

    const hideAll = () => {
        setRevealedCards(new Set());
        toast.success("All answers hidden!");
    };

    const startStudy = () => {
        const studySet = filteredCards.filter(c => !c.isDeleted);
        if (studySet.length === 0) {
            toast.error("No cards to study!");
            return;
        }
        setIsStudyOpen(true);
    };

    if (loading) return <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-slate-950"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div></div>;

    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950">
            <UnifiedHeader
                title="My Flashcards"
                subtitle="Review your saved questions and concepts."
                icon={<BookOpen className="w-6 h-6" />}
            >
                <div className="flex items-center gap-2 md:gap-4">
                    <Button onClick={startStudy} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                        <Play className="w-4 h-4 fill-current" /> <span className="hidden sm:inline">Study Mode</span>
                    </Button>
                    <Card className="bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/50 px-4 py-2 h-10 flex items-center justify-center min-w-[80px] md:min-w-[120px]">
                        <div className="flex items-center gap-2">
                            <div className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">{activeCardsTotal}</div>
                            <div className="text-[10px] text-indigo-400 dark:text-indigo-500 font-medium uppercase tracking-wider hidden sm:block">Saved Cards</div>
                        </div>
                    </Card>
                </div>
            </UnifiedHeader>

            <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
                <FlashcardStats total={analytics.total} subjectData={analytics.subjectData} />

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
                                    className="pl-9 w-full md:min-w-[250px] bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                                />
                            </div>
                            <select
                                value={subjectFilter}
                                onChange={(e) => setSubjectFilter(e.target.value)}
                                className="h-10 px-3 rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="all">All Subjects</option>
                                {uniqueSubjects.map(sub => (
                                    <option key={sub} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <TabsContent value="active" className="space-y-6">
                        {filteredCards.length > 0 && (
                            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-900/50 rounded-lg px-4 py-2 border border-gray-100 dark:border-slate-800">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {filteredCards.length} card{filteredCards.length !== 1 ? 's' : ''}
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={revealAll} className="text-xs">
                                        <Eye className="w-3 h-3 mr-1" /> Reveal All
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={hideAll} className="text-xs">
                                        <EyeOff className="w-3 h-3 mr-1" /> Hide All
                                    </Button>
                                </div>
                            </div>
                        )}

                        {filteredCards.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCards.map(card => (
                                    <FlashcardItem
                                        key={card.id}
                                        card={card}
                                        isRevealed={revealedCards.has(card.id)}
                                        onToggleReveal={toggleReveal}
                                        onDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                                <Bookmark className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">
                                    {searchTerm || subjectFilter !== 'all' ? 'No matches found' : 'No active flashcards'}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400">
                                    {searchTerm || subjectFilter !== 'all' ? 'Try adjusting your filters.' : 'Save questions from quiz results to see them here.'}
                                </p>
                            </div>
                        )}

                        {/* UX Improvement: Load More Logic */}
                        {hasMore ? (
                            <div className="mt-8 flex justify-center">
                                <Button
                                    variant="outline"
                                    onClick={() => fetchCards(false)}
                                    disabled={loadingMore}
                                    className="min-w-[200px]"
                                >
                                    {loadingMore ? 'Loading...' : 'Load More Cards'}
                                </Button>
                            </div>
                        ) : (
                            // Show helpful message if there are server-side results but client filter hides them
                            hasMore && filteredCards.length === 0 && (
                                <div className="text-center mt-4">
                                    <p className="text-sm text-muted-foreground mb-2">There are more cards available. Try loading more to find what you're looking for.</p>
                                    <Button variant="outline" onClick={() => fetchCards(false)} disabled={loadingMore}>
                                        Load More
                                    </Button>
                                </div>
                            )
                        )}
                    </TabsContent>

                    <TabsContent value="recycle" className="space-y-6">
                        {filteredCards.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCards.map(card => (
                                    <FlashcardItem
                                        key={card.id}
                                        card={card}
                                        isRevealed={false}
                                        onToggleReveal={() => { }}
                                        onRestore={handleRestore}
                                        onPermanentDelete={(c) => { setCardToDelete(c); setDeleteDialogOpen(true); }}
                                        isRecycleBin={true}
                                    />
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
            </div>

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

            <StudyModeDialog
                isOpen={isStudyOpen}
                onClose={() => setIsStudyOpen(false)}
                cards={filteredCards.filter(c => !c.isDeleted)}
            />
        </div>
    );
}
