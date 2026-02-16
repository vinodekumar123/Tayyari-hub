'use client';

import { useEffect, useRef, useState } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { app } from '@/app/firebase';
import { useUserStore } from '@/stores/useUserStore';
import { ensureSessionActive, subscribeToSession, updateSessionHeartbeat, logoutUserSession, isLoginInProgress } from '@/lib/sessionUtils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export function GlobalSessionManager() {
    const { user } = useUserStore();
    const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);

    // Refs for cleanup
    const unsubscribeSessionRef = useRef<(() => void) | null>(null);
    const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const revocationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const loginTimeRef = useRef<number>(0);

    // Track user login time for grace period
    useEffect(() => {
        if (user) {
            loginTimeRef.current = Date.now();
        }
    }, [user?.uid]); // Reset on user change

    useEffect(() => {
        if (!user) {
            // Cleanup on logout
            if (unsubscribeSessionRef.current) {
                unsubscribeSessionRef.current();
                unsubscribeSessionRef.current = null;
            }
            if (heartbeatIntervalRef.current) {
                clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = null;
            }
            if (revocationCheckIntervalRef.current) {
                clearInterval(revocationCheckIntervalRef.current);
                revocationCheckIntervalRef.current = null;
            }
            return;
        }

        // 1. Auto-ensure session is active (Initial Check)
        ensureSessionActive(user).catch((err) => {
            if (err.message && (err.message.includes("revoked") || err.message.includes("blocked"))) {
                setSessionExpiredOpen(true);
            }
        });

        // 2. Real-time Session Status Listener
        const unsub = subscribeToSession(user, (status) => {
            if (status === 'revoked') {
                setSessionExpiredOpen(true);
            }
        });
        unsubscribeSessionRef.current = unsub;

        // 3. Heartbeat: Update session active timestamp every 5 minutes
        const hbInterval = setInterval(() => {
            updateSessionHeartbeat(user);
        }, 5 * 60 * 1000);
        heartbeatIntervalRef.current = hbInterval;

        // 4. Faster revocation check every 30 seconds
        const revocationInterval = setInterval(() => {
            // Grace period: skip check within 30 seconds of login OR if login is in progress
            if (Date.now() - loginTimeRef.current < 30000 || isLoginInProgress()) {
                return;
            }

            ensureSessionActive(user).catch((err) => {
                if (err.message && (err.message.includes("revoked") || err.message.includes("blocked"))) {
                    setSessionExpiredOpen(true);
                }
            });
        }, 30 * 1000);
        revocationCheckIntervalRef.current = revocationInterval;

        return () => {
            if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
            if (revocationCheckIntervalRef.current) clearInterval(revocationCheckIntervalRef.current);
        };
    }, [user]); // Re-run when user object changes (e.g. login)

    const handleSessionExpiredConfirm = async () => {
        const auth = getAuth(app);
        await signOut(auth);
        window.location.href = '/auth/login';
    };

    return (
        <Dialog open={sessionExpiredOpen} onOpenChange={(open) => {
            // Force open if trying to close while expired
            if (open) setSessionExpiredOpen(true);
        }}>
            <DialogContent className="sm:max-w-md [&>button]:hidden">
                <DialogHeader>
                    <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-2">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <DialogTitle className="text-center text-xl">Session Expired</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        Your session has been expired or revoked by an administrator.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-center mt-4">
                    <Button onClick={handleSessionExpiredConfirm} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white">
                        Okay, Log in
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
