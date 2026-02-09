
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/app/firebase';
import { collection, getDocs, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, CheckCircle, Search, AlertTriangle, ChevronRight, XCircle, RefreshCcw, Eye, BrainCircuit, CheckSquare, Copy } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DuplicateGroup {
    questions: any[];
}

export default function DeduplicatePage() {
    const [subjects, setSubjects] = useState<string[]>([]);
    const [chapters, setChapters] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedChapter, setSelectedChapter] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
    const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
    const [stats, setStats] = useState({ total: 0, groupCount: 0 });
    const [viewingQuestion, setViewingQuestion] = useState<any | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    // Fetch unique subjects and chapters for filtering
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'mock-questions'));
                const subSet = new Set<string>();
                const chapMap: Record<string, Set<string>> = {};

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.subject) {
                        subSet.add(data.subject);
                        if (!chapMap[data.subject]) chapMap[data.subject] = new Set();
                        if (data.chapter) chapMap[data.subject].add(data.chapter);
                    }
                });

                setSubjects(Array.from(subSet).sort());
                // Handle chapter logic separately based on selected subject
                (window as any)._chapMap = chapMap; // Store globally for easy access
                setIsLoadingMetadata(false);
            } catch (e) {
                console.error(e);
                toast.error("Failed to load metadata");
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        if (selectedSubject && (window as any)._chapMap) {
            const chaps = Array.from((window as any)._chapMap[selectedSubject] || []).sort() as string[];
            setChapters(chaps);
            setSelectedChapter('');
        }
    }, [selectedSubject]);

    const handleRunAnalysis = async () => {
        if (!selectedSubject || !selectedChapter) {
            toast.error("Please select a subject and chapter");
            return;
        }

        setIsAnalyzing(true);
        setDuplicateGroups([]);

        try {
            const response = await fetch('/api/admin/mock-questions/find-repeated', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject: selectedSubject, chapter: selectedChapter })
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            // Fetch actual question data for the identified duplicate IDs
            if (data.allGroups && data.allGroups.length > 0) {
                const groups: DuplicateGroup[] = [];

                // We need to fetch the question details for these IDs
                // Firestore limit is 10 for 'in' query, so we fetch individually or in small batches
                for (const idGroup of data.allGroups) {
                    const questionDetails = [];
                    for (const id of idGroup) {
                        const qSnap = await getDocs(query(collection(db, 'mock-questions'), where('__name__', '==', id)));
                        if (!qSnap.empty) {
                            questionDetails.push({ id, ...qSnap.docs[0].data() });
                        }
                    }
                    if (questionDetails.length > 1) {
                        groups.push({ questions: questionDetails });
                    }
                }

                setDuplicateGroups(groups);
                setStats({ total: data.totalProcessed, groupCount: groups.length });
                toast.success(`Found ${groups.length} duplicate groups!`);
            } else {
                toast.info("No duplicates found in this chapter.");
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeleteQuestion = async (groupIdx: number, questionId: string) => {
        if (!confirm("Are you sure you want to delete this repeated question?")) return;

        try {
            // Soft delete
            await updateDoc(doc(db, 'mock-questions', questionId), {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: 'deduplication-tool'
            });

            // Update UI state
            const newGroups = [...duplicateGroups];
            newGroups[groupIdx].questions = newGroups[groupIdx].questions.filter(q => q.id !== questionId);

            // If only one left, remove the group
            if (newGroups[groupIdx].questions.length < 2) {
                newGroups.splice(groupIdx, 1);
            }

            setDuplicateGroups(newGroups);
            toast.success("Question deleted");
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete question");
        }
    };

    const stripHtml = (html: string) => {
        return html.replace(/<[^>]*>?/gm, '');
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const selectOnlyDuplicates = () => {
        const next = new Set<string>();
        duplicateGroups.forEach(group => {
            // Select all but the first one in each group
            group.questions.slice(1).forEach(q => next.add(q.id));
        });
        setSelectedIds(next);
        toast.success(`Selected ${next.size} duplicates to remove`);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Are you sure you want to soft-delete ${selectedIds.size} questions?`)) return;

        setIsDeletingBulk(true);
        try {
            const batch = writeBatch(db);
            const idsToDelete = Array.from(selectedIds);

            idsToDelete.forEach(id => {
                const ref = doc(db, 'mock-questions', id);
                batch.update(ref, {
                    isDeleted: true,
                    deletedAt: new Date(),
                    deletedBy: 'bulk-deduplication-tool'
                });
            });

            await batch.commit();

            // Notify Algolia
            try {
                await fetch('/api/admin/sync-algolia', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questionIds: idsToDelete,
                        type: 'mock',
                        action: 'soft-delete'
                    })
                });
            } catch (algoliaErr) {
                console.error("Algolia sync failed during bulk delete", algoliaErr);
            }

            // Update local state
            let newGroups = [...duplicateGroups];
            newGroups = newGroups.map(group => ({
                ...group,
                questions: group.questions.filter(q => !selectedIds.has(q.id))
            })).filter(group => group.questions.length > 1);

            setDuplicateGroups(newGroups);
            setSelectedIds(new Set());
            toast.success(`Successfully deleted ${idsToDelete.length} questions`);
        } catch (e) {
            console.error(e);
            toast.error("Failed to perform bulk delete");
        } finally {
            setIsDeletingBulk(false);
        }
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h1 className="text-4xl font-extrabold text-blue-900 mb-2">Repeated Questions Finder</h1>
                <p className="text-slate-500">Intelligent AI deduplication for your mock question bank.</p>
            </motion.div>

            <Card className="mb-8 border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-600" />
                        Analysis Filters
                    </CardTitle>
                    <CardDescription>Select a chapter to scan for duplicates</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Subject</label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={isLoadingMetadata}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={isLoadingMetadata ? "Loading..." : "Select Subject"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {subjects.map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chapter</label>
                            <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled={!selectedSubject}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select Chapter" />
                                </SelectTrigger>
                                <SelectContent>
                                    {chapters.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-10 shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing || !selectedChapter}
                        >
                            {isAnalyzing ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                            ) : (
                                <><RefreshCcw className="w-4 h-4" /> Run AI Analysis</>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <AnimatePresence>
                {duplicateGroups.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-8"
                    >
                        <div className="flex items-center justify-between border-b pb-4">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                                Identified Duplicates
                                <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 border-blue-200">
                                    {duplicateGroups.length} Groups Found
                                </Badge>
                            </h2>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={selectOnlyDuplicates}
                                    className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-2"
                                >
                                    <CheckSquare className="w-4 h-4" /> Select All Duplicates
                                </Button>
                                {selectedIds.size > 0 && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleBulkDelete}
                                        disabled={isDeletingBulk}
                                        className="gap-2 animate-in zoom-in-50"
                                    >
                                        {isDeletingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        Delete Selected ({selectedIds.size})
                                    </Button>
                                )}
                                <span className="text-sm text-slate-500 ml-4">Processed: {stats.total}</span>
                            </div>
                        </div>

                        {duplicateGroups.map((group, gIdx) => (
                            <motion.div
                                key={gIdx}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: gIdx * 0.1 }}
                                className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                                        {gIdx + 1}
                                    </div>
                                    <h3 className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-xs">Duplicate Cluster</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                    {group.questions.map((q, qIdx) => (
                                        <Card key={q.id} className={cn(
                                            "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 group hover:border-blue-300 transition-colors relative transition-all",
                                            selectedIds.has(q.id) && "ring-2 ring-orange-500 border-orange-500 bg-orange-50/10"
                                        )}>
                                            <div className="absolute top-3 left-3 z-10">
                                                <Checkbox
                                                    checked={selectedIds.has(q.id)}
                                                    onCheckedChange={() => toggleSelection(q.id)}
                                                    className="w-5 h-5 border-slate-300 bg-white"
                                                />
                                            </div>
                                            <CardContent className="p-4 pl-10">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-mono text-slate-400">{q.id.substring(0, 8)}...</span>
                                                    <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                                                            onClick={() => setViewingQuestion(q)}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                                            onClick={() => handleDeleteQuestion(gIdx, q.id)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div
                                                    className="text-sm text-slate-800 dark:text-slate-200 line-clamp-4 leading-relaxed cursor-pointer"
                                                    onClick={() => setViewingQuestion(q)}
                                                >
                                                    {stripHtml(q.questionText)}
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                                                    <Badge variant="outline" className="text-[10px]">{q.topic || 'No Topic'}</Badge>
                                                    <Badge variant="outline" className="text-[10px] text-green-600">{q.correctAnswer}</Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                )}

                {!isAnalyzing && duplicateGroups.length === 0 && selectedChapter && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center py-20 text-slate-400"
                    >
                        <CheckCircle className="w-16 h-16 mb-4 text-green-500/50" />
                        <h3 className="text-xl font-semibold">No Duplicates Detected</h3>
                        <p>This chapter looks clean!</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Preview Modal */}
            <Dialog open={!!viewingQuestion} onOpenChange={() => setViewingQuestion(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-slate-900 border-none shadow-2xl">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase tracking-widest">
                            <Eye className="w-4 h-4" />
                            Question Details • {viewingQuestion?.id}
                        </DialogTitle>
                    </DialogHeader>

                    <ScrollArea className="px-6 pb-6 pt-2 max-h-[calc(90vh-120px)]">
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">Question Statement</h4>
                                <div
                                    className="text-lg font-medium text-slate-800 dark:text-slate-100 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: viewingQuestion?.questionText }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {viewingQuestion?.options?.map((opt: string, idx: number) => {
                                    const isCorrect = opt === viewingQuestion?.correctAnswer;
                                    return (
                                        <div
                                            key={idx}
                                            className={`p-4 rounded-xl border-2 transition-all ${isCorrect
                                                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                                                : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-800'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'
                                                    }`}>
                                                    {String.fromCharCode(65 + idx)}
                                                </div>
                                                <div
                                                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                                                    dangerouslySetInnerHTML={{ __html: opt }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {viewingQuestion?.explanation && (
                                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                    <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-2 tracking-wider flex items-center gap-2">
                                        <BrainCircuit className="w-4 h-4" />
                                        Detailed Explanation
                                    </h4>
                                    <div
                                        className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: viewingQuestion.explanation }}
                                    />
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Badge variant="secondary" className="px-3 py-1">Subject: {viewingQuestion?.subject}</Badge>
                                <Badge variant="secondary" className="px-3 py-1">Chapter: {viewingQuestion?.chapter}</Badge>
                                <Badge variant="secondary" className="px-3 py-1">Topic: {viewingQuestion?.topic || 'N/A'}</Badge>
                                <Badge variant="secondary" className="px-3 py-1 bg-amber-100 text-amber-700 border-amber-200">Difficulty: {viewingQuestion?.difficulty}</Badge>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
