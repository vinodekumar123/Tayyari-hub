'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db } from '@/app/firebase';
import {
    doc, getDoc, collection, query, limit,
    getDocs, orderBy, where, getCountFromServer
} from 'firebase/firestore';
import { useUserStore } from '@/stores/useUserStore';
import {
    useStudentDashboardStore,
    isCacheFresh,
    DashboardQuiz
} from '@/stores/useStudentDashboardStore';
import { toast } from 'react-hot-toast';

const QUESTION_COUNT_CACHE_KEY = 'tayyari_mock_q_count';
const QUESTION_COUNT_TTL = 60 * 60 * 1000; // 1 hour

function getCachedQuestionCount(): number | null {
    try {
        const raw = localStorage.getItem(QUESTION_COUNT_CACHE_KEY);
        if (!raw) return null;
        const { count, ts } = JSON.parse(raw);
        if (Date.now() - ts < QUESTION_COUNT_TTL) return count;
    } catch { /* ignore */ }
    return null;
}

function setCachedQuestionCount(count: number) {
    try {
        localStorage.setItem(
            QUESTION_COUNT_CACHE_KEY,
            JSON.stringify({ count, ts: Date.now() })
        );
    } catch { /* ignore */ }
}

// Safe timestamp helper
const getTime = (t: any) =>
    t?.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : 0;

