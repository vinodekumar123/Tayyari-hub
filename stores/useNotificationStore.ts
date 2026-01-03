import { create } from 'zustand';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    read: boolean;
    createdAt: any; // Firestore Timestamp
    link?: string;
}

interface NotificationState {
    unreadCount: number;
    setUnreadCount: (count: number) => void;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    unreadCount: 0,
    setUnreadCount: (count) => set({ unreadCount: count }),
    isOpen: false,
    setIsOpen: (open) => set({ isOpen: open }),
}));
