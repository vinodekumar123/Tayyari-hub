import { useEffect, useState, useRef } from 'react';
import { getFirestore, collection, query, orderBy, onSnapshot, where, Timestamp, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '@/app/firebase';
import { useNotificationStore, Notification } from '@/stores/useNotificationStore';
import { toast } from 'sonner';

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const { setUnreadCount } = useNotificationStore();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        const auth = getAuth(app);
        const db = getFirestore(app);

        // We need a user to fetch notifications
        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (!user) {
                setNotifications([]);
                setUnreadCount(0);
                setLoading(false);
                return;
            }

            const notificationsRef = collection(db, 'users', user.uid, 'notifications');
            // Query: Order by creation time descending, limit to recent 50
            const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

            const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                const notifs: Notification[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Notification));

                setNotifications(notifs);

                // Calculate unread count
                const unread = notifs.filter(n => !n.read).length;
                setUnreadCount(unread);

                // Trigger toast for new notifications (skip initial load)
                if (!isFirstLoad.current) {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const data = change.doc.data();
                            toast(data.title || 'New Notification', {
                                description: data.message,
                                action: data.link ? {
                                    label: 'View',
                                    onClick: () => window.location.href = data.link as string
                                } : undefined,
                            });
                        }
                    });
                }
                isFirstLoad.current = false;

                setLoading(false);
            }, (error) => {
                console.error("Error fetching notifications:", error);
                setLoading(false);
            });

            return () => unsubscribeSnapshot();
        });

        return () => unsubscribeAuth();
    }, [setUnreadCount]);

    return { notifications, loading };
}
