'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { useUserStore } from '@/stores/useUserStore';
import { useCacheStore } from '@/stores/useCacheStore';
import { Quiz } from '@/types/index';
import { toast } from 'sonner';

interface UseQuizBankReturn {
    quizzes: Quiz[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    userEnrolledSeries: string[];
    seriesList: { id: string; name: string }[];
    attemptedQuizzes: Record<string, number>;
    loadMore: () => void;
    filters: {
        search: string;
        status: string;
        series: string;
    };
    setFilters: React.Dispatch<React.SetStateAction<{
        search: string;
        status: string;
        series: string;
    }>>;
    missingIndexUrl: string | null;
}

export function useQuizBank(): UseQuizBankReturn {
    const { user, isLoading: userLoading } = useUserStore();
    const cache = useCacheStore(); // We'll use this later for series caching if needed

    // State
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [userEnrolledSeries, setUserEnrolledSeries] = useState<string[]>([]);
    const [seriesList, setSeriesList] = useState<{ id: string; name: string }[]>([]);
    const [attemptedQuizzes, setAttemptedQuizzes] = useState<Record<string, number>>({});
    const [missingIndexUrl, setMissingIndexUrl] = useState<string | null>(null);

    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        series: 'all',
    });

    // 1. Fetch User Enrollments & Series (Initial Load)
    useEffect(() => {
        if (userLoading || !user) return;

        const init = async () => {
            setLoading(true);
            try {
                // Fetch enrollments (True source of truth)
                const enrollmentsQ = query(collection(db, 'enrollments'), where('studentId', '==', user.uid), where('status', '==', 'active'));
                const enrollmentsSnap = await getDocs(enrollmentsQ);
                const receiptSeriesIds = enrollmentsSnap.docs.map(d => d.data().seriesId as string).filter(Boolean);
                const profileSeriesIds: string[] = (user as any).enrolledSeries || [];
                const distinctSeriesIds = Array.from(new Set([...profileSeriesIds, ...receiptSeriesIds]));

                setUserEnrolledSeries(distinctSeriesIds);

                // Fetch Series Names (Optimized: Only needed if there are IDs)
                if (distinctSeriesIds.length > 0) {
                    // Check cache first? For now, raw fetch to be safe, can optimize later.
                    // Batch fetch if <= 10, else fetch all (or pagination - keep simple for now)
                    // Reusing logic from original page but simplified
                    let seriesDocs: any[] = [];
                    if (distinctSeriesIds.length <= 10) {
                        const qSeries = query(collection(db, 'series'), where('__name__', 'in', distinctSeriesIds));
                        const snap = await getDocs(qSeries);
                        seriesDocs = snap.docs;
                    } else {
                        // Fallback: fetch all active series (not ideal but safe for now)
                        const snap = await getDocs(collection(db, 'series'));
                        seriesDocs = snap.docs.filter(d => distinctSeriesIds.includes(d.id));
                    }
                    setSeriesList(seriesDocs.map(d => ({ id: d.id, name: d.data().name })));
                }

                // Initial Quiz Fetch
                await fetchQuizzes(true, distinctSeriesIds);

                // Lazy load attempts in background
                fetchAttemptsInBg();

            } catch (error) {
                console.error("Error initializing Quiz Bank:", error);
                toast.error("Failed to load quiz data");
            } finally {
                setLoading(false);
            }
        };

        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, userLoading]);

    // 2. Fetch Quizzes Logic
    const fetchQuizzes = async (isInitial: boolean, enrolledIds: string[]) => {
        try {
            if (!isInitial) setLoadingMore(true);
            setMissingIndexUrl(null);

            // Unified Query Strategy:
            // Fetch ALL public quizzes OR quizzes in enrolled series.
            // Firestore OR limitations mean we might do two queries or just one broad one and filter.
            // "Public" quizzes might not have 'series' set. 
            // Most reliable pagination: Query 'quizzes' ordered by startDate.
            // Then client-filter visibility. This is "network waste" but guarantees consistent pagination.
            // Optimization: If user is enrolled in specific series, we can try `where('series', 'array-contains-any', ids)`.
            // But that excludes Public quizzes not in series.

            // Strategy: Fetch mostly recent quizzes and filter.
            const constraints: any[] = [
                where('published', '==', true),
                orderBy('startDate', 'desc'),
                limit(20)
            ];

            const userCourse = (user as any)?.course;
            if (userCourse) {
                constraints.push(where('course.name', '==', userCourse));
            }

            if (!isInitial && lastDoc) {
                constraints.push(startAfter(lastDoc));
            }

            const q = query(collection(db, 'quizzes'), ...constraints);
            const snap = await getDocs(q);

            // Filter Visibility
            const validQuizzes: Quiz[] = [];
            snap.docs.forEach(d => {
                const data = d.data() as Quiz;
                const qAccess = (data.accessType || '').toLowerCase();
                const qSeries = data.series || [];

                // Visible if: Public OR (Series match AND user enrolled)
                // Also check Course Match logic from original (implied by query)
                const isPublic = qAccess === 'public';
                const hasSeriesAccess = qSeries.some((s: string) => enrolledIds.includes(s));

                if (isPublic || hasSeriesAccess) {
                    validQuizzes.push({ id: d.id, ...data, seriesName: undefined }); // seriesName populated later if needed
                }
            });

            if (isInitial) {
                setQuizzes(validQuizzes);
            } else {
                setQuizzes(prev => [...prev, ...validQuizzes]);
            }

            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(snap.docs.length === 20);

        } catch (error: any) {
            console.error("Fetch Quizzes Error:", error);
            if (error.code === 'failed-precondition' && error.message.includes('index')) {
                const match = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/);
                if (match) setMissingIndexUrl(match[0]);
            }
        } finally {
            if (!isInitial) setLoadingMore(false);
        }
    };

    // 3. Lazy Load Attempts
    const fetchAttemptsInBg = async () => {
        if (!user) return;
        try {
            // Speed Optimization: Only fetch attempts for the quizzes we actually loaded?
            // Or just fetch all. Fetching all is safer for "global" knowledge but slow.
            // Let's stick to "all" for now but unblocked.
            const attemptsRef = collection(db, 'users', user.uid, 'quizAttempts');
            const snap = await getDocs(attemptsRef);
            const counts: Record<string, number> = {};
            snap.docs.forEach(d => {
                // Assuming doc ID is quiz ID or using a field. Original code used doc.id = quizId in structure?
                // Original used: counts[doc.id] = d.attemptNumber
                // Checking previous code: collection(db, 'users', user.uid, 'quizAttempts'). doc.id is usually attempt ID or quiz ID?
                // In many implementations it's quizId if one attempt, but here 'quizAttempts' usually implies 1 doc per quiz tracking attempts?
                // Let's assume doc.id is quizId for the counters based on original code `counts[doc.id]`.
                if (d.data().completed) {
                    counts[d.id] = d.data().attemptNumber || 1;
                }
            });
            setAttemptedQuizzes(counts);
        } catch (e) {
            console.error("Background attempts fetch failed", e);
        }
    };

    const loadMore = () => {
        if (!loadingMore && hasMore) {
            fetchQuizzes(false, userEnrolledSeries);
        }
    };

    return {
        quizzes,
        loading,
        loadingMore,
        hasMore,
        userEnrolledSeries,
        seriesList,
        attemptedQuizzes,
        loadMore,
        filters,
        setFilters,
        missingIndexUrl
    };
}
