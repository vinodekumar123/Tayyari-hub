'use client';

import { Quiz } from '@/types';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    collection,
    query,
    orderBy,
    getDocs,
    where,
    limit,
    startAfter,
    doc,
    getDoc,
    documentId,
} from 'firebase/firestore';
import { db } from '@/app/firebase';
import { useUserStore } from '@/stores/useUserStore';
import { useCacheStore } from '@/stores/useCacheStore';
import { useUIStore } from '@/stores/useUIStore';
import { TableSkeleton } from '@/components/ui/skeleton-cards';
import { animations, glassmorphism } from '@/lib/design-tokens';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    ArrowRight, BookOpen, Calendar, Clock, Play,
    Search, Files
} from 'lucide-react';
import { UnifiedHeader } from '@/components/unified-header';

// Quiz status helper
// Quiz status helper
function getQuizStatus(startDate: string, endDate: string, startTime?: string, endTime?: string) {
    try {
        if (!startDate || !endDate) return 'ended';

        // Get current time in Pakistan
        const nowString = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi" });
        const now = new Date(nowString);

        // Helper to construct Date object in PST
        const createPSTDate = (dateStr: string, timeStr: string) => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const [h, min] = timeStr.split(':').map(Number);
            // Create a date string that effectively represents the target time in "local" perception
            // We do this by constructing a string and treating it as if it were in the same zone as 'now'
            // However, since we already converted 'now' to match PST wall-clock time, we can compare directly 
            // if we construct the target date similarly.

            // Better approach: Construct ISO string with offset if know, but simplified:
            // Let's rely on string parsing relative to the 'now' object which is already shifted.
            // Actually, simpler: construct the date, then converting it to a comparable numeric value or object 
            // that aligns with 'now'.

            // Alignment Strategy: 
            // 1. 'now' is a Date object where .getHours() returns Pakistan time (because we shifted it).
            // 2. We construct 'start' and 'end' as Date objects where .getHours() matches the input string.
            // 3. We compare them.

            return new Date(y, m - 1, d, h, min);
        };

        let start: Date;
        if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
            start = createPSTDate(startDate, startTime);
        } else {
            // Default start of day
            start = createPSTDate(startDate, "00:00");
        }

        let end: Date;
        if (endTime && /^\d{2}:\d{2}$/.test(endTime)) {
            end = createPSTDate(endDate, endTime);
        } else {
            // Default end of day
            const [y, m, d] = endDate.split('-').map(Number);
            end = new Date(y, m - 1, d, 23, 59, 59, 999);
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'ended';

        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'ended';
    } catch (error) {
        console.error("Error in getQuizStatus", error);
        return 'ended';
    }
}

