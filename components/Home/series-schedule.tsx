"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar,
    BookOpen,
    Sparkles,
    Zap,
    Trophy,
    Target,
    Clock,
    CheckCircle2,
    Microscope,
    FlaskConical,
    Atom,
    Languages,
    BrainCircuit,
    ArrowRight
} from 'lucide-react';

const SeriesSchedule = () => {
    const [activeTab, setActiveTab] = useState<'freshers' | 'improvers'>('freshers');

    const freshersData = [
        {
            title: "Biology Series",
            subtitle: "Chapter-wise Coverage",
            stats: "16+ Tests & 1600 MCQs",
            icon: <Microscope className="w-6 h-6" />,
            color: "emerald",
            features: ["100 MCQs/Chapter", "XI & XII Complete", "Explanations"]
        },
        {
            title: "Chemistry Series",
            subtitle: "Organic & Inorganic",
            stats: "20+ Tests & 2000 MCQs",
            icon: <FlaskConical className="w-6 h-6" />,
            color: "blue",
            features: ["100 MCQs/Chapter", "XI & XII Complete", "Reaction Maps"]
        },
        {
            title: "Physics Series",
            subtitle: "Conceptual Clarity",
            stats: "20+ Tests & 2000 MCQs",
            icon: <Atom className="w-6 h-6" />,
            color: "violet",
            features: ["100 MCQs/Chapter", "XI & XII Complete", "Numerical Drills"]
        },
        {
            title: "English & Logic",
            subtitle: "Verbal & Reasoning",
            stats: "20+ Tests",
            icon: <BrainCircuit className="w-6 h-6" />,
            color: "rose",
            features: ["500+ Practice MCQs", "Vocabulary Builder", "Logic Patterns"]
        }
    ];

    const timelineData = [
        {
            phase: "PHASE 1",
            title: "Improvers Series 1",
            date: "Starting : 15 Jan",
            desc: "12 General Tests covering major syllabus portions to build momentum. 2160 MCQS",
            icon: <Zap className="w-5 h-5" />,
            color: "bg-blue-500"
        },
        {
            phase: "PHASE 2",
            title: "Improvers Series 2 (Improver Revision Series)",
            date: "01 April",
            desc: "12 Advanced Tests with increased difficulty and full syllabus coverage. 2160 MCQS",
            icon: <Target className="w-5 h-5" />,
            color: "bg-indigo-500"
        },
        {
            phase: "PHASE 3",
            title: "FLP Mock Series",
            date: "Starting from 01 July",
            desc: "26 Full-Length Papers mirroring the exact MDCAT pattern and timing. Approx 4000 MCQS",
            icon: <Trophy className="w-5 h-5" />,
            color: "bg-purple-500"
        },
    ];

    return (
        <section id="schedule" className="py-24 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Background Decorations */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">

                {/* Header */}
                <div className="text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-600 dark:text-slate-300 font-semibold text-sm mb-6"
                    >
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span>Academic Calendar 2026</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6"
                    >
                        Your Roadmap to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Victory</span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
                    >
                        Structured timelines designed for both Freshers starting their journey and Improvers aiming for perfection.
                    </motion.p>
                </div>

                {/* Tabs */}
                <div className="flex justify-center mb-16">
                    <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg inline-flex relative">
                        {['freshers', 'improvers'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                suppressHydrationWarning
                                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 capitalize ${activeTab === tab
                                    ? 'text-white'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {tab === 'freshers' ? 'Freshers (XI & XII)' : 'Improvers (Repeaters)'}
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-md"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-[500px]">
                    {activeTab === 'freshers' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {freshersData.map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    whileHover={{ y: -5 }}
                                    className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group"
                                >
                                    <div className={`w-14 h-14 rounded-2xl bg-${item.color}-50 dark:bg-${item.color}-900/20 flex items-center justify-center text-${item.color}-600 dark:text-${item.color}-400 mb-6 group-hover:scale-110 transition-transform`}>
                                        {item.icon}
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{item.title}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{item.subtitle}</p>

                                    <div className="space-y-3 mb-6">
                                        {item.features.map((feat, j) => (
                                            <div key={j} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                                <CheckCircle2 className={`w-4 h-4 text-${item.color}-500`} />
                                                {feat}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">{item.stats}</span>
                                        <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto relative">
                            {/* Vertical Line */}
                            <div className="absolute left-[28px] md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-indigo-200 to-transparent"></div>

                            {timelineData.map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: i * 0.2 }}
                                    className={`flex flex-col md:flex-row items-start md:items-center gap-8 mb-16 relative ${i % 2 === 0 ? '' : 'md:flex-row-reverse'
                                        }`}
                                >
                                    {/* Content Card */}
                                    <div className="flex-1 pl-16 md:pl-0 md:text-right">
                                        <div className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-lg hover:shadow-xl transition-shadow relative group ${i % 2 === 0 ? 'md:mr-8 md:text-right' : 'md:ml-8 md:text-left'
                                            }`}>
                                            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white mb-3 ${item.color}`}>
                                                {item.phase}
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{item.title}</h3>
                                            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>

                                    {/* Center Node */}
                                    <div className="absolute left-[14px] md:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-900 border-4 border-blue-100 dark:border-blue-900 shadow-sm flex items-center justify-center z-10">
                                        <div className={`w-3 h-3 rounded-full ${item.color} animate-pulse`}></div>
                                    </div>

                                    {/* Date Label (Opposite Side) */}
                                    <div className={`flex-1 pl-16 md:pl-0 hidden md:block ${i % 2 === 0 ? 'text-left ml-8' : 'text-right mr-8'
                                        }`}>
                                        <div className="flex items-center gap-2 text-slate-500 font-semibold justify-start">
                                            <Clock className="w-5 h-5 text-blue-400" />
                                            {item.date}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </section>
    );
};

export default SeriesSchedule;
