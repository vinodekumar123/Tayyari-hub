'use client';

import { motion } from 'framer-motion';

export function CommunityBackground() {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
            {/* Base Background */}
            <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-500" />

            {/* Aurora Blobs */}
            <motion.div
                className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-purple-500/20 dark:bg-purple-900/20 rounded-full blur-3xl"
                animate={{
                    x: [0, 100, 0],
                    y: [0, -50, 0],
                    scale: [1, 1.2, 1]
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />

            <motion.div
                className="absolute top-[20%] right-[0%] w-[40vw] h-[40vw] bg-blue-500/20 dark:bg-blue-900/20 rounded-full blur-3xl"
                animate={{
                    x: [0, -50, 0],
                    y: [0, 100, 0],
                    scale: [1, 1.1, 1]
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 2
                }}
            />

            <motion.div
                className="absolute -bottom-[10%] left-[20%] w-[60vw] h-[60vw] bg-pink-500/10 dark:bg-pink-900/10 rounded-full blur-3xl"
                animate={{
                    x: [0, 50, 0],
                    y: [0, 50, 0],
                    scale: [1, 1.3, 1]
                }}
                transition={{
                    duration: 30,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 5
                }}
            />

            {/* Mesh Texture Overlay (Optional for grit) */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[url('/grid-pattern.svg')] mix-blend-overlay" />
        </div>
    );
}
