import { Notification } from '@/stores/useNotificationStore';
import { cn } from '@/lib/utils';
import { Info, CheckCircle, AlertTriangle, XCircle, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '@/app/firebase';

interface NotificationItemProps {
    notification: Notification;
    onClose?: () => void;
}

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
    const router = useRouter();

    const getIcon = () => {
        switch (notification.type) {
            case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
            default: return <Info className="h-5 w-5 text-blue-500" />;
        }
    };

    const handleClick = async () => {
        // Mark as read if not already
        if (!notification.read) {
            const auth = getAuth(app);
            if (auth.currentUser) {
                const db = getFirestore(app);
                const ref = doc(db, 'users', auth.currentUser.uid, 'notifications', notification.id);
                await updateDoc(ref, { read: true });
            }
        }

        if (notification.link) {
            router.push(notification.link);
            if (onClose) onClose();
        }
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "flex gap-3 p-3 rounded-lg cursor-pointer transition-colors relative group",
                notification.read ? "bg-background hover:bg-accent" : "bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            )}
        >
            <div className="mt-1 flex-shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1 space-y-1">
                <p className={cn("text-sm font-medium leading-none", !notification.read && "font-semibold")}>
                    {notification.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                    {notification.createdAt ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                </p>
            </div>
            {!notification.read && (
                <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-blue-500" />
            )}
        </div>
    );
}