export function useStudentDashboard() {
    const { user } = useUserStore();
    const uid = user?.uid ?? null;

    const store = useStudentDashboardStore();
    const [loading, setLoading] = useState(!store.lastFetchedAt);
    const fetchedRef = useRef(false);

    const fetchData = useCallback(async (userId: string, isBackground = false) => {
        if (!isBackground) setLoading(true);

        try {
            // --- Check if we can skip the expensive question count ---
            const cachedCount = getCachedQuestionCount();

            // All independent queries fire in parallel
            const promises: Promise<any>[] = [
                getDoc(doc(db, 'users', userId)),
                getDocs(query(
                    collection(db, 'users', userId, 'quizAttempts'),
                    orderBy('submittedAt', 'desc'), limit(10)
                )),
                getDocs(query(
                    collection(db, 'users', userId, 'user-quizattempts'),
                    orderBy('submittedAt', 'desc'), limit(10)
                )),
                getDocs(query(
                    collection(db, 'users', userId, 'quizAttempts'),
                    where('completed', '==', false), limit(5)
                )),
                getDocs(query(
                    collection(db, 'users', userId, 'user-quizattempts'),
                    where('completed', '==', false), limit(5)
                )),
            ];

            // Only query server count if cache is stale
            if (cachedCount === null) {
                promises.push(
                    getCountFromServer(collection(db, 'mock-questions')).catch(() => null)
                );
            }

            const results = await Promise.all(promises);

            const [userDoc, recentSnap, userRecentSnap, unfinishedSnap, unfinishedUserSnap] = results;
            const totalSnap = cachedCount === null ? results[5] : null;

            const data = userDoc.exists() ? userDoc.data() : null;

            // Process attempts — use existing title/name, no secondary fetch
            const processAttempts = (snap: any, quizType: 'admin' | 'user'): DashboardQuiz[] =>
                snap.docs.map((d: any) => {
                    const raw = d.data();
                    return {
                        id: d.id,
                        ...raw,
                        quizType,
                        title: raw.title || raw.name || raw.quizTitle || (quizType === 'user' ? 'Custom Quiz' : 'Quiz'),
                    };
                });

            const officialAttempts = processAttempts(recentSnap, 'admin');
            const userAttempts = processAttempts(userRecentSnap, 'user');
            const unfinishedOfficial = processAttempts(unfinishedSnap, 'admin');
            const unfinishedUser = processAttempts(unfinishedUserSnap, 'user');

            // Merge & sort recent
            const allRecent = [...officialAttempts, ...userAttempts]
                .sort((a, b) => getTime(b.submittedAt) - getTime(a.submittedAt))
                .slice(0, 10);

            const allUnfinished = [...unfinishedOfficial, ...unfinishedUser];

            // Question bank stats
            let totalQuestions: number;
            if (cachedCount !== null) {
                totalQuestions = cachedCount;
            } else {
                totalQuestions = totalSnap ? totalSnap.data().count : 0;
                if (totalQuestions > 0) setCachedQuestionCount(totalQuestions);
            }
            const usedCount = data?.usedMockQuestionIds?.length || 0;

            store.setDashboardData({
                studentData: data,
                recentQuizzes: allRecent,
                unfinishedQuizzes: allUnfinished,
                questionStats: { total: totalQuestions, used: usedCount },
            });
        } catch (err) {
            console.error('Dashboard fetch error:', err);
            if (!isBackground) toast.error('Error loading dashboard');
        } finally {
            setLoading(false);
        }
    }, [store]);

    // Stale-while-revalidate: show cache, then refresh
    useEffect(() => {
        if (!uid || fetchedRef.current) return;
        fetchedRef.current = true;

        const hasCachedData = store.lastFetchedAt !== null;
        const cacheIsFresh = isCacheFresh(store.lastFetchedAt);

        if (hasCachedData) {
            // Instantly show cached data
            setLoading(false);

            if (!cacheIsFresh) {
                // Background refresh
                fetchData(uid, true);
            }
        } else {
            // First load — show skeleton, fetch foreground
            fetchData(uid, false);
        }
    }, [uid, fetchData, store.lastFetchedAt]);

    // Refresh function (no page reload!)
    const refresh = useCallback(() => {
        if (!uid) return;
        fetchedRef.current = false;
        store.markStale();
        fetchData(uid, false);
    }, [uid, fetchData, store]);

    // Derived / computed data
    const stats = useMemo(() => ({
        ...store.studentData?.stats,
        totalQuizzes: store.studentData?.stats?.totalQuizzes || 0,
        totalQuestions: store.studentData?.stats?.totalQuestions || 0,
        overallAccuracy: store.studentData?.stats?.overallAccuracy || 0,
    }), [store.studentData]);

    const performanceTrendData = useMemo(() => {
        return [...store.recentQuizzes]
            .reverse()
            .map((q, i) => {
                const rawScore = q.total > 0 ? (q.score / q.total) * 100 : 0;
                const score = isNaN(rawScore) ? 0 : parseFloat(rawScore.toFixed(1));
                return {
                    name: `Q${i + 1}`,
                    score,
                    title: q.title || 'Untitled',
                    type: q.quizType === 'user' ? 'Custom' : 'Official',
                };
            });
    }, [store.recentQuizzes]);

    const subjectBreakdownAdmin = useMemo(() => {
        const sStats = store.studentData?.stats?.subjectStats || {};
        return Object.entries(sStats)
            .filter(([subject]) => subject !== 'Uncategorized' && subject !== 'General')
            .map(([subject, data]: [string, any]) => ({
                subject,
                accuracy: data.accuracy || 0,
                attempted: data.attempted || 0,
                correct: data.correct || 0,
                wrong: (data.attempted || 0) - (data.correct || 0),
            }))
            .sort((a, b) => b.attempted - a.attempted);
    }, [store.studentData]);

    const subjectBreakdownUser = useMemo(() => {
        const sStats = store.studentData?.stats?.userSubjectStats || {};
        return Object.entries(sStats)
            .filter(([subject]) => subject !== 'Uncategorized' && subject !== 'General')
            .map(([subject, data]: [string, any]) => ({
                subject,
                accuracy: data.accuracy || 0,
                attempted: data.attempted || 0,
                correct: data.correct || 0,
                wrong: (data.attempted || 0) - (data.correct || 0),
            }))
            .sort((a, b) => b.attempted - a.attempted);
    }, [store.studentData]);

    return {
        loading,
        studentData: store.studentData,
        recentQuizzes: store.recentQuizzes,
        unfinishedQuizzes: store.unfinishedQuizzes,
        questionStats: store.questionStats,
        stats,
        performanceTrendData,
        subjectBreakdownAdmin,
        subjectBreakdownUser,
        refresh,
    };
}
