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
function getQuizStatus(startDate: string, endDate: string, startTime?: string, endTime?: string) {
    const now = new Date();
    let start: Date;
    let end: Date;

    try {
        if (!startDate || !endDate) return 'ended';

        if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
            const [y, m, d] = startDate.split('-').map(Number);
            const [h, min] = startTime.split(':').map(Number);
            start = new Date(y, m - 1, d, h, min);
        } else {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
        }

        if (endTime && /^\d{2}:\d{2}$/.test(endTime)) {
            const [y, m, d] = endDate.split('-').map(Number);
            const [h, min] = endTime.split(':').map(Number);
            end = new Date(y, m - 1, d, h, min);
        } else {
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        }

        if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'ended';
        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'ended';
    } catch (error) {
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

    // Series Analytics State
    const [seriesStats, setSeriesStats] = useState<any[]>([]);

    // Fetch quizzes and user data
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            setUiLoading('quizzes', true);

            try {
                // 1. Fetch User's Enrolled Series
                let enrolledSeries: string[] = [];
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        enrolledSeries = userData.enrolledSeries || [];
                        setUserEnrolledSeries(enrolledSeries);
                    }
                } catch (e) {
                    console.error("Failed to fetch user enrolled series", e);
                }

                // REMOVED EARLY RETURN: We want to show Public quizzes even if no enrolled series.

                // 2. Parallel Fetch: Series Names, Attempts, Quizzes
                const promises = [
                    getDocs(collection(db, 'series')), // Fetch All Series Metadata
                    getDocs(collection(db, 'users', user.uid, 'quizAttempts')), // Fetch Attempts
                ];

                const [seriesSnap, attemptsSnap] = await Promise.all(promises);

                // Process Series List
                const allSeries = seriesSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
                const visibleSeriesList = allSeries.filter(s => enrolledSeries.includes(s.id));
                setSeriesList(visibleSeriesList);

                // Process Attempts
                const counts: { [key: string]: number } = {};
                const attemptDocs: any[] = [];
                attemptsSnap.docs.forEach(doc => {
                    const d = doc.data();
                    if (d.completed) {
                        counts[doc.id] = d.attemptNumber || 1;
                        attemptDocs.push({ quizId: doc.id, ...d });
                    }
                });
                setAttemptedQuizzes(counts);

                // 3. Fetch Quizzes (Composite Strategy: Public + Enrolled)
                // We need to fetch quizzes that are either Public OR in Enrolled Series.
                // Firestore doesn't accept logical OR across fields easily. We will split queries.

                const fetchPublicQuizzes = async () => {
                    const qPublic = query(
                        collection(db, 'quizzes'),
                        where('published', '==', true),
                        where('accessType', '==', 'public'), // Explicit fetch for public
                        orderBy('startDate', 'desc'),
                        limit(20)
                    );
                    const snap = await getDocs(qPublic);
                    console.log(`Fetched ${snap.docs.length} public quizzes`);
                    return snap;
                };

                const fetchEnrolledQuizzes = async () => {
                    if (enrolledSeries.length === 0) return { docs: [] };

                    const constraints: any[] = [
                        where('published', '==', true),
                        orderBy('startDate', 'desc'),
                        limit(40) // Give more weight to subscribed content
                    ];

                    const userCourse = (user as any).course;
                    if (userCourse) {
                        constraints.push(where('course.name', '==', userCourse));
                    }

                    if (enrolledSeries.length <= 10) {
                        constraints.push(where('series', 'array-contains-any', enrolledSeries));
                    }
                    // If > 10, we rely on course filter + client side filter later

                    return getDocs(query(collection(db, 'quizzes'), ...constraints));
                };

                const [publicSnap, enrolledSnap] = await Promise.all([
                    fetchPublicQuizzes(),
                    fetchEnrolledQuizzes()
                ]);

                // Merge and Deduplicate
                const allDocs = [...publicSnap.docs, ...enrolledSnap.docs];
                const uniqueDocsMap = new Map();
                allDocs.forEach(d => {
                    uniqueDocsMap.set(d.id, { id: d.id, ...d.data() });
                });

                const data = Array.from(uniqueDocsMap.values()) as Quiz[];

                // 4. Client-Side Filter
                // Allow if: Access is Public OR Series Match
                const finalQuizzes = data.filter(quiz => {
                    const isPublic = quiz.accessType === 'public' || quiz.accessType === 'Public';
                    if (isPublic) return true;

                    // For non-public, must match enrollment
                    if (!quiz.series || quiz.series.length === 0) return false;
                    return quiz.series.some((s: string) => enrolledSeries.includes(s));
                });

                // Sort merged results by date
                finalQuizzes.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

                setQuizzes(finalQuizzes);

                // Set last visible for pagination (using the last from the larger set, imperfect for merged pagination but acceptable for lazy load)
                if (enrolledSnap.docs.length > 0) setLastVisible(enrolledSnap.docs[enrolledSnap.docs.length - 1]);
                else if (publicSnap.docs.length > 0) setLastVisible(publicSnap.docs[publicSnap.docs.length - 1]);
                else setLastVisible(null);

                setHasMore(finalQuizzes.length >= 20);

                // 5. Calculate Series Analytics (Client Side - Approximation based on fetched data)
                const stats = visibleSeriesList.map(series => {
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
                console.error('Error fetching data:', error);
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
    }, [user, addToast, setUiLoading]);

    // Filter quizzes
    const filteredQuizzes = useMemo(() => {
        return quizzes.filter((quiz) => {
            const matchesSearch = !filters.search ||
                quiz.title?.toLowerCase().includes(filters.search.toLowerCase());

            const matchesAccessType = filters.accessType === 'all' ||
                quiz.accessType === filters.accessType;

            const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
            const matchesStatus = filters.status === 'all' || status === filters.status;

            const matchesSeries = filters.series === 'all' || (quiz.series && quiz.series.includes(filters.series));

            return matchesSearch && matchesAccessType && matchesStatus && matchesSeries;
        });
    }, [quizzes, filters]);

    // Handle quiz click
    const handleQuizClick = (quiz: Quiz) => {
        const userPlan = (user as any)?.plan;

        if (user?.admin) {
            router.push(`/quiz/start?id=${quiz.id}`);
            return;
        }

        // Check enrollment access (Skip for Public quizzes)
        const isPublic = quiz.accessType === 'public' || quiz.accessType === 'Public';

        if (!isPublic && quiz.series && quiz.series.length > 0) {
            const hasAccess = userEnrolledSeries.length > 0 && quiz.series.some(s => userEnrolledSeries.includes(s));
            if (!hasAccess) {
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
                const isPublic = quiz.accessType === 'public' || quiz.accessType === 'Public';
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
            addToast({ type: 'error', message: error.message || 'Failed to load more quizzes' });
        } finally {
            setLoading(false);
            setUiLoading('quizzes', false);
        }
    };

    // Show skeleton while loading
    if (loading || !user) {
        return (
            <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header Skeleton */}
                <div className="h-48 rounded-3xl bg-muted animate-pulse mb-8" />
                <TableSkeleton rows={8} columns={4} />
            </div>
        );
    }

    return (
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <UnifiedHeader
                title="My Quiz Bank"
                subtitle={`${filteredQuizzes.length} quizzes available from your enrolled series`}
                icon={<Files className="w-6 h-6" />}
            />

            {/* Series Analytics Section */}
            {seriesStats.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {seriesStats.map((stat, i) => (
                        <Card key={i} className={`${glassmorphism.light} border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-md`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-bold truncate" title={stat.name}>{stat.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Recent Progress</p>
                                            <p className="text-2xl font-bold text-[#004AAD] dark:text-[#00B4D8]">{stat.attemptedCount}/{stat.totalQuizzes}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-muted-foreground">Accuracy</p>
                                            <p className={`text-xl font-bold ${stat.avgAccuracy >= 80 ? 'text-green-500' : stat.avgAccuracy >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                                {stat.avgAccuracy}%
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-secondary/50 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-gradient-to-r from-[#004AAD] to-[#00B4D8] h-full transition-all duration-1000"
                                            style={{ width: `${stat.progress}%` }}
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => setFilters({ ...filters, series: stat.id })}
                                    >
                                        View Quizzes <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

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
    );
}
