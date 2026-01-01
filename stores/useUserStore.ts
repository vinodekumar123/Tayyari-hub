import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// User type definition
interface User {
    uid: string;
    email: string | null;
    fullName: string;
    phone?: string;
    admin?: boolean | string;
    superadmin?: boolean; // Added superadmin field
    role?: 'admin' | 'student';
    photoURL?: string | null;
    stats?: {
        totalQuizzes: number;
        totalQuestions: number;
        totalCorrect: number;
        overallAccuracy: number;
        [key: string]: any;
    };
}

interface UserStore {
    // State
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    setUser: (user: User | null) => void;
    updateUser: (updates: Partial<User>) => void;
    clearUser: () => void;
    setLoading: (loading: boolean) => void;

    // Computed
    isAdmin: () => boolean;
    isSuperAdmin: () => boolean; // Added computed property
    isStudent: () => boolean;
}

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            // Initial state
            user: null,
            isLoading: true,
            isAuthenticated: false,

            // Actions
            setUser: (user) => set({
                user,
                isAuthenticated: !!user,
                isLoading: false
            }),

            updateUser: (updates) => set((state) => ({
                user: state.user ? { ...state.user, ...updates } : null
            })),

            clearUser: () => set({
                user: null,
                isAuthenticated: false,
                isLoading: false
            }),

            setLoading: (loading) => set({ isLoading: loading }),

            // Computed properties
            isAdmin: () => {
                const { user } = get();
                if (!user) return false;
                return user.admin === true || user.admin === 'true' || user.role === 'admin';
            },

            isStudent: () => {
                const { user } = get();
                if (!user) return false;
                return user.role === 'student' || (!user.admin && !user.role);
            },

            isSuperAdmin: () => {
                const { user } = get();
                if (!user) return false;
                return user.superadmin === true; // Strict check for superadmin
            },
        }),
        {
            name: 'user-storage', // localStorage key
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated
            }),
        }
    )
);
