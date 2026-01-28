'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Clock, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export function GoodNewsPopup() {
    const [open, setOpen] = useState(false);
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

    useEffect(() => {
        // Show popup after a short delay on mount, if not already seen in this session
        const hasSeen = sessionStorage.getItem('seenGoodNewsPopup');
        if (!hasSeen) {
            const timer = setTimeout(() => {
                setOpen(true);
                sessionStorage.setItem('seenGoodNewsPopup', 'true');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    useEffect(() => {
        const calculateTimeLeft = () => {
            // Target Date: Jan 30, 2026 23:59:59
            const difference = +new Date("2026-01-30T23:59:59") - +new Date();
            let timeLeft = {};

            if (difference > 0) {
                timeLeft = {
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60),
                };
                setTimeLeft(timeLeft as any);
            } else {
                setTimeLeft(null);
            }
        };

        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft(); // initial call

        return () => clearInterval(timer);
    }, []);

    if (!timeLeft) return null; // Don't show if expired (or initial hydrating)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-gradient-to-br from-indigo-900 to-slate-900 text-white border-orange-500/50">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-orange-500 animate-pulse z-50"></div>

                {/* Background Confetti/Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10 p-6 flex flex-col items-center text-center">

                    <div className="inline-flex items-center justify-center p-3 bg-yellow-400/20 rounded-full mb-4 ring-2 ring-yellow-400/50 animate-bounce">
                        <PartyPopper className="w-8 h-8 text-yellow-400" />
                    </div>

                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
                            GOOD NEWS!
                        </DialogTitle>
                        <p className="text-blue-100 font-medium mt-2">
                            Official Discount Offer Announced 🚀
                        </p>
                    </DialogHeader>

                    <div className="w-full bg-white/10 rounded-xl p-4 mb-6 backdrop-blur-sm border border-white/10">
                        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/20">
                            <div>
                                <div className="text-xs text-blue-200 mb-1">Single</div>
                                <div className="text-xl font-bold text-yellow-300">30% OFF</div>
                            </div>
                            <div>
                                <div className="text-xs text-blue-200 mb-1">2 Students</div>
                                <div className="text-xl font-bold text-yellow-300">40% OFF</div>
                            </div>
                            <div>
                                <div className="text-xs text-blue-200 mb-1">3 Students</div>
                                <div className="text-xl font-bold text-yellow-300">50% OFF</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-6 text-sm font-mono bg-black/40 px-4 py-2 rounded-full border border-white/10">
                        <Clock className="w-4 h-4 text-orange-400" />
                        <span className="text-orange-400 font-bold">Ends in:</span>
                        <span className="text-white">
                            {String(timeLeft.days).padStart(2, '0')}d : {String(timeLeft.hours).padStart(2, '0')}h : {String(timeLeft.minutes).padStart(2, '0')}m
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full">
                        <Button variant="outline" className="border-white/20 hover:bg-white/10 text-slate-800" onClick={() => setOpen(false)}>
                            Close
                        </Button>
                        <Link href="/pricing" className="w-full" onClick={() => setOpen(false)}>
                            <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold border-0">
                                Grab Offer
                            </Button>
                        </Link>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-4">
                        *Valid until 30 Jan 2026. Terms apply.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
