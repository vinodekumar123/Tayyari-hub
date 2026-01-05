"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from 'next/link';
import { FloatingElements } from "./decorations/FloatingElements";
import { GridPattern, GradientMesh } from "./decorations/BackgroundPatterns";
import { Spotlight } from "@/components/ui/spotlight";
import { TextGenerateEffect } from "@/components/ui/text-generate-effect";

const HeroModern = () => {
    return (
        <section
            className="relative min-h-[90vh] grid place-content-center overflow-hidden bg-white dark:bg-gray-950 px-4 py-24 text-gray-900 dark:text-gray-200"
        >
            {/* Animated Gradient Background via CSS */}
            <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_0%,transparent_50%,var(--token-color))] animate-gradient-slow opacity-40 pointer-events-none"
                style={{ '--token-color': '#1E67C6' } as React.CSSProperties}
            />
            {/* Spotlight Effect */}
            <Spotlight className="-top-40 -left-10 md:-left-32 md:-top-20 h-screen" fill="white" />

            {/* Background Layers */}
            <div className="absolute inset-0 z-0">
                <GradientMesh />
                <GridPattern />
                <FloatingElements />
            </div>

            <div className="relative z-10 flex flex-col items-center">
                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 px-3 py-1 text-sm text-gray-700 dark:text-gray-300 backdrop-blur-md shadow-sm dark:shadow-none"
                >
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    MDCAT 2026 • Registration Open
                </motion.div>

                {/* Headline */}
                <div className="text-center text-5xl font-black leading-tight sm:text-7xl md:text-8xl text-gray-900 dark:text-gray-100 mb-6">
                    <TextGenerateEffect words="Master Your MDCAT Journey" />
                </div>

                {/* Subhead */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="mt-6 max-w-2xl text-center text-lg text-gray-600 dark:text-gray-400 sm:text-xl"
                >
                    The most advanced preparation ecosystem.
                    Gamified learning, AI analytics, and comprehensive mock series designed for <span className="text-gray-900 dark:text-white font-bold">Guaranteed Success</span>.
                </motion.p>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                    className="mt-10 flex flex-col sm:flex-row gap-4"
                >
                    <Link
                        href="/auth/register"
                        className="group relative flex items-center gap-2 rounded-full bg-gray-900 dark:bg-white px-8 py-4 text-lg font-bold text-white dark:text-gray-950 transition-transform hover:scale-105 active:scale-95 shadow-lg mx-auto sm:mx-0"
                    >
                        Start for Free
                        <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link
                        href="/pricing"
                        className="group flex items-center justify-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 px-8 py-4 text-lg font-bold text-gray-900 dark:text-white backdrop-blur-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-500 shadow-sm dark:shadow-none"
                    >
                        View Plans
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};

export default HeroModern;
