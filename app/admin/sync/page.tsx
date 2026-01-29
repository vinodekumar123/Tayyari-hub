'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, auth } from '@/app/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    writeBatch,
    orderBy,
    limit,
    Timestamp,
    serverTimestamp,
    updateDoc,
    setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    ArrowRight,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    Copy,
    Search,
    Calendar,
    Database,
    Filter,
    Zap,
    Clock,
    BarChart3,
    History,
    Play,
    Pause,
    Check,
    X,
    Info,
    ArrowLeftRight,
    Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    normalizeText,
    generateQuestionHash,
    calculateSimilarity,
    findDuplicates,
    mapQuestionFields,
    formatSyncDate,
    DuplicateCheckResult
} from '@/lib/syncUtils';

interface Question {
    id: string;
    questionText: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
    subject?: string;
    course?: string;
    courseId?: string;
    chapter?: string;
    topic?: string;
    difficulty?: string;
    year?: string;
    createdAt?: any;
    createdBy?: string;
    teacherId?: string;
    status?: string;
    isSynced?: boolean;
    syncedAt?: any;
    isDeleted?: boolean;
    [key: string]: any;
}

interface SyncHistory {
    id: string;
    syncedAt: Date;
    questionsCount: number;
    subjects: string[];
    fromDate: string | null;
    toDate: string | null;
    status: 'success' | 'partial' | 'failed';
    errors?: string[];
}

interface SyncConfig {
    lastSyncDate: Date | null;
    totalSynced: number;
}

const BATCH_SIZE = 50; // Firestore batch limit is 500, we use 50 for safety (2 batches per iteration)

