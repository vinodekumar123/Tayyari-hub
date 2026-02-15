import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface DashboardQuiz {
    id: string;
    title: string;
    score: number;
    total: number;
    quizType: 'admin' | 'user';
    completed?: boolean;
    submittedAt?: any;
    [key: string]: any;
}

export interface DashboardState {
    // Data
    studentData: any | null;
    recentQuizzes: DashboardQuiz[];
    unfinishedQuizzes: DashboardQuiz[];
    questionStats: { total: number; used: number };

    // Meta
    lastFetchedAt: number | null;
    isFresh: boolean;

    // Actions
    setDashboardData: (data: {
        studentData: any;
        recentQuizzes: DashboardQuiz[];
        unfinishedQuizzes: DashboardQuiz[];
        questionStats: { total: number; used: number };
    }) => void;
    markStale: () => void;
    clear: () => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useStudentDashboardStore = create<DashboardState>()(
    persist(
        (set, get) => ({
            studentData: null,
            recentQuizzes: [],
            unfinishedQuizzes: [],
            questionStats: { total: 0, used: 0 },
            lastFetchedAt: null,
            isFresh: false,

            setDashboardData: (data) =>
                set({
                    ...data,
                    lastFetchedAt: Date.now(),
                    isFresh: true,
                }),

            markStale: () => set({ isFresh: false }),

            clear: () =>
                set({
                    studentData: null,
                    recentQuizzes: [],
                    unfinishedQuizzes: [],
                    questionStats: { total: 0, used: 0 },
                    lastFetchedAt: null,
                    isFresh: false,
                }),
        }),
        {
            name: 'student-dashboard-cache',
            storage: createJSONStorage(() => {
                // SSR safety: return a noop storage during SSR
                if (typeof window === 'undefined') {
                    return {
                        getItem: () => null,
                        setItem: () => { },
                        removeItem: () => { },
                    };
                }
                return sessionStorage;
            }),
            partialize: (state) => ({
                studentData: state.studentData,
                recentQuizzes: state.recentQuizzes,
                unfinishedQuizzes: state.unfinishedQuizzes,
                questionStats: state.questionStats,
                lastFetchedAt: state.lastFetchedAt,
            }),
        }
    )
);

/** Check if cached data is still fresh */
export function isCacheFresh(lastFetchedAt: number | null): boolean {
    if (!lastFetchedAt) return false;
    return Date.now() - lastFetchedAt < CACHE_TTL;
}
