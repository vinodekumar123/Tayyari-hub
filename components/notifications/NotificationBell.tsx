'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { NotificationItem } from './NotificationItem';
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, query, where } from 'firebase/firestore';
import { app } from '@/app/firebase';

export function NotificationBell() {
    const { notifications, loading } = useNotifications();
    const { unreadCount } = useNotificationStore();
    const [open, setOpen] = useState(false);

    const handleMarkAllAsRead = async () => {
        const auth = getAuth(app);
        if (!auth.currentUser) return;

        const db = getFirestore(app);
        const batch = writeBatch(db);

        const unreadQuery = query(
            collection(db, 'users', auth.currentUser.uid, 'notifications'),
            where('read', '==', false)
        );

        const snapshot = await getDocs(unreadQuery);
        snapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        await batch.commit();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-accent hover:text-accent-foreground">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-background animate-pulse" />
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h4 className="font-semibold text-sm">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            className="h-auto px-2 py-0.5 text-xs text-blue-500 hover:text-blue-600 hover:bg-transparent"
                            onClick={handleMarkAllAsRead}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            <p className="text-xs text-muted-foreground">Loading...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 space-y-2 text-center p-4">
                            <Bell className="h-8 w-8 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="flex flex-col p-2 space-y-1">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onClose={() => setOpen(false)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
