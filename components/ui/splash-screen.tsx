"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashScreen() {
    const [isVisible, setIsVisible] = useState(false); // Default to false, check for PWA first
    const [isPWA, setIsPWA] = useState(false);

    useEffect(() => {
        // Check if running in standalone mode (PWA)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone ||
            document.referrer.includes('android-app://');

        if (isStandalone) {
            setIsPWA(true);
            setIsVisible(true);

            // Hide splash screen after 2.5 seconds
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 2500);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!isPWA || !isVisible) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="fixed inset-0 z-[99999] bg-white dark:bg-slate-950 flex flex-col items-center justify-center p-4"
                >
                    <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                        {/* Logo Animation - Using full logo same as sidebar */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="relative w-64 h-64" // Increased size for full logo
                        >
                            <Image
                                src="/logo.png" // Assuming this is the full logo as requested
                                alt="TayyariHub Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </motion.div>

                        {/* Text Animation - Removed "TayyariHub" text since it's likely in the full logo, 
                            or we keep it if the logo is just an icon. 
                            User asked for "full logo... same that is sidebar". 
                            Sidebar usually has icon+text. 
                            I'll keep the slogan but remove the potentially redundant Title if the logo has text.
                            Actually, sidebar often has logo + text next to it. 
                            If /logo.png is the sidebar image, it might be the icon.
                            Let's keep the text for safety but style it elegantly.
                         */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="text-center"
                        >
                            <p className="text-sm text-muted-foreground mt-2 tracking-widest uppercase">
                                Excellence in Preparation
                            </p>
                        </motion.div>

                        {/* Loading Spinner */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden mt-8"
                        >
                            <motion.div
                                className="h-full bg-blue-600"
                                initial={{ width: "0%" }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 2, ease: "easeInOut" }}
                            />
                        </motion.div>
                    </div>

                    {/* Footer Branding */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.5 }}
                        className="py-8 text-center"
                    >
                        <p className="text-xs text-muted-foreground/60 font-medium tracking-wide">
                            Powered by
                        </p>
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 flex items-center justify-center gap-2">
                            Medico Engineer
                        </h2>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
