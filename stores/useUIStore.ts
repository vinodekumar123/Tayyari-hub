import { create } from 'zustand';

interface UIStore {
    // Sidebar state
    sidebarOpen: boolean;
    sidebarCollapsed: boolean;

    // Modal state
    activeModal: string | null;
    modalData: any;

    // Toast/notification state
    toasts: Array<{
        id: string;
        type: 'success' | 'error' | 'info' | 'warning';
        message: string;
        duration?: number;
    }>;

    // Loading states
    loadingStates: Record<string, boolean>;

    // Search state
    searchQuery: string;
    searchOpen: boolean;

    // Actions
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    setSidebarCollapsed: (collapsed: boolean) => void;

    openModal: (modalId: string, data?: any) => void;
    closeModal: () => void;

    addToast: (toast: Omit<UIStore['toasts'][0], 'id'>) => void;
    removeToast: (id: string) => void;

    setLoading: (key: string, loading: boolean) => void;
    isLoading: (key: string) => boolean;

    setSearchQuery: (query: string) => void;
    setSearchOpen: (open: boolean) => void;

    // UI Configuration
    sidebarTriggerHidden: boolean;
    setSidebarTriggerHidden: (hidden: boolean) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
    // Initial state
    sidebarOpen: false, // Default closed (mobile)
    sidebarCollapsed: false,
    activeModal: null,
    modalData: null,
    toasts: [],
    loadingStates: {},
    searchQuery: '',
    searchOpen: false,

    // Sidebar actions
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    // Modal actions
    openModal: (modalId, data) => set({ activeModal: modalId, modalData: data }),
    closeModal: () => set({ activeModal: null, modalData: null }),

    // Toast actions
    addToast: (toast) => {
        const id = Math.random().toString(36).substr(2, 9);
        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }]
        }));

        // Auto-remove after duration
        setTimeout(() => {
            get().removeToast(id);
        }, toast.duration || 3000);
    },

    removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    })),

    // Loading actions
    setLoading: (key, loading) => set((state) => ({
        loadingStates: { ...state.loadingStates, [key]: loading }
    })),

    isLoading: (key) => get().loadingStates[key] || false,

    // Search actions
    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchOpen: (open) => set({ searchOpen: open }),

    // UI Configuration
    sidebarTriggerHidden: false,
    setSidebarTriggerHidden: (hidden) => set({ sidebarTriggerHidden: hidden }),
}));