export default function SyncPage() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Source questions
    const [sourceQuestions, setSourceQuestions] = useState<Question[]>([]);
    const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

    // Filters
    const [filterSubject, setFilterSubject] = useState('all');
    const [filterDifficulty, setFilterDifficulty] = useState('all');
    const [filterStatus, setFilterStatus] = useState('published');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [onlyUnsynced, setOnlyUnsynced] = useState(true);
    const [includeSimilar, setIncludeSimilar] = useState(false);

    // Duplicate detection results
    const [duplicateResults, setDuplicateResults] = useState<Map<string, DuplicateCheckResult>>(new Map());

    // Metadata
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [availableCourses, setAvailableCourses] = useState<{ id: string; name: string }[]>([]);
    const [syncConfig, setSyncConfig] = useState<SyncConfig>({ lastSyncDate: null, totalSynced: 0 });
    const [syncHistory, setSyncHistory] = useState<SyncHistory[]>([]);

    // Progress
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStats, setSyncStats] = useState({ processed: 0, total: 0, success: 0, skipped: 0, errors: 0 });

    // User names cache
    const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

    // Auth check
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, u => {
            setUser(u);
            if (!u) setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Load metadata
    useEffect(() => {
        if (!user) return;

        const loadMetadata = async () => {
            try {
                // Load subjects
                const subjectsSnap = await getDocs(collection(db, 'subjects'));
                const subjects = subjectsSnap.docs.map(d => d.data().name).filter(Boolean);
                setAvailableSubjects(subjects);

                // Load courses
                const coursesSnap = await getDocs(collection(db, 'courses'));
                const courses = coursesSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
                setAvailableCourses(courses);

                // Load sync config
                const configDoc = await getDoc(doc(db, 'sync-config', 'question-sync'));
                if (configDoc.exists()) {
                    const data = configDoc.data();
                    setSyncConfig({
                        lastSyncDate: data.lastSyncDate?.toDate() || null,
                        totalSynced: data.totalSynced || 0
                    });
                }

                // Load sync history
                const historySnap = await getDocs(
                    query(collection(db, 'sync-history'), orderBy('syncedAt', 'desc'), limit(10))
                );
                const history = historySnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    syncedAt: d.data().syncedAt?.toDate() || new Date()
                })) as SyncHistory[];
                setSyncHistory(history);

            } catch (e) {
                console.error('Error loading metadata:', e);
            } finally {
                setLoading(false);
            }
        };

        loadMetadata();
    }, [user]);

    // Analyze questions
    const analyzeQuestions = async () => {
        setAnalyzing(true);
        setSourceQuestions([]);
        setDuplicateResults(new Map());
        setSelectedQuestions(new Set());

        try {
            // Build query constraints
            // Note: We avoid using '!=' operator as it requires composite indexes
            // Instead, we filter isSynced client-side
            const constraints: any[] = [];

            if (filterSubject !== 'all') constraints.push(where('subject', '==', filterSubject));
            if (filterDifficulty !== 'all') constraints.push(where('difficulty', '==', filterDifficulty));
            if (filterStatus !== 'all') constraints.push(where('status', '==', filterStatus));
            // Removed: where('isSynced', '!=', true) - causes index issues, filtering client-side

            // Date filters - only add if we have an orderBy or single inequality
            // Firestore limitation: can only have inequality filters on one field
            if (fromDate && !toDate) {
                constraints.push(where('createdAt', '>=', new Date(fromDate)));
            } else if (toDate && !fromDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                constraints.push(where('createdAt', '<=', endDate));
            }
            // If both dates provided, we'll filter client-side to avoid index issues

            // Query source questions
            let q;
            if (constraints.length > 0) {
                q = query(collection(db, 'questions'), ...constraints, limit(1000));
            } else {
                q = query(collection(db, 'questions'), limit(1000));
            }

            const sourceSnap = await getDocs(q);
            let sources: Question[] = sourceSnap.docs.map(d => ({
                id: d.id,
                ...d.data()
            })) as Question[];

            // Client-side filtering for complex conditions
            // Filter out deleted
            sources = sources.filter(s => !s.isDeleted);

            // Filter by isSynced if option is enabled
            if (onlyUnsynced) {
                sources = sources.filter(s => s.isSynced !== true);
            }

            // Filter by date range if both dates provided (client-side to avoid Firestore index issues)
            if (fromDate && toDate) {
                const startDate = new Date(fromDate);
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                sources = sources.filter(s => {
                    const createdAt = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
                    return createdAt >= startDate && createdAt <= endDate;
                });
            }

            const activeSources = sources;

            // Load target questions for duplicate detection
            const targetSnap = await getDocs(collection(db, 'mock-questions'));
            const targetHashes = new Map<string, string>();
            const targetTexts = new Map<string, { id: string; text: string }[]>();

            targetSnap.docs.forEach(d => {
                const data = d.data();
                if (!data.isDeleted) {
                    const hash = generateQuestionHash(data.questionText, data.correctAnswer);
                    targetHashes.set(hash, d.id);

                    const normalizedText = normalizeText(data.questionText);
                    const existing = targetTexts.get(normalizedText) || [];
                    existing.push({ id: d.id, text: normalizedText });
                    targetTexts.set(normalizedText, existing);
                }
            });

            // Detect duplicates
            const duplicates = findDuplicates(
                activeSources.map(s => ({ id: s.id, questionText: s.questionText, correctAnswer: s.correctAnswer })),
                targetHashes,
                targetTexts
            );

            const duplicateMap = new Map<string, DuplicateCheckResult>();
            duplicates.forEach(d => duplicateMap.set(d.sourceId, d));

            setDuplicateResults(duplicateMap);
            setSourceQuestions(activeSources);

            // Auto-select new questions
            const newIds = new Set(duplicates.filter(d => d.status === 'new').map(d => d.sourceId));
            setSelectedQuestions(newIds);

            // Fetch user names for display
            const userIds = new Set(activeSources.map(s => s.createdBy || s.teacherId).filter(Boolean));
            const names = new Map<string, string>();
            for (const uid of userIds) {
                if (uid) {
                    try {
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        if (userDoc.exists()) {
                            names.set(uid, userDoc.data().fullName || userDoc.data().name || 'Unknown');
                        }
                    } catch { }
                }
            }
            setUserNames(names);

            toast.success(`Found ${activeSources.length} questions. ${newIds.size} new, ${duplicates.filter(d => d.status === 'duplicate').length} duplicates.`);

        } catch (e: any) {
            console.error('Analysis error:', e);
            // Check for Firestore index error
            if (e.code === 'failed-precondition' && e.message?.includes('index')) {
                const indexUrl = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
                toast.error(
                    <div>
                        <p>Firestore index required.</p>
                        {indexUrl && (
                            <a href={indexUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-500">
                                Click here to create index
                            </a>
                        )}
                    </div>,
                    { duration: 10000 }
                );
            } else {
                toast.error('Failed to analyze questions: ' + e.message);
            }
        } finally {
            setAnalyzing(false);
        }
    };

    // Get course name by ID
    const getCourseName = useCallback((courseId: string | undefined): string => {
        if (!courseId) return '';
        const course = availableCourses.find(c => c.id === courseId);
        return course?.name || '';
    }, [availableCourses]);

    // Start sync
    const startSync = async () => {
        if (selectedQuestions.size === 0) {
            toast.error('No questions selected for sync');
            return;
        }

        setSyncing(true);
        setSyncProgress(0);
        setSyncStats({ processed: 0, total: selectedQuestions.size, success: 0, skipped: 0, errors: 0 });

        const errors: string[] = [];
        let successCount = 0;
        let skippedCount = 0;

        try {
            const questionsToSync = sourceQuestions.filter(q => selectedQuestions.has(q.id));
            const totalBatches = Math.ceil(questionsToSync.length / BATCH_SIZE);

            for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                const batchStart = batchIndex * BATCH_SIZE;
                const batchEnd = Math.min(batchStart + BATCH_SIZE, questionsToSync.length);
                const batchQuestions = questionsToSync.slice(batchStart, batchEnd);

                const batch = writeBatch(db);
                const sourceBatch = writeBatch(db);

                for (const question of batchQuestions) {
                    const duplicateResult = duplicateResults.get(question.id);

                    // Skip if duplicate and not including similar
                    if (duplicateResult?.status === 'duplicate') {
                        skippedCount++;
                        continue;
                    }

                    if (duplicateResult?.status === 'similar' && !includeSimilar) {
                        skippedCount++;
                        continue;
                    }

                    try {
                        const courseName = getCourseName(question.courseId);
                        const teacherName = userNames.get(question.createdBy || question.teacherId || '') || '';

                        const mappedQuestion = mapQuestionFields(question, courseName, teacherName);
                        mappedQuestion.createdAt = serverTimestamp();
                        mappedQuestion.updatedAt = serverTimestamp();

                        // Add to mock-questions
                        const newDocRef = doc(collection(db, 'mock-questions'));
                        batch.set(newDocRef, mappedQuestion);

                        // Mark source as synced
                        const sourceRef = doc(db, 'questions', question.id);
                        sourceBatch.update(sourceRef, {
                            isSynced: true,
                            syncedAt: serverTimestamp(),
                            syncedToId: newDocRef.id
                        });

                        successCount++;
                    } catch (e: any) {
                        errors.push(`Failed to sync question ${question.id}: ${e.message}`);
                    }
                }

                // Commit batches
                await batch.commit();
                await sourceBatch.commit();

                // Update progress
                const processed = Math.min(batchEnd, questionsToSync.length);
                const progress = Math.round((processed / questionsToSync.length) * 100);
                setSyncProgress(progress);
                setSyncStats(prev => ({
                    ...prev,
                    processed,
                    success: successCount,
                    skipped: skippedCount,
                    errors: errors.length
                }));
            }

            // Update sync config
            await setDoc(doc(db, 'sync-config', 'question-sync'), {
                lastSyncDate: serverTimestamp(),
                totalSynced: (syncConfig.totalSynced || 0) + successCount,
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Save sync history
            const historyData: Omit<SyncHistory, 'id'> = {
                syncedAt: new Date(),
                questionsCount: successCount,
                subjects: [...new Set(questionsToSync.map(q => q.subject).filter(Boolean) as string[])],
                fromDate: fromDate || null,
                toDate: toDate || null,
                status: errors.length > 0 ? 'partial' : 'success',
                errors: errors.length > 0 ? errors : undefined
            };
            await setDoc(doc(collection(db, 'sync-history')), historyData);

            toast.success(`Sync complete! ${successCount} questions synced, ${skippedCount} skipped.`);

            // Refresh config
            setSyncConfig(prev => ({
                ...prev,
                lastSyncDate: new Date(),
                totalSynced: prev.totalSynced + successCount
            }));

            // Reset state for new sync
            setSourceQuestions([]);
            setSelectedQuestions(new Set());
            setDuplicateResults(new Map());
            setSyncProgress(0);

        } catch (e: any) {
            console.error('Sync error:', e);
            // Check for Firestore index error
            if (e.code === 'failed-precondition' && e.message?.includes('index')) {
                const indexUrl = e.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0];
                toast.error(
                    <div>
                        <p>Firestore index required for sync.</p>
                        {indexUrl && (
                            <a href={indexUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-500">
                                Click here to create index
                            </a>
                        )}
                    </div>,
                    { duration: 10000 }
                );
            } else {
                toast.error('Sync failed: ' + e.message);
            }
        } finally {
            setSyncing(false);
        }
    };

    // Toggle question selection
    const toggleQuestion = (id: string) => {
        const newSet = new Set(selectedQuestions);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedQuestions(newSet);
    };

    // Select all new
    const selectAllNew = () => {
        const newIds = new Set(
            sourceQuestions
                .filter(q => {
                    const result = duplicateResults.get(q.id);
                    return result?.status === 'new';
                })
                .map(q => q.id)
        );
        setSelectedQuestions(newIds);
    };

    // Select all
    const selectAll = () => {
        if (selectedQuestions.size === sourceQuestions.length) {
            setSelectedQuestions(new Set());
        } else {
            setSelectedQuestions(new Set(sourceQuestions.map(q => q.id)));
        }
    };

    // Stats
    const stats = useMemo(() => {
        const newCount = [...duplicateResults.values()].filter(d => d.status === 'new').length;
        const duplicateCount = [...duplicateResults.values()].filter(d => d.status === 'duplicate').length;
        const similarCount = [...duplicateResults.values()].filter(d => d.status === 'similar').length;
        return { total: sourceQuestions.length, new: newCount, duplicate: duplicateCount, similar: similarCount };
    }, [sourceQuestions, duplicateResults]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                            <ArrowLeftRight className="w-8 h-8 text-indigo-600" />
                            Question Bank Sync
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Sync questions from Question Bank to Mock Question Bank
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <Card className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/50">
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <div>
                                    <div className="text-xs text-indigo-500 dark:text-indigo-400">Total Synced</div>
                                    <div className="font-bold text-indigo-700 dark:text-indigo-300">{syncConfig.totalSynced}</div>
                                </div>
                            </div>
                        </Card>
                        <Card className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/50">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                                <div>
                                    <div className="text-xs text-green-500 dark:text-green-400">Last Sync</div>
                                    <div className="font-bold text-green-700 dark:text-green-300 text-sm">
                                        {formatSyncDate(syncConfig.lastSyncDate)}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Filters */}
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="w-5 h-5" />
                            Source Filters
                        </CardTitle>
                        <CardDescription>
                            Filter questions from the Question Bank to sync
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Select value={filterSubject} onValueChange={setFilterSubject}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Subjects" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Subjects</SelectItem>
                                        {availableSubjects.map(sub => (
                                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Difficulty</Label>
                                <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Difficulties" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Difficulties</SelectItem>
                                        <SelectItem value="Easy">Easy</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="Hard">Hard</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="published">Published</SelectItem>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="review">Review</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Checkbox
                                        checked={onlyUnsynced}
                                        onCheckedChange={(c) => setOnlyUnsynced(!!c)}
                                    />
                                    Only Unsynced
                                </Label>
                                <p className="text-xs text-gray-500">Skip already synced questions</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>From Date</Label>
                                <Input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>To Date</Label>
                                <Input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            <div className="flex items-end">
                                <Button
                                    onClick={analyzeQuestions}
                                    disabled={analyzing}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                >
                                    {analyzing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-4 h-4 mr-2" />
                                            Analyze & Preview
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Results */}
                {sourceQuestions.length > 0 && (
                    <>
                        {/* Stats Bar */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800">
                                <CardContent className="pt-4 text-center">
                                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
                                    <div className="text-sm text-gray-500">Total Found</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50">
                                <CardContent className="pt-4 text-center">
                                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.new}</div>
                                    <div className="text-sm text-green-600 dark:text-green-500">New</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50">
                                <CardContent className="pt-4 text-center">
                                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.similar}</div>
                                    <div className="text-sm text-amber-600 dark:text-amber-500">Similar</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50">
                                <CardContent className="pt-4 text-center">
                                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.duplicate}</div>
                                    <div className="text-sm text-red-600 dark:text-red-500">Duplicates</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Actions */}
                        <Card className="border-0 shadow-lg">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Questions to Sync</CardTitle>
                                    <CardDescription>
                                        {selectedQuestions.size} of {sourceQuestions.length} selected
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={selectAllNew}>
                                        Select New ({stats.new})
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={selectAll}>
                                        {selectedQuestions.size === sourceQuestions.length ? 'Deselect All' : 'Select All'}
                                    </Button>
                                    <div className="flex items-center gap-2 ml-4 text-sm">
                                        <Checkbox
                                            checked={includeSimilar}
                                            onCheckedChange={(c) => setIncludeSimilar(!!c)}
                                        />
                                        <Label className="text-sm">Include Similar</Label>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="max-h-[400px] overflow-y-auto space-y-2 border rounded-lg p-4 bg-gray-50 dark:bg-slate-900">
                                    {sourceQuestions.map(question => {
                                        const result = duplicateResults.get(question.id);
                                        const isSelected = selectedQuestions.has(question.id);

                                        return (
                                            <div
                                                key={question.id}
                                                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${isSelected
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800'
                                                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                                                    }`}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleQuestion(question.id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div
                                                        className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2"
                                                        dangerouslySetInnerHTML={{ __html: question.questionText }}
                                                    />
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {question.subject && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                {question.subject}
                                                            </Badge>
                                                        )}
                                                        {question.difficulty && (
                                                            <Badge variant="outline" className="text-xs">
                                                                {question.difficulty}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    {result?.status === 'new' && (
                                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" /> NEW
                                                        </Badge>
                                                    )}
                                                    {result?.status === 'duplicate' && (
                                                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                            <X className="w-3 h-3 mr-1" /> DUPLICATE
                                                        </Badge>
                                                    )}
                                                    {result?.status === 'similar' && (
                                                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                            <AlertTriangle className="w-3 h-3 mr-1" /> SIMILAR ({Math.round((result.similarityScore || 0) * 100)}%)
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Sync Button */}
                                <div className="mt-6 flex justify-end">
                                    <Button
                                        onClick={startSync}
                                        disabled={syncing || selectedQuestions.size === 0}
                                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                                    >
                                        {syncing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Syncing...
                                            </>
                                        ) : (
                                            <>
                                                <Zap className="w-4 h-4 mr-2" />
                                                Start Sync ({selectedQuestions.size} questions)
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Progress */}
                        {syncing && (
                            <Card className="border-2 border-indigo-200 dark:border-indigo-800">
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                        <span>Syncing questions...</span>
                                        <span>{syncStats.processed} / {syncStats.total}</span>
                                    </div>
                                    <Progress value={syncProgress} className="h-3" />
                                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                                        <div>
                                            <div className="text-green-600 font-bold">{syncStats.success}</div>
                                            <div className="text-gray-500">Success</div>
                                        </div>
                                        <div>
                                            <div className="text-amber-600 font-bold">{syncStats.skipped}</div>
                                            <div className="text-gray-500">Skipped</div>
                                        </div>
                                        <div>
                                            <div className="text-red-600 font-bold">{syncStats.errors}</div>
                                            <div className="text-gray-500">Errors</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

                {/* Sync History */}
                {syncHistory.length > 0 && (
                    <Card className="border-0 shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="w-5 h-5" />
                                Sync History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {syncHistory.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800"
                                    >
                                        <div className="flex items-center gap-3">
                                            {entry.status === 'success' ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            ) : entry.status === 'partial' ? (
                                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                            ) : (
                                                <X className="w-5 h-5 text-red-500" />
                                            )}
                                            <div>
                                                <div className="font-medium">{entry.questionsCount} questions synced</div>
                                                <div className="text-sm text-gray-500">
                                                    {entry.subjects.slice(0, 3).join(', ')}
                                                    {entry.subjects.length > 3 && ` +${entry.subjects.length - 3} more`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {format(entry.syncedAt, 'MMM d, yyyy h:mm a')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
