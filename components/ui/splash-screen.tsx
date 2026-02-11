"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Hide splash screen after 2.5 seconds or when app is ready
        // We can make this smarter by checking actual loading state, 
        // but for a splash screen, a minimum duration is often desired relevant for branding.
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

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
                        {/* Logo Animation */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="relative w-32 h-32 md:w-40 md:h-40"
                        >
                            {/* Ensure /logo.png exists in public folder */}
                            <Image
                                src="/logo.png"
                                alt="TayyariHub Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </motion.div>

                        {/* Text Animation */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="text-center"
                        >
                            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 tracking-tight">
                                TayyariHub
                            </h1>
                            <p className="text-sm text-muted-foreground mt-2 tracking-widest uppercase">
                                Excellence in Preparation
                            </p>
                        </motion.div>

                        {/* Loading Spinner (Optional) */}
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
