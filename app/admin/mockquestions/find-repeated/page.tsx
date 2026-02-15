
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/app/firebase';
import { collection, getDocs, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, CheckCircle, Search, AlertTriangle, ChevronRight, ChevronDown, XCircle, RefreshCcw, Eye, BrainCircuit, CheckSquare, Copy, Settings2, AlertCircle, FileWarning } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { SanitizedContent } from '@/components/SanitizedContent';
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
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";

interface DuplicateGroup {
    questions: any[];
}

interface QualityIssue {
    questionId: string;
    issues: {
        type: 'missing_options' | 'missing_explanation' | 'invalid_correct_answer' | 'missing_correct_answer' | 'ai_detected';
        comment: string;
    }[];
    questionData?: any;
}

interface ChapterResult {
    duplicateGroups: DuplicateGroup[];
    qualityIssues: QualityIssue[];
    totalQuestions?: number;
}

export default function DeduplicatePage() {
    const [subjects, setSubjects] = useState<string[]>([]);
    const [chapters, setChapters] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
    const [resultsByChapter, setResultsByChapter] = useState<Record<string, ChapterResult>>({});
    const [stats, setStats] = useState({ total: 0, groupCount: 0, qualityIssueCount: 0 });
    const [viewingQuestion, setViewingQuestion] = useState<any | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);

    // Analysis Options
    const [enableAiAnalysis, setEnableAiAnalysis] = useState(true);
    const [enableQualityCheck, setEnableQualityCheck] = useState(false);

    // Progress Tracking
    const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
    const [processingStatus, setProcessingStatus] = useState<string>('');

    // Expanded chapters in results
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Record<string, Set<string>>>({});

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
                (window as any)._chapMap = chapMap;
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
            setSelectedChapters(new Set());
        }
    }, [selectedSubject]);

    const toggleChapter = (chapter: string) => {
        const next = new Set(selectedChapters);
        if (next.has(chapter)) next.delete(chapter);
        else next.add(chapter);
        setSelectedChapters(next);
    };

    const selectAllChapters = () => {
        setSelectedChapters(new Set(chapters));
    };

    const clearAllChapters = () => {
        setSelectedChapters(new Set());
    };

    const handleRunAnalysis = async () => {
        if (!selectedSubject || selectedChapters.size === 0) {
            toast.error("Please select a subject and at least one chapter");
            return;
        }

        setIsAnalyzing(true);
        setResultsByChapter({});
        setStats({ total: 0, groupCount: 0, qualityIssueCount: 0 });
        setSelectedIds(new Set());

        const chaptersArray = Array.from(selectedChapters);
        let allResults: Record<string, ChapterResult> = {};
        let totalProcessed = 0;
        let totalGroups = 0;
        let totalQualityIssues = 0;

        try {
            for (let i = 0; i < chaptersArray.length; i++) {
                const chapter = chaptersArray[i];
                setCurrentChapterIndex(i + 1);
                setProcessingStatus(`Processing: ${chapter}`);

                const response = await fetch('/api/admin/mock-questions/find-repeated', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subject: selectedSubject,
                        chapters: [chapter],
                        enableAiAnalysis,
                        enableQualityCheck
                    })
                });

                const data = await response.json();

                if (data.error) {
                    toast.error(`Error processing ${chapter}: ${data.error}`);
                    continue;
                }

                // Fetch question details for duplicate groups
                const chapterResult = data.byChapter?.[chapter] || { duplicateGroups: [], qualityIssues: [] };
                const duplicateGroups: DuplicateGroup[] = [];

                if (chapterResult.duplicateGroups?.length > 0) {
                    for (const idGroup of chapterResult.duplicateGroups) {
                        const questionDetails = [];
                        for (const id of idGroup) {
                            const qSnap = await getDocs(query(collection(db, 'mock-questions'), where('__name__', '==', id)));
                            if (!qSnap.empty) {
                                questionDetails.push({ id, ...qSnap.docs[0].data() });
                            }
                        }
                        if (questionDetails.length > 1) {
                            duplicateGroups.push({ questions: questionDetails });
                        }
                    }
                }

                // Fetch question details for quality issues
                const qualityIssues = chapterResult.qualityIssues || [];
                for (const issue of qualityIssues) {
                    const qSnap = await getDocs(query(collection(db, 'mock-questions'), where('__name__', '==', issue.questionId)));
                    if (!qSnap.empty) {
                        issue.questionData = { id: issue.questionId, ...qSnap.docs[0].data() };
                    }
                }

                allResults[chapter] = {
                    duplicateGroups,
                    qualityIssues,
                    totalQuestions: data.totalProcessed
                };

                totalProcessed += data.totalProcessed || 0;
                totalGroups += duplicateGroups.length;
                totalQualityIssues += qualityIssues.length;
            }

            setResultsByChapter(allResults);
            setStats({ total: totalProcessed, groupCount: totalGroups, qualityIssueCount: totalQualityIssues });

            if (totalGroups > 0 || totalQualityIssues > 0) {
                toast.success(`Found ${totalGroups} duplicate groups and ${totalQualityIssues} quality issues!`);
            } else {
                toast.info("No issues found in selected chapters.");
            }

        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Analysis failed");
        } finally {
            setIsAnalyzing(false);
            setProcessingStatus('');
            setCurrentChapterIndex(0);
        }
    };

    const handleDeleteQuestion = async (chapter: string, groupIdx: number, questionId: string) => {
        if (!confirm("Are you sure you want to delete this repeated question?")) return;

        try {
            await updateDoc(doc(db, 'mock-questions', questionId), {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: 'deduplication-tool'
            });

            const newResults = { ...resultsByChapter };
            newResults[chapter].duplicateGroups[groupIdx].questions =
                newResults[chapter].duplicateGroups[groupIdx].questions.filter(q => q.id !== questionId);

            if (newResults[chapter].duplicateGroups[groupIdx].questions.length < 2) {
                newResults[chapter].duplicateGroups.splice(groupIdx, 1);
            }

            setResultsByChapter(newResults);
            toast.success("Question deleted");
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete question");
        }
    };

    const stripHtml = (html: string) => {
        return (html || '').replace(/<[^>]*>?/gm, '');
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const selectOnlyDuplicates = () => {
        const next = new Set<string>();
        Object.values(resultsByChapter).forEach(chapterResult => {
            chapterResult.duplicateGroups.forEach(group => {
                group.questions.slice(1).forEach(q => next.add(q.id));
            });
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
            let newResults = { ...resultsByChapter };
            Object.keys(newResults).forEach(chapter => {
                newResults[chapter].duplicateGroups = newResults[chapter].duplicateGroups
                    .map(group => ({
                        ...group,
                        questions: group.questions.filter(q => !selectedIds.has(q.id))
                    }))
                    .filter(group => group.questions.length > 1);
            });

            setResultsByChapter(newResults);
            setSelectedIds(new Set());
            toast.success(`Successfully deleted ${idsToDelete.length} questions`);
        } catch (e) {
            console.error(e);
            toast.error("Failed to perform bulk delete");
        } finally {
            setIsDeletingBulk(false);
        }
    };

    const toggleChapterExpand = (chapter: string) => {
        const next = new Set(expandedChapters);
        if (next.has(chapter)) next.delete(chapter);
        else next.add(chapter);
        setExpandedChapters(next);
    };

    const toggleSectionExpand = (chapter: string, section: 'duplicates' | 'quality') => {
        const current = expandedSections[chapter] || new Set();
        const next = new Set(current);
        if (next.has(section)) next.delete(section);
        else next.add(section);
        setExpandedSections({ ...expandedSections, [chapter]: next });
    };

    const getIssueBadge = (type: string) => {
        switch (type) {
            case 'missing_options':
                return <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50"><AlertCircle className="w-3 h-3 mr-1" /> Missing Options</Badge>;
            case 'missing_explanation':
                return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50"><FileWarning className="w-3 h-3 mr-1" /> Missing Explanation</Badge>;
            case 'missing_correct_answer':
                return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><XCircle className="w-3 h-3 mr-1" /> Missing Correct Answer</Badge>;
            case 'invalid_correct_answer':
                return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><AlertTriangle className="w-3 h-3 mr-1" /> Invalid Correct Answer</Badge>;
            case 'ai_detected':
                return <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50"><BrainCircuit className="w-3 h-3 mr-1" /> AI Detected Issue</Badge>;
            default:
                return <Badge variant="outline">{type}</Badge>;
        }
    };

    const hasAnyResults = Object.keys(resultsByChapter).length > 0;
    const totalDuplicates = Object.values(resultsByChapter).reduce((sum, r) => sum + r.duplicateGroups.length, 0);
    const totalQualityIssues = Object.values(resultsByChapter).reduce((sum, r) => sum + r.qualityIssues.length, 0);

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <h1 className="text-4xl font-extrabold text-blue-900 mb-2">Repeated Questions Finder</h1>
                <p className="text-slate-500">Intelligent AI deduplication and quality analysis for your mock question bank.</p>
            </motion.div>

            {/* Analysis Filters Card */}
            <Card className="mb-6 border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-600" />
                        Analysis Filters
                    </CardTitle>
                    <CardDescription>Select chapters to scan for duplicates and quality issues</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Subject Selection */}
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

                        {/* Chapter Multi-Select */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Chapters ({selectedChapters.size} selected)
                                </label>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={selectAllChapters} disabled={!selectedSubject} className="text-xs h-6 px-2">
                                        Select All
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={clearAllChapters} disabled={!selectedSubject} className="text-xs h-6 px-2">
                                        Clear
                                    </Button>
                                </div>
                            </div>
                            <ScrollArea className="h-48 border rounded-lg p-3">
                                {!selectedSubject ? (
                                    <p className="text-sm text-slate-400 text-center py-4">Select a subject first</p>
                                ) : chapters.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-4">No chapters found</p>
                                ) : (
                                    <div className="space-y-2">
                                        {chapters.map(chapter => (
                                            <div key={chapter} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`chapter-${chapter}`}
                                                    checked={selectedChapters.has(chapter)}
                                                    onCheckedChange={() => toggleChapter(chapter)}
                                                />
                                                <label
                                                    htmlFor={`chapter-${chapter}`}
                                                    className="text-sm cursor-pointer flex-1 truncate"
                                                    title={chapter}
                                                >
                                                    {chapter}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Analysis Options Card */}
            <Card className="mb-6 border-none shadow-lg bg-white dark:bg-slate-900 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Settings2 className="w-5 h-5 text-purple-600" />
                        Analysis Options
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <div className="space-y-1">
                                <Label htmlFor="ai-analysis" className="font-semibold flex items-center gap-2">
                                    <BrainCircuit className="w-4 h-4 text-blue-500" />
                                    Enable AI Semantic Analysis
                                </Label>
                                <p className="text-xs text-slate-500">Use AI to detect semantically similar questions (slower)</p>
                            </div>
                            <Switch
                                id="ai-analysis"
                                checked={enableAiAnalysis}
                                onCheckedChange={setEnableAiAnalysis}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <div className="space-y-1">
                                <Label htmlFor="quality-check" className="font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-orange-500" />
                                    Enable MCQ Quality Checker
                                </Label>
                                <p className="text-xs text-slate-500">Identify incomplete and incorrect questions</p>
                            </div>
                            <Switch
                                id="quality-check"
                                checked={enableQualityCheck}
                                onCheckedChange={setEnableQualityCheck}
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-center">
                        <Button
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white gap-2 h-12 px-8 shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 text-base"
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing || selectedChapters.size === 0}
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Analyzing... ({currentChapterIndex}/{selectedChapters.size})
                                </>
                            ) : (
                                <>
                                    <RefreshCcw className="w-5 h-5" />
                                    Run Analysis
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Progress Indicator */}
                    {isAnalyzing && (
                        <div className="mt-4 space-y-2">
                            <Progress value={(currentChapterIndex / selectedChapters.size) * 100} className="h-2" />
                            <p className="text-sm text-center text-slate-500">{processingStatus}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Results */}
            <AnimatePresence>
                {hasAnyResults && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-6"
                    >
                        {/* Summary Bar */}
                        <div className="flex items-center justify-between border-b pb-4">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                                Analysis Results
                            </h2>
                            <div className="flex items-center gap-4">
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 px-3 py-1">
                                    {totalDuplicates} Duplicate Groups
                                </Badge>
                                {enableQualityCheck && (
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 px-3 py-1">
                                        {totalQualityIssues} Quality Issues
                                    </Badge>
                                )}
                                <span className="text-sm text-slate-500">Processed: {stats.total}</span>
                            </div>
                        </div>

                        {/* Bulk Actions */}
                        {totalDuplicates > 0 && (
                            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
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
                            </div>
                        )}

                        {/* Results by Chapter */}
                        {Object.entries(resultsByChapter).map(([chapter, result]) => {
                            const hasDuplicates = result.duplicateGroups.length > 0;
                            const hasQualityIssues = result.qualityIssues.length > 0;
                            const hasAnyIssues = hasDuplicates || hasQualityIssues;

                            if (!hasAnyIssues) return null;

                            return (
                                <Collapsible
                                    key={chapter}
                                    open={expandedChapters.has(chapter)}
                                    onOpenChange={() => toggleChapterExpand(chapter)}
                                >
                                    <Card className="border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <CollapsibleTrigger asChild>
                                            <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="flex items-center gap-2 text-lg">
                                                        {expandedChapters.has(chapter) ? (
                                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                                        ) : (
                                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                                        )}
                                                        {chapter}
                                                    </CardTitle>
                                                    <div className="flex gap-2">
                                                        {hasDuplicates && (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                                {result.duplicateGroups.length} Duplicates
                                                            </Badge>
                                                        )}
                                                        {hasQualityIssues && (
                                                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                                                {result.qualityIssues.length} Quality Issues
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardHeader>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <CardContent className="pt-0 space-y-6">
                                                {/* Duplicates Section */}
                                                {hasDuplicates && (
                                                    <Collapsible
                                                        open={expandedSections[chapter]?.has('duplicates')}
                                                        onOpenChange={() => toggleSectionExpand(chapter, 'duplicates')}
                                                    >
                                                        <CollapsibleTrigger asChild>
                                                            <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                                                                {expandedSections[chapter]?.has('duplicates') ? (
                                                                    <ChevronDown className="w-4 h-4" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4" />
                                                                )}
                                                                <h4 className="font-semibold text-amber-700">Duplicate Groups</h4>
                                                            </div>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent>
                                                            <div className="space-y-4 mt-2">
                                                                {result.duplicateGroups.map((group, gIdx) => (
                                                                    <div key={gIdx} className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                                                        <div className="flex items-center gap-2 mb-3">
                                                                            <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center font-bold text-xs">
                                                                                {gIdx + 1}
                                                                            </div>
                                                                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cluster</span>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {group.questions.map((q, qIdx) => (
                                                                                <Card key={q.id} className={cn(
                                                                                    "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 group hover:border-blue-300 transition-all relative",
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
                                                                                                    onClick={() => handleDeleteQuestion(chapter, gIdx, q.id)}
                                                                                                >
                                                                                                    <Trash2 className="w-4 h-4" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div
                                                                                            className="text-sm text-slate-800 dark:text-slate-200 line-clamp-3 leading-relaxed cursor-pointer"
                                                                                            onClick={() => setViewingQuestion(q)}
                                                                                        >
                                                                                            {stripHtml(q.questionText)}
                                                                                        </div>
                                                                                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                                                                                            <Badge variant="outline" className="text-[10px]">{q.topic || 'No Topic'}</Badge>
                                                                                            <Badge variant="outline" className="text-[10px] text-green-600">{q.correctAnswer?.substring(0, 20)}</Badge>
                                                                                        </div>
                                                                                    </CardContent>
                                                                                </Card>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                )}

                                                {/* Quality Issues Section */}
                                                {hasQualityIssues && (
                                                    <Collapsible
                                                        open={expandedSections[chapter]?.has('quality')}
                                                        onOpenChange={() => toggleSectionExpand(chapter, 'quality')}
                                                    >
                                                        <CollapsibleTrigger asChild>
                                                            <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                                                                {expandedSections[chapter]?.has('quality') ? (
                                                                    <ChevronDown className="w-4 h-4" />
                                                                ) : (
                                                                    <ChevronRight className="w-4 h-4" />
                                                                )}
                                                                <h4 className="font-semibold text-orange-700">Quality Issues</h4>
                                                            </div>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent>
                                                            <div className="space-y-3 mt-2">
                                                                {result.qualityIssues.map((issue, iIdx) => (
                                                                    <Card key={issue.questionId} className="bg-white dark:bg-slate-900 border-orange-200 dark:border-orange-900/30">
                                                                        <CardContent className="p-4">
                                                                            <div className="flex justify-between items-start mb-2">
                                                                                <span className="text-[10px] font-mono text-slate-400">{issue.questionId.substring(0, 8)}...</span>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                                                                                    onClick={() => setViewingQuestion(issue.questionData)}
                                                                                >
                                                                                    <Eye className="w-4 h-4" />
                                                                                </Button>
                                                                            </div>
                                                                            <div
                                                                                className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed mb-3 cursor-pointer"
                                                                                onClick={() => setViewingQuestion(issue.questionData)}
                                                                            >
                                                                                {stripHtml(issue.questionData?.questionText || '')}
                                                                            </div>
                                                                            <div className="space-y-2">
                                                                                {issue.issues.map((i, idx) => (
                                                                                    <div key={idx} className="flex flex-col gap-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                                                                        {getIssueBadge(i.type)}
                                                                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-1">
                                                                                            💬 {i.comment}
                                                                                        </p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </CardContent>
                                                                    </Card>
                                                                ))}
                                                            </div>
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                )}
                                            </CardContent>
                                        </CollapsibleContent>
                                    </Card>
                                </Collapsible>
                            );
                        })}
                    </motion.div>
                )}

                {!isAnalyzing && hasAnyResults && totalDuplicates === 0 && totalQualityIssues === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center py-20 text-slate-400"
                    >
                        <CheckCircle className="w-16 h-16 mb-4 text-green-500/50" />
                        <h3 className="text-xl font-semibold">No Issues Detected</h3>
                        <p>All selected chapters look clean!</p>
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
                                <SanitizedContent
                                    className="text-lg font-medium text-slate-800 dark:text-slate-100 leading-relaxed"
                                    content={viewingQuestion?.questionText}
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
                                                <SanitizedContent
                                                    className="text-sm font-medium text-slate-700 dark:text-slate-300"
                                                    content={opt}
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
                                    <SanitizedContent
                                        className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
                                        content={viewingQuestion.explanation}
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
