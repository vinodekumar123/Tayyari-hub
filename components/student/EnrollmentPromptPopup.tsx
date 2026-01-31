'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/app/firebase';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, GraduationCap, ArrowRight, X } from 'lucide-react';

const POPUP_STORAGE_KEY = 'tayyari_enrollment_popup_dismissed';
const POPUP_DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function EnrollmentPromptPopup() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const auth = getAuth();

        const checkEnrollment = async (uid: string) => {
            try {
                // Check if popup was recently dismissed
                const dismissed = localStorage.getItem(POPUP_STORAGE_KEY);
                if (dismissed) {
                    const dismissedTime = parseInt(dismissed, 10);
                    if (Date.now() - dismissedTime < POPUP_DISMISS_DURATION) {
                        setLoading(false);
                        return;
                    }
                }

                // Check for active enrollments
                const q = query(
                    collection(db, 'enrollments'),
                    where('studentId', '==', uid),
                    where('status', 'in', ['active', 'paid', 'enrolled'])
                );
                const snapshot = await getDocs(q);
                const isEnrolled = snapshot.docs.length > 0;

                if (!isEnrolled) {
                    setOpen(true);
                }
            } catch (error) {
                console.error('Error checking enrollment:', error);
            } finally {
                setLoading(false);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                checkEnrollment(user.uid);
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleDismiss = () => {
        localStorage.setItem(POPUP_STORAGE_KEY, Date.now().toString());
        setOpen(false);
    };

    const handleLearnMore = () => {
        handleDismiss();
        router.push('/dashboard/student/how-to-register');
    };

    if (loading) return null;

    return (
        <Dialog open={open} onOpenChange={(value) => !value && handleDismiss()}>
            <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 shadow-2xl">
                <DialogHeader className="text-center space-y-4">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <GraduationCap className="w-10 h-10 text-white" />
                    </div>
                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Unlock Premium Features!
                    </DialogTitle>
                    <DialogDescription className="text-base text-slate-600 dark:text-slate-400 px-4">
                        Enroll in any series to unlock exclusive benefits like{' '}
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Question Reporting</span>,{' '}
                        <span className="font-semibold text-purple-600 dark:text-purple-400">Community Access</span>, and{' '}
                        <span className="font-semibold text-pink-600 dark:text-pink-400">Premium Study Materials</span>!
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 px-2">
                    <div className="space-y-3">
                        {[
                            { emoji: '📚', text: 'Access to all quizzes & study materials' },
                            { emoji: '🚀', text: 'Report questions & get instant support' },
                            { emoji: '👥', text: 'Join exclusive community discussions' },
                            { emoji: '🎯', text: 'Track your progress with analytics' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                                <span className="text-xl">{item.emoji}</span>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="ghost" onClick={handleDismiss} className="text-slate-500 hover:text-slate-700">
                        <X className="w-4 h-4 mr-1" /> Maybe Later
                    </Button>
                    <Button
                        onClick={handleLearnMore}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 flex-1 sm:flex-initial"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Learn How to Register
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
