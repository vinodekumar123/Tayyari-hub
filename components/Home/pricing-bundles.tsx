"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2,
    Sparkles,
    Zap,
    Crown,
    BookOpen,
    FlaskConical,
    Atom,
    Microscope,
    Calculator,
    Languages,
    BrainCircuit,
    GraduationCap,
    MapPin,
    ArrowRight,
    Target,
    Trophy,
    Database
} from 'lucide-react';

const PricingBundles = () => {
    const [activeTab, setActiveTab] = useState<'freshers' | 'improvers'>('freshers');

    return (
        <section id="pricing" className="py-24 px-4 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
            <div className="max-w-7xl mx-auto relative z-10">

                {/* Header */}
                <div className="text-center mb-16 max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold text-sm mb-6"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Official Announcement 2026</span>
                    </motion.div>

                    <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
                        Focused Sessions for <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500 dark:from-blue-400 dark:to-cyan-400">Maximum Score</span>
                    </h2>

                    <p className="text-slate-600 dark:text-slate-400 font-medium mb-8">
                        Early Bird Discount (First 50 Students): <span className="text-green-600 font-bold">30% OFF</span> | Group (2 Students): <span className="text-green-600 font-bold">50% OFF</span> each
                    </p>

                    {/* Toggle Switch */}
                    <div className="inline-flex bg-white dark:bg-slate-900 p-2 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm relative">
                        <div
                            className="absolute inset-y-2 rounded-full bg-slate-900 dark:bg-blue-600 transition-all duration-300 ease-out shadow-md"
                            style={{
                                left: activeTab === 'freshers' ? '8px' : 'calc(50% + 4px)',
                                width: 'calc(50% - 12px)'
                            }}
                        />
                        <button
                            onClick={() => setActiveTab('freshers')}
                            suppressHydrationWarning
                            className={`relative z-10 px-8 py-3 rounded-full text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-2 w-48 ${activeTab === 'freshers' ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
                        >
                            <GraduationCap className="w-4 h-4" />
                            FRESHERS
                        </button>
                        <button
                            onClick={() => setActiveTab('improvers')}
                            suppressHydrationWarning
                            className={`relative z-10 px-8 py-3 rounded-full text-sm font-bold transition-colors duration-300 flex items-center justify-center gap-2 w-48 ${activeTab === 'improvers' ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
                        >
                            <Zap className="w-4 h-4" />
                            IMPROVERS
                        </button>
                    </div>
                </div>

                {/* Main Grid: Series (Left) + Bundle (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">

                    {/* Left Column: Individual Subjects (Freshers) OR Series (Improvers) */}
                    <div className="lg:col-span-2 flex flex-col">
                        <AnimatePresence mode="wait">
                            {activeTab === 'freshers' ? (
                                <motion.div
                                    key="freshers"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="h-full"
                                >
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                        <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                        Chapter-Wise Series (100 MCQs/Chap)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                                        {/* Science Subjects */}
                                        <SubjectCard title="Biology" icon={Microscope} price={1000} color="emerald" details="16 Chapter Tests & 1600 MCQs" />
                                        <SubjectCard title="Chemistry" icon={FlaskConical} price={1000} color="indigo" details="Chapter Tests & 2000 MCQs" />
                                        <SubjectCard title="Physics" icon={Atom} price={1000} color="violet" details="16 Chapter Tests & 1600 MCQs" />

                                        {/* General Tests */}
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all h-full flex flex-col justify-between group">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-3 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-2xl flex-shrink-0 group-hover:scale-110 transition-transform"><CheckCircle2 className="w-5 h-5" /></div>
                                                <div>
                                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">General Tests</h4>
                                                    <div className="text-slate-500 dark:text-slate-400 text-xs">12 Tests (6 XI + 6 XII)</div>
                                                </div>
                                            </div>
                                            <div className="self-end text-right">
                                                <div className="text-xs text-slate-400 line-through">Rs. 1000</div>
                                                <div className="font-bold text-xl text-slate-800 dark:text-white">Rs. 700</div>
                                            </div>
                                        </div>

                                        {/* Others */}
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all h-full flex flex-col justify-between group">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-2xl group-hover:scale-110 transition-transform"><Languages className="w-5 h-5" /></div>
                                                <div>
                                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">English</h4>
                                                    <div className="text-slate-500 dark:text-slate-400 text-xs">500 MCQs (10 Tests)</div>
                                                </div>
                                            </div>
                                            <div className="self-end text-right">
                                                <div className="text-xs text-slate-400 line-through">Rs. 500</div>
                                                <div className="font-bold text-xl text-slate-800 dark:text-white">Rs. 350</div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all h-full flex flex-col justify-between group">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl group-hover:scale-110 transition-transform"><BrainCircuit className="w-5 h-5" /></div>
                                                <div>
                                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">Logical Reasoning</h4>
                                                    <div className="text-slate-500 dark:text-slate-400 text-xs">500 MCQs (10 Tests)</div>
                                                </div>
                                            </div>
                                            <div className="self-end text-right">
                                                <div className="text-xs text-slate-400 line-through">Rs. 500</div>
                                                <div className="font-bold text-xl text-slate-800 dark:text-white">Rs. 350</div>
                                            </div>
                                        </div>

                                        {/* 20k MCQs Bank */}
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all h-full flex flex-col justify-between group">
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400">
                                                        will be live from 01 Feb
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-3 bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-600 dark:text-fuchsia-400 rounded-2xl flex-shrink-0 group-hover:scale-110 transition-transform"><Database className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="font-bold text-lg text-slate-900 dark:text-white">20,000 MCQs Bank</h4>
                                                        <div className="text-slate-500 dark:text-slate-400 text-xs text-balance">Make Your Own Tests (7/week)</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="self-end text-right">
                                                <div className="text-xs text-slate-400 line-through">Rs. 1500</div>
                                                <div className="font-bold text-xl text-slate-800 dark:text-white">Rs. 1050</div>
                                            </div>
                                        </div>

                                        {/* FLP Series for Freshers */}
                                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all h-full flex flex-col justify-between group">
                                            <div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                                        Starts 01 July
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-2xl flex-shrink-0 group-hover:scale-110 transition-transform"><Trophy className="w-5 h-5" /></div>
                                                    <div>
                                                        <h4 className="font-bold text-lg text-slate-900 dark:text-white">FLP Series</h4>
                                                        <div className="text-slate-500 dark:text-slate-400 text-xs text-balance">26 Full-Length Papers & Mocks</div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="self-end text-right">
                                                <div className="text-xs text-slate-400 line-through">Rs. 2000</div>
                                                <div className="font-bold text-xl text-slate-800 dark:text-white">Rs. 1400</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="improvers"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="md:pl-6 relative h-full"
                                >
                                    {/* Vertical Timeline Line */}
                                    <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

                                    <div className="space-y-6 relative">
                                        {/* Series 1 */}
                                        <div className="relative flex gap-6 items-start group">
                                            <div className="hidden md:flex flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-slate-900 border-4 border-blue-100 dark:border-blue-900 items-center justify-center relative z-10 shadow-sm mt-1">
                                                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group-hover:border-blue-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white bg-blue-500 mb-2">Starts 15 Jan</div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-400 line-through">Rs. 1000</div>
                                                        <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 700</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Zap className="w-5 h-5 text-blue-500" />
                                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">Series 1</h4>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-3">
                                                    16 General Tests (XI & XII Combined). 180 MCQs each.
                                                </p>
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-500">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Duration: 2.5 Months
                                                </div>
                                            </div>
                                        </div>

                                        {/* Series 2 */}
                                        <div className="relative flex gap-6 items-start group">
                                            <div className="hidden md:flex flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-slate-900 border-4 border-indigo-100 dark:border-indigo-900 items-center justify-center relative z-10 shadow-sm mt-1">
                                                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group-hover:border-indigo-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white bg-indigo-500 mb-2">Starts 01 April</div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-400 line-through">Rs. 1000</div>
                                                        <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 700</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Target className="w-5 h-5 text-indigo-500" />
                                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">Series 2</h4>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-3">
                                                    16 General Tests (XI & XII From Start).
                                                </p>
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-500">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> Duration: 2.5 Months
                                                </div>
                                            </div>
                                        </div>

                                        {/* FLP Series */}
                                        <div className="relative flex gap-6 items-start group">
                                            <div className="hidden md:flex flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-slate-900 border-4 border-purple-100 dark:border-purple-900 items-center justify-center relative z-10 shadow-sm mt-1">
                                                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group-hover:border-purple-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white bg-purple-500 mb-2">Starts 01 July</div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-400 line-through">Rs. 2000</div>
                                                        <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 1400</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Trophy className="w-5 h-5 text-purple-500" />
                                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">FLP Series</h4>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-3">
                                                    26 Full-Length Papers & Mocks. (Improvers & Freshers)
                                                </p>
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-500">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Mock Season
                                                </div>
                                            </div>
                                        </div>

                                        {/* 20k MCQs Bank Improvers */}
                                        <div className="relative flex gap-6 items-start group">
                                            <div className="hidden md:flex flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-slate-900 border-4 border-fuchsia-100 dark:border-fuchsia-900 items-center justify-center relative z-10 shadow-sm mt-1">
                                                <Database className="w-5 h-5 text-fuchsia-500" />
                                            </div>
                                            <div className="flex-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all relative overflow-hidden group-hover:border-fuchsia-200">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white bg-fuchsia-500 mb-2">will be live from 01 Feb</div>
                                                    <div className="text-right">
                                                        <div className="text-xs text-slate-400 line-through">Rs. 1500</div>
                                                        <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 1050</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Database className="w-5 h-5 text-fuchsia-500" />
                                                    <h4 className="font-bold text-lg text-slate-900 dark:text-white">20,000 MCQs Bank</h4>
                                                </div>
                                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-3">
                                                    Make Your Own Tests (7/week)
                                                </p>
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-500">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></div> 7 Tests per week
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right Column: The "Big Bundle" Card */}
                    <div className="lg:col-span-1 h-full flex flex-col">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Crown className="w-6 h-6 text-orange-500" />
                            {activeTab === 'freshers' ? 'Complete Bundle' : 'Mega Bundle'}
                        </h3>
                        <div className="group bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border-2 border-orange-400 relative overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 flex-1 flex flex-col">

                            {/* Shimmer Effect */}
                            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                                <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 dark:opacity-10 animate-shimmer" />
                            </div>

                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-red-500"></div>
                            <div className="absolute -right-12 top-6 bg-red-500 text-white text-xs font-bold px-12 py-1 rotate-45 shadow-sm">BEST VALUE</div>

                            <div className="flex items-center gap-3 mb-8 relative z-10">
                                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-2xl text-orange-600 dark:text-orange-500">
                                    <Crown className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                                        {activeTab === 'freshers' ? 'FRESHERS COMPLETE' : 'IMPROVERS MEGA'}
                                    </h3>
                                    <div className="text-orange-600 font-bold text-sm tracking-wider">BUNDLE DEAL</div>
                                </div>
                            </div>

                            <div className="mb-6 relative z-10">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-slate-900 dark:text-white">
                                        Rs. {activeTab === 'freshers' ? '3500' : '2800'}
                                    </span>
                                    <span className="text-lg text-slate-400 line-through decoration-red-400">
                                        Rs. {activeTab === 'freshers' ? '5000' : '4000'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">One-time payment</p>
                                    <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-bold px-2 py-1 rounded-full border border-green-200 dark:border-green-800">
                                        SAVE Rs. {activeTab === 'freshers' ? '1500' : '1200'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8 flex-1 relative z-10">
                                <p className="font-semibold text-slate-700 dark:text-slate-300">Everything you need:</p>
                                {activeTab === 'freshers' ? (
                                    <ul className="space-y-4">
                                        <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> All Chapter-wise (Bio,Chem,Phy)</li>
                                        <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> English + Logical Reasoning</li>
                                        <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 12 General Tests</li>
                                        <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 26 FLPs & Mocks</li>
                                        <li className="flex gap-3 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800"><CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-500 flex-shrink-0" /> Make your Own Test from 20,000 MCQS worth Rs.1500</li>
                                    </ul>
                                ) : (
                                    <ul className="space-y-4">
                                        <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Series 1 (16 General Tests)</li>
                                        <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Series 2 (16 General Tests)</li>
                                        <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> FLP Series (26 FLPs & Mocks)</li>
                                        <li className="flex gap-3 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800"><CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-500 flex-shrink-0" /> Make your Own Test from 20,000 MCQS worth Rs.1500</li>
                                    </ul>
                                )}

                                <div className="mt-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/50 text-center">
                                    <p className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">Total Question Bank</p>
                                    <p className="text-3xl font-black text-orange-600 dark:text-orange-400">
                                        {activeTab === 'freshers' ? '32,300+' : '30,000'} MCQs
                                    </p>
                                </div>
                            </div>

                            <Link
                                href="/auth/register"
                                className="relative z-10 block w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-center shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-cyan-700 transition-all mt-auto"
                            >
                                Get Bundle Now
                            </Link>
                        </div>
                    </div>

                </div>

                {/* Additional Power-Ups - Full Width Row */}
                <div className="mb-20">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                        <Zap className="w-6 h-6 text-amber-500" />
                        Additional Options
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-3xl relative overflow-hidden group min-h-[220px] flex flex-col justify-between hover:scale-[1.01] transition-transform duration-300">
                            <div>
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><BookOpen size={120} /></div>
                                <h4 className="text-2xl font-bold mb-3">Freshers Chapter-Wise Bundle</h4>
                                <ul className="text-slate-300 text-base space-y-2 mb-4">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div> All Chapter-Wise Tests Included</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div> Save Rs. 1000</li>
                                </ul>
                            </div>
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
                                <div>
                                    <span className="text-3xl font-bold">Rs. 2800</span>
                                    <span className="text-sm text-slate-400 line-through ml-2">Rs. 4000</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white p-8 rounded-3xl relative overflow-hidden group min-h-[220px] flex flex-col justify-between hover:scale-[1.01] transition-transform duration-300">
                            <div>
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Calculator size={120} /></div>
                                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-3">will be live from 01 Feb</div>
                                <h4 className="text-2xl font-bold mb-3">20,000 MCQs Bank</h4>
                                <ul className="text-blue-100 text-base space-y-2 mb-4">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-300 rounded-full"></div> Make Your Own Tests (7/week)</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-blue-300 rounded-full"></div> FREE with any Full Bundle</li>
                                </ul>
                            </div>
                            <div className="flex items-center justify-between mt-auto pt-4 border-white/20">
                                <div>
                                    <span className="text-3xl font-bold">Rs. 1050</span>
                                    <span className="text-sm text-blue-200 line-through ml-2">Rs. 1500</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                {/* How to Get Registered Section */}
                <div className="mb-20">
                    <div className="text-center mb-10">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">
                            How to Get Registered
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            Follow these simple steps to start your preparation journey with TayyariHub.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Step 1 */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-4xl font-black text-blue-200 dark:text-blue-800/50 group-hover:scale-110 transition-transform">1</div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                                    <Trophy className="w-6 h-6" />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Create Account</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                    Sign up on our platform to get started.
                                </p>
                                <Link href="/auth/register" className="text-sm font-bold text-blue-600 hover:text-blue-700 underline decoration-2 underline-offset-2">
                                    tayyarihub.com/auth/register
                                </Link>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-4xl font-black text-indigo-200 dark:text-indigo-800/50 group-hover:scale-110 transition-transform">2</div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                                    <Target className="w-6 h-6" />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Select Bundle</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Decide which series or complete bundle suits your preparation needs best.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-4xl font-black text-purple-200 dark:text-purple-800/50 group-hover:scale-110 transition-transform">3</div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Send Payment</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                    Send amount via QR code / Payment Till ID.
                                </p>
                                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800/50">
                                    <div className="text-xs text-slate-500 uppercase font-bold">Till ID</div>
                                    <div className="text-lg font-mono font-black text-purple-700 dark:text-purple-400 select-all">981571591</div>
                                    <div className="text-xs text-slate-500 mt-1">Title: Tayyari Hub</div>
                                </div>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-4xl font-black text-green-200 dark:text-green-800/50 group-hover:scale-110 transition-transform">4</div>
                            <div className="relative z-10">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Confirm Order</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                    WhatsApp your Name, Email, Series Name & Payment Receipt.
                                </p>
                                <a href="https://wa.me/923237507673" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors w-full justify-center">
                                    <span>0323 7507673</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contact Banner */}
                <div className="bg-slate-900 rounded-3xl p-8 md:p-12 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 group-hover:bg-white/10 transition-colors duration-500"></div>

                    <div className="relative z-10 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 text-orange-400 font-bold mb-4">
                            <MapPin className="w-5 h-5" />
                            <span>Hyderabad City</span>
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-2">Join TayyariHub Self Assessment Service</h3>
                        <p className="text-slate-400 max-w-lg">Early preparation = Higher chances of selection. Limited Seats!</p>
                    </div>

                    <div className="relative z-10 flex flex-col items-center md:items-end">
                        <div className="text-3xl font-bold text-white mb-1">0323-7507673</div>
                        <div className="text-slate-400 text-sm mb-4">Call for more info</div>
                        <Link href="/auth/register" className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold border border-white/20 transition-all">
                            Register Now
                        </Link>
                    </div>
                </div>

            </div>
        </section >
    );
};

const SubjectCard = ({ title, icon: Icon, price, color, details }: any) => {
    const colorStyles: Record<string, string> = {
        emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
        indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
        violet: "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
    };

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={`bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-pointer h-full flex flex-col justify-between`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${colorStyles[color] || 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400'} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-xs text-slate-400 line-through">Rs. {price}</span>
                    <div className="text-xl font-bold text-slate-800 dark:text-white">Rs. {price * 0.7}</div>
                </div>
            </div>
            <h4 className="font-bold text-lg mb-1 text-slate-900 dark:text-white">{title}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{details}</p>
        </motion.div>
    );
};

export default PricingBundles;
