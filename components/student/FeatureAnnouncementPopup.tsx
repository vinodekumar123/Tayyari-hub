'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens'; // Assuming this exists or I'll use inline styles if not sure, wait, I saw it used in auto-tagger. Let's use standard Tailwind for safety first to avoid import errors if path wrong.

export function FeatureAnnouncementPopup() {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Check if user has already seen this announcement
        const hasSeen = localStorage.getItem('hasSeenCreateTestAnnouncement_v1');
        if (!hasSeen) {
            // Small delay for better UX
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleDismiss = () => {
        setIsOpen(false);
        localStorage.setItem('hasSeenCreateTestAnnouncement_v1', 'true');
    };

    const handleTryNow = () => {
        handleDismiss();
        router.push('/quiz/create-mock');
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDismiss}>
            <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-950 shadow-2xl overflow-hidden p-0">
                {/* Visual Header */}
                <div className="relative h-32 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_500px_at_50%_200px,#ffffff,transparent)]"></div>
                    </div>
                    <div className="relative z-10 p-4 bg-white/10 backdrop-blur-md rounded-full shadow-lg border border-white/20">
                        <Sparkles className="w-10 h-10 text-yellow-300 fill-yellow-300 animate-pulse" />
                    </div>
                    {/* Confetti-like decoration */}
                    <div className="absolute top-4 left-4 w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-100"></div>
                    <div className="absolute bottom-6 right-8 w-3 h-3 bg-pink-400 rounded-full animate-bounce delay-300"></div>
                    <div className="absolute top-10 right-10 w-2 h-2 bg-white rounded-full animate-bounce delay-700"></div>
                </div>

                <div className="p-6">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                            Create Your Own Tests!
                        </DialogTitle>
                        <DialogDescription className="text-center text-base text-slate-600 dark:text-slate-300">
                            Good news! 🚀 The <span className="font-bold text-slate-900 dark:text-white">Custom Mock Test</span> feature is now live.
                            You can now generate personalized quizzes for specific subjects and chapters.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="mt-8 flex flex-col gap-3">
                        <Button
                            onClick={handleTryNow}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 py-6 text-lg font-bold rounded-xl transition-all hover:scale-[1.02]"
                        >
                            Try It Now <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleDismiss}
                            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            Maybe Later
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
