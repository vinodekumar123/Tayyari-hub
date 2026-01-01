"use client";

import React from "react";
import { motion } from "framer-motion";

export const GridPattern = () => {
    return (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.2] dark:opacity-[0.05]">
            <svg
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
            >
                <pattern
                    id="grid-pattern"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d="M 40 0 L 0 0 0 40"
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="0.5"
                    />
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            </svg>
        </div>
    );
};

export const DotPattern = ({ className }: { className?: string }) => {
    return (
        <div className={`absolute inset-0 z-0 pointer-events-none opacity-[0.3] dark:opacity-[0.1] ${className}`}>
            <svg
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
            >
                <pattern
                    id="dot-pattern"
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                >
                    <circle cx="2" cy="2" r="1" fill="currentColor" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#dot-pattern)" />
            </svg>
        </div>
    )
}

export const GradientMesh = () => {
    return (
        <div className="absolute inset-0 -z-10 overflow-hidden">
            <motion.div
                animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                    x: [0, 30, -30, 0],
                    y: [0, -20, 20, 0]
                }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                }}
                className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20 blur-[130px] opacity-60"
            />
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, -5, 5, 0],
                    x: [0, -40, 40, 0],
                    y: [0, 30, -30, 0]
                }}
                transition={{
                    duration: 18,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "easeInOut",
                }}
                className="absolute bottom-[10%] right-[5%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-cyan-400/20 via-teal-400/20 to-blue-400/20 blur-[120px] opacity-60"
            />
            <motion.div
                animate={{
                    scale: [1, 1.15, 1],
                    x: [0, 20, -20, 0],
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: "linear",
                }}
                className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px]"
            />
        </div>
    );
};
