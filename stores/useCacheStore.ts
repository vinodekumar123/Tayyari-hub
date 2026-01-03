import { create } from 'zustand';

// Cache entry type
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresIn: number; // milliseconds
}

interface CacheStore {
    // Cache storage
    cache: Record<string, CacheEntry<any>>;

    // Actions
    set: <T>(key: string, data: T, expiresIn?: number) => void;
    get: <T>(key: string) => T | null;
    has: (key: string) => boolean;
    invalidate: (key: string) => void;
    invalidateAll: () => void;
    invalidatePattern: (pattern: string) => void;

    // Specific data caches
    students: any[] | null;
    quizzes: any[] | null;
    courses: any[] | null;

    setStudents: (students: any[]) => void;
    setQuizzes: (quizzes: any[]) => void;
    setCourses: (courses: any[]) => void;
}

export const useCacheStore = create<CacheStore>((set, get) => ({
    // Initial state
    cache: {},
    students: null,
    quizzes: null,
    courses: null,

    // Generic cache methods
    set: (key, data, expiresIn = 5 * 60 * 1000) => { // Default 5 minutes
        set((state) => ({
            cache: {
                ...state.cache,
                [key]: {
                    data,
                    timestamp: Date.now(),
                    expiresIn,
                },
            },
        }));
    },

    get: (key) => {
        const entry = get().cache[key];

        if (!entry) return null;

        // Check if expired
        const isExpired = Date.now() - entry.timestamp > entry.expiresIn;

        if (isExpired) {
            get().invalidate(key);
            return null;
        }

        return entry.data;
    },

    has: (key) => {
        const entry = get().cache[key];
        if (!entry) return false;

        const isExpired = Date.now() - entry.timestamp > entry.expiresIn;
        return !isExpired;
    },

    invalidate: (key) => {
        set((state) => {
            const newCache = { ...state.cache };
            delete newCache[key];
            return { cache: newCache };
        });
    },

    invalidateAll: () => {
        set({ cache: {}, students: null, quizzes: null, courses: null });
    },

    invalidatePattern: (pattern) => {
        set((state) => {
            const newCache = { ...state.cache };
            Object.keys(newCache).forEach((key) => {
                if (key.includes(pattern)) {
                    delete newCache[key];
                }
            });
            return { cache: newCache };
        });
    },

    // Specific data cache methods
    setStudents: (students) => {
        set({ students });
        get().set('students', students, 10 * 60 * 1000); // 10 minutes
    },

    setQuizzes: (quizzes) => {
        set({ quizzes });
        get().set('quizzes', quizzes, 10 * 60 * 1000);
    },

    setCourses: (courses) => {
        set({ courses });
        get().set('courses', courses, 10 * 60 * 1000);
    },
}));

// Helper hook to use cache with automatic invalidation
export function useCachedData<T>(
    key: string,
    fetchFn: () => Promise<T>,
    expiresIn?: number
) {
    const cache = useCacheStore();

    const getData = async (): Promise<T> => {
        // Check cache first
        const cached = cache.get<T>(key);
        if (cached) return cached;

        // Fetch fresh data
        const data = await fetchFn();
        cache.set(key, data, expiresIn);
        return data;
    };

    return {
        getData,
        invalidate: () => cache.invalidate(key),
        hasCache: () => cache.has(key),
    };
}