export default function StudentQuizBankPage() {
    const router = useRouter();

    // Zustand stores
    const { user, isLoading: userLoading } = useUserStore();
    const cache = useCacheStore();
    const { addToast, setLoading: setUiLoading } = useUIStore();

    // State
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        accessType: 'all',
        status: 'all',
        series: 'all',
    });
    const [seriesList, setSeriesList] = useState<{ id: string; name: string }[]>([]);
    const [userEnrolledSeries, setUserEnrolledSeries] = useState<string[]>([]);
    const [lastVisible, setLastVisible] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [showPremiumDialog, setShowPremiumDialog] = useState(false);
    const [attemptedQuizzes, setAttemptedQuizzes] = useState<{ [key: string]: number }>({});
    const [missingIndexUrl, setMissingIndexUrl] = useState<string | null>(null);

    // Series Analytics State
    const [seriesStats, setSeriesStats] = useState<any[]>([]);

    // Fetch quizzes and user data
    useEffect(() => {
        // Wait for user store to finish loading before attempting fetch
        if (userLoading) {
            console.log('QuizBank: User store still loading, waiting...');
            return;
        }

        if (!user) {
            console.log('QuizBank: User store finished but no user found.');
            // User store finished loading but no user - stop loading to show empty state or redirect
            setLoading(false);
            return;
        }
        console.log('QuizBank: Starting fetch for user:', user.uid);

        const fetchData = async () => {
            setLoading(true);
            setUiLoading('quizzes', true);
            setMissingIndexUrl(null); // Reset on new fetch

            try {
                // 1. Resolve Enrolled Series (Robust fetch)
                // Fetch true source of truth: Enrollment Receipts
                const enrollmentsQ = query(collection(db, 'enrollments'), where('studentId', '==', user.uid), where('status', '==', 'active'));
                const enrollmentsSnap = await getDocs(enrollmentsQ);
                const receiptSeriesIds = enrollmentsSnap.docs.map(d => d.data().seriesId as string).filter(Boolean);

                const profileSeriesIds: string[] = (user as any).enrolledSeries || [];

                // Merge and Deduplicate
                const enrolledSeries: string[] = Array.from(new Set([...profileSeriesIds, ...receiptSeriesIds]));

                setUserEnrolledSeries(enrolledSeries);
                console.log('QuizBank: Enrolled Series (Merged):', enrolledSeries);

                // 2. Define Fetch Promises with Granular Error Handling
                const safeFetch = async (promise: Promise<any>, name: string) => {
                    console.log(`QuizBank: Fetching ${name}...`);
                    try {
                        const start = Date.now();
                        const result = await promise;
                        console.log(`QuizBank: Fetched ${name} in ${Date.now() - start}ms. Docs: ${result.docs?.length}`);
                        return result;
                    } catch (error: any) {
                        console.error(`QuizBank: Error fetching ${name}:`, error);
                        // Check for missing index error
                        if (error.code === 'failed-precondition' && error.message.includes('index')) {
                            console.error(`MISSING INDEX FOR ${name}. Create here:`, error.message);
                            // Extract the URL from the error message
                            // Format usually: "The query requires an index. You can create it here: https://console.firebase.google.com/..."
                            const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                            if (match) {
                                setMissingIndexUrl(match[0]);
                                addToast({
                                    type: 'error',
                                    message: `Missing Index detected for ${name}. See alert at top of page.`,
                                    duration: 10000
                                });
                            }
                        }
                        return { docs: [] };
                    }
                };

                // A. Fetch Series Names
                let fetchSeriesPromise;
                if (enrolledSeries.length > 0) {
                    if (enrolledSeries.length <= 10) {
                        fetchSeriesPromise = getDocs(query(collection(db, 'series'), where(documentId(), 'in', enrolledSeries)));
                    } else {
                        fetchSeriesPromise = getDocs(collection(db, 'series'));
                    }
                } else {
                    fetchSeriesPromise = Promise.resolve({ docs: [] });
                }
                const protectedSeriesFetch = safeFetch(fetchSeriesPromise, 'Series Data');

                // B. Fetch Attempts
                const protectedAttemptsFetch = safeFetch(
                    getDocs(collection(db, 'users', user.uid, 'quizAttempts')),
                    'User Attempts'
                );

                // C. Fetch Public Quizzes
                const protectedPublicFetch = safeFetch(
                    getDocs(query(
                        collection(db, 'quizzes'),
                        where('published', '==', true),
                        where('accessType', '==', 'public'),
                        orderBy('startDate', 'desc'),
                        limit(20)
                    )),
                    'Public Quizzes'
                );

                // D. Fetch Enrolled Quizzes
                const fetchEnrolledQuizzes = async () => {
                    if (enrolledSeries.length === 0) return { docs: [] };
                    const constraints: any[] = [
                        where('published', '==', true),
                        orderBy('startDate', 'desc'),
                        limit(40)
                    ];
                    const userCourse = (user as any).course;
                    if (userCourse) {
                        constraints.push(where('course.name', '==', userCourse));
                    }
                    if (enrolledSeries.length <= 10) {
                        constraints.push(where('series', 'array-contains-any', enrolledSeries));
                    }
                    return getDocs(query(collection(db, 'quizzes'), ...constraints));
                };
                const protectedEnrolledFetch = safeFetch(fetchEnrolledQuizzes(), 'Enrolled Quizzes');

                // EXECUTE PARALLEL WITH TIMEOUT
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timed out after 15s.')), 15000);
                });

                const [seriesSnap, attemptsSnap, publicSnap, enrolledSnap] = await Promise.race([
                    Promise.all([
                        protectedSeriesFetch,
                        protectedAttemptsFetch,
                        protectedPublicFetch,
                        protectedEnrolledFetch
                    ]),
                    timeoutPromise
                ]) as [any, any, any, any];

                console.log('QuizBank: All queries completed.');

                // --- Processing Logic ---

                // Process Series List
                const allSeries = seriesSnap.docs.map((d: any) => ({ id: d.id, name: d.data().name }));
                const visibleSeriesList = allSeries.filter((s: any) => enrolledSeries.includes(s.id));
                setSeriesList(visibleSeriesList);
                console.log('QuizBank: Visible Series List:', visibleSeriesList);

                // Process Attempts
                const counts: { [key: string]: number } = {};
                const attemptDocs: any[] = [];
                attemptsSnap.docs.forEach((doc: any) => {
                    const d = doc.data();
                    if (d.completed) {
                        counts[doc.id] = d.attemptNumber || 1;
                        attemptDocs.push({ quizId: doc.id, ...d });
                    }
                });
                setAttemptedQuizzes(counts);

                // Merge Quizzes
                const allDocs = [...publicSnap.docs, ...enrolledSnap.docs];
                const uniqueDocsMap = new Map();
                allDocs.forEach(d => {
                    uniqueDocsMap.set(d.id, { id: d.id, ...d.data() });
                });

                const data = Array.from(uniqueDocsMap.values()) as Quiz[];
                console.log('QuizBank: All Docs found (pre-filter):', data.length);

                // Client-Side Filter
                const finalQuizzes = data.filter(quiz => {
                    const accessType = (quiz.accessType as string || '').toLowerCase();
                    const isPublic = accessType === 'public';
                    if (isPublic) return true;
                    if (!quiz.series || quiz.series.length === 0) return false;
                    return quiz.series.some((s: string) => enrolledSeries.includes(s));
                });

                // Sort
                finalQuizzes.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
                console.log('QuizBank: Final Quizzes (post-filter):', finalQuizzes.length);
                setQuizzes(finalQuizzes);

                // Pagination cursor
                if (enrolledSnap.docs.length > 0) setLastVisible(enrolledSnap.docs[enrolledSnap.docs.length - 1]);
                else if (publicSnap.docs.length > 0) setLastVisible(publicSnap.docs[publicSnap.docs.length - 1]);
                else setLastVisible(null);

                setHasMore(finalQuizzes.length >= 20);

                // Calculate Stats
                const stats = visibleSeriesList.map((series: any) => {
                    const seriesQuizzes = finalQuizzes.filter(q => q.series?.includes(series.id));
                    const totalQuizzes = seriesQuizzes.length;
                    if (totalQuizzes === 0) return null;
                    let attemptedCount = 0;
                    let totalAccuracy = 0;
                    seriesQuizzes.forEach(q => {
                        const attempt = attemptDocs.find(a => a.quizId === q.id);
                        if (attempt) {
                            attemptedCount++;
                            const maxScore = attempt.total || 1;
                            const score = attempt.score || 0;
                            totalAccuracy += (score / maxScore) * 100;
                        }
                    });
                    const avgAccuracy = attemptedCount > 0 ? Math.round(totalAccuracy / attemptedCount) : 0;
                    const progress = Math.round((attemptedCount / totalQuizzes) * 100);
                    return {
                        id: series.id,
                        name: series.name,
                        totalQuizzes,
                        attemptedCount,
                        avgAccuracy,
                        progress
                    };
                }).filter(Boolean);
                setSeriesStats(stats);

            } catch (error: any) {
                console.error('CRITICAL Error fetching main data:', error);
                addToast({
                    type: 'error',
                    message: error.message || 'Failed to load data',
                });
            } finally {
                setLoading(false);
                setUiLoading('quizzes', false);
            }
        };

        fetchData();
    }, [user, userLoading, addToast, setUiLoading]);

    // Filter quizzes
    const filteredQuizzes = useMemo(() => {
        console.log('QuizBank: Applying filters:', filters);
        const res = quizzes.filter((quiz) => {
            const matchesSearch = !filters.search ||
                quiz.title?.toLowerCase().includes(filters.search.toLowerCase());

            const matchesAccessType = filters.accessType === 'all' ||
                quiz.accessType === filters.accessType;

            const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
            const matchesStatus = filters.status === 'all' || status === filters.status;

            const matchesSeries = filters.series === 'all' || (quiz.series && quiz.series.includes(filters.series));

            return matchesSearch && matchesAccessType && matchesStatus && matchesSeries;
        });
        console.log('QuizBank: Filtered result count:', res.length);
        return res;
    }, [quizzes, filters]);

    // Handle quiz click
    const handleQuizClick = (quiz: Quiz) => {
        console.log('QuizBank: Quiz clicked:', quiz.id, quiz.title);
        const userPlan = (user as any)?.plan;

        if (user?.admin) {
            router.push(`/quiz/start?id=${quiz.id}`);
            return;
        }

        // Check enrollment access (Skip for Public quizzes)
        const accessType = (quiz.accessType as string || '').toLowerCase();
        const isPublic = accessType === 'public';

        if (!isPublic && quiz.series && quiz.series.length > 0) {
            const hasAccess = userEnrolledSeries.length > 0 && quiz.series.some(s => userEnrolledSeries.includes(s));
            if (!hasAccess) {
                console.log('QuizBank: Access denied - Not enrolled in series');
                addToast({ type: 'error', message: 'You are not enrolled in the series for this quiz.' });
                return;
            }
        }

        if (userPlan === 'free' && quiz.accessType === 'paid') {
            setShowPremiumDialog(true);
            return;
        }
        router.push(`/quiz/start?id=${quiz.id}`);
    };

    // Load more (pagination)
    const handleLoadMore = async () => {
        if (!lastVisible || !user) return;
        setLoading(true);
        setUiLoading('quizzes', true);

        try {
            const constraints: any[] = [orderBy('startDate', 'desc'), limit(20)];

            // Student Filters
            constraints.push(where('published', '==', true));
            const userCourse = (user as any).course;
            if (userCourse) constraints.push(where('course.name', '==', userCourse));

            // Series Restriction
            if (userEnrolledSeries.length <= 10 && userEnrolledSeries.length > 0) {
                constraints.push(where('series', 'array-contains-any', userEnrolledSeries));
            }
            // If > 10, no server-side series filter, rely on client side

            constraints.push(startAfter(lastVisible));

            const q = query(collection(db, 'quizzes'), ...constraints);
            const snapshot = await getDocs(q);

            const newData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Quiz[];

            // Client Filter on Load More
            const finalData = newData.filter(quiz => {
                const accessType = (quiz.accessType as string || '').toLowerCase();
                const isPublic = accessType === 'public';
                if (isPublic) return true;

                if (!quiz.series || quiz.series.length === 0) return false;
                if (userEnrolledSeries.length === 0) return false;
                return quiz.series.some((s: string) => userEnrolledSeries.includes(s));
            });

            if (finalData.length) {
                setQuizzes((prev) => {
                    const combined = [...prev, ...finalData];
                    return combined;
                });
            }

            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length >= 20);
        } catch (error: any) {
            console.error('Error loading more quizzes:', error);
            // Check for missing index on pagination as well
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                if (match) {
                    setMissingIndexUrl(match[0]);
                    addToast({
                        type: 'error',
                        message: 'Missing Index on pagination query. Check top of page.',
                        duration: 5000
                    });
                }
            }
            addToast({ type: 'error', message: error.message || 'Failed to load more quizzes' });
        } finally {
            setLoading(false);
            setUiLoading('quizzes', false);
        }
    };

    // Show skeleton while user store is loading OR while fetching data
    if (userLoading || (loading && !quizzes.length)) {
        return (
            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Skeleton */}
                <div className="h-48 rounded-3xl bg-muted animate-pulse mb-8" />
                <TableSkeleton rows={8} columns={4} />
            </div>
        );
    }

    // If no user after loading finished, show message or redirect
    if (!user) {
        return (
            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center py-16">
                    <p className="text-xl font-semibold text-muted-foreground">Please log in to access the quiz bank.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background font-sans">
            <UnifiedHeader
                title="My Quiz Bank"
                subtitle={`${filteredQuizzes.length} quizzes available from your enrolled series`}
                icon={<Files className="w-6 h-6" />}
            />
            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* MISSING INDEX ALERT */}
                {missingIndexUrl && (
                    <div className="p-4 rounded-xl border border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-full bg-red-500/20">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-lg mb-1">Database Index Missing</h3>
                                <p className="text-sm mb-3">
                                    The system requires a new database index to load these quizzes efficiently.
                                    Please act as an administrator or ask your developer to click the link below.
                                </p>
                                <a
                                    href={missingIndexUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors font-medium text-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                    Create Required Index
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Series Analytics Section Removed as per request */}

                {/* Filters */}
                <Card className={`${glassmorphism.light} border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl`}>
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <Input
                                    placeholder="Search quizzes..."
                                    value={filters.search}
                                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                    className="pl-10 bg-background/50 border-[#004AAD]/20 focus:border-[#0066FF]"
                                />
                            </div>

                            <Select
                                value={filters.status}
                                onValueChange={(v) => setFilters({ ...filters, status: v })}
                            >
                                <SelectTrigger className="bg-background/50 border-[#004AAD]/20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="upcoming">Upcoming</SelectItem>
                                    <SelectItem value="ended">Ended</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select
                                value={filters.series}
                                onValueChange={(v) => setFilters({ ...filters, series: v })}
                            >
                                <SelectTrigger className="bg-background/50 border-[#004AAD]/20">
                                    <SelectValue placeholder="Filter by Series" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All My Series</SelectItem>
                                    {seriesList.length === 0 && (
                                        <SelectItem value="none" disabled>No Enrolled Series</SelectItem>
                                    )}
                                    {seriesList.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Quiz Grid */}
                {filteredQuizzes.length === 0 ? (
                    <div className="text-center py-16">
                        <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <p className="text-xl font-semibold text-muted-foreground">No quizzes found</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            {userEnrolledSeries.length === 0
                                ? "You are not enrolled in any series yet."
                                : missingIndexUrl
                                    ? "System configuration required."
                                    : "Try adjusting your filters"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredQuizzes.map((quiz) => {
                            const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
                            const attemptCount = attemptedQuizzes[quiz.id] || 0;
                            const canAttempt = attemptCount < (quiz.maxAttempts || 1);

                            return (
                                <div key={quiz.id} className="group relative">
                                    <div className="absolute inset-0 bg-gradient-to-br from-[#004AAD]/5 to-[#00B4D8]/5 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                    <Card className={`relative ${glassmorphism.light} border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-lg ${animations.smooth} group-hover:scale-[1.02]`}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between mb-2">
                                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'active'
                                                    ? 'bg-gradient-to-r from-[#00B4D8]/20 to-[#66D9EF]/20 text-[#00B4D8] dark:text-[#66D9EF]'
                                                    : status === 'upcoming'
                                                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                    }`}>
                                                    {status}
                                                </div>
                                                {quiz.accessType === 'paid' && (
                                                    <div className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-400">
                                                        Premium
                                                    </div>
                                                )}
                                            </div>

                                            <CardTitle className="text-xl font-black text-foreground line-clamp-2">
                                                {quiz.title}
                                            </CardTitle>
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {quiz.description}
                                            </p>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <BookOpen className="w-4 h-4" />
                                                    <span>{quiz.selectedQuestions?.length || 0} questions</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{quiz.duration} min</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>{quiz.startDate}</span>
                                                </div>
                                                {quiz.endDate && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Calendar className="w-4 h-4 text-red-400" />
                                                        <span>{quiz.endDate}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className={`${glassmorphism.medium} p-3 rounded-xl border border-[#004AAD]/10 space-y-2 text-sm`}>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Course:</span>
                                                    <span className="font-semibold text-foreground">{typeof quiz.course === 'object' ? quiz.course.name : quiz.course}</span>
                                                </div>
                                                {quiz.series && quiz.series.length > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Series:</span>
                                                        <span className="font-semibold text-foreground truncate max-w-[150px] text-right">
                                                            {seriesList.filter(s => quiz.series?.includes(s.id)).map(s => s.name).join(', ') || 'Linked'}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Attempts:</span>
                                                    <span className="font-semibold text-foreground">{attemptCount} / {quiz.maxAttempts || 1}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Button
                                                    className={`w-full ${status === 'active' && canAttempt
                                                        ? 'bg-gradient-to-r from-[#00B4D8] to-[#66D9EF] text-white'
                                                        : ''
                                                        }`}
                                                    disabled={status !== 'active' || !canAttempt}
                                                    onClick={() => handleQuizClick(quiz)}
                                                >
                                                    <Play className="w-4 h-4 mr-2" />
                                                    {attemptCount > 0 ? 'Retake Quiz' : 'Start Quiz'}
                                                    <ArrowRight className="w-4 h-4 ml-2" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Load more */}
                {hasMore && (
                    <div className="flex justify-center mt-8">
                        <Button onClick={handleLoadMore} disabled={loading} className="px-6 py-2">
                            {loading ? 'Loading...' : 'Load more quizzes'}
                        </Button>
                    </div>
                )}

                {/* Premium Dialog */}
                <Dialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog}>
                    <DialogContent className={`${glassmorphism.medium} border-[#004AAD]/20`}>
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] to-[#0066FF]">
                                Premium Required
                            </DialogTitle>
                            <DialogDescription>
                                This quiz requires a premium subscription. Upgrade now to access all premium content!
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowPremiumDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white"
                                onClick={() => router.push('/pricing')}
                            >
                                Upgrade Now
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
