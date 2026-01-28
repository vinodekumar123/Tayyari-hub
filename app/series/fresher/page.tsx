'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Crown,
    BookOpen,
    FlaskConical,
    Atom,
    Microscope,
    Languages,
    BrainCircuit,
    ArrowRight,
    Calendar,
    XCircle,
    AlertCircle,
    Timer,
    BarChart3,
    Layers,
    BookOpenCheck,
    TrendingUp
} from 'lucide-react';
import SeriesSchedule from '@/components/Home/series-schedule';
import Link from 'next/link';
import HowToRegister from '@/components/Home/how-to-register';

export default function FresherSeriesPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 pt-20">

            {/* Hero Section */}
            <section className="relative py-20 px-4 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3"></div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm mb-6">
                        <BookOpen className="w-4 h-4" />
                        <span>Designed for Freshers 2026</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
                        Fresher <span className="text-blue-600 dark:text-blue-400">Series</span>
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed mb-8">
                        Balance your board exams and entry test preparation with our perfectly synced chapter-wise series.
                    </p>
                    <Link href="/auth/register" className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold transition-all shadow-lg hover:shadow-blue-500/30">
                        Register Now <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>

            {/* Disclaimer */}
            <section className="px-4 pb-12">
                <div className="max-w-4xl mx-auto bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-4 shadow-sm">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 dark:text-amber-500 shrink-0">
                        <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-amber-800 dark:text-amber-400 font-bold text-lg mb-1">Important Note</h4>
                        <p className="text-amber-700 dark:text-amber-300 text-sm leading-relaxed">
                            This is a comprehensive <strong>self-assessment test series</strong>. No live classes are provided.
                            Your subscription includes online self-assessment tests valid until <strong>MDCAT 2026</strong>.
                        </p>
                    </div>
                </div>
            </section>

            {/* Individual Subjects Pricing */}
            <section className="py-12 px-4">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8 text-center">Subject-Wise Packages</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Bio */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                                    <Microscope className="w-6 h-6" />
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 1000</div>
                            </div>
                            <h3 className="font-bold text-lg mb-1">Biology</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">16 Tests / 1600 MCQs</p>
                        </div>

                        {/* Chem */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                                    <FlaskConical className="w-6 h-6" />
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 1000</div>
                            </div>
                            <h3 className="font-bold text-lg mb-1">Chemistry</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Chapter Tests / 2000 MCQs</p>
                        </div>

                        {/* Phy */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <div className="p-3 bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 rounded-2xl">
                                    <Atom className="w-6 h-6" />
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 1000</div>
                            </div>
                            <h3 className="font-bold text-lg mb-1">Physics</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">16 Tests / 1600 MCQs</p>
                        </div>

                        {/* English */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-2xl">
                                    <Languages className="w-6 h-6" />
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 500</div>
                            </div>
                            <h3 className="font-bold text-lg mb-1">English</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">10 Tests / 500 MCQs</p>
                        </div>

                        {/* LR */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl">
                                    <BrainCircuit className="w-6 h-6" />
                                </div>
                                <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. 500</div>
                            </div>
                            <h3 className="font-bold text-lg mb-1">Logical Reasoning</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">10 Tests / 500 MCQs</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Join (Benefits) */}
            <section className="py-12 px-4 bg-white dark:bg-slate-900/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Why Join MDCAT Freshers Series?</h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            The <strong className="font-bold text-slate-900 dark:text-white">MDCAT Freshers Series</strong> is specially designed for students starting their MDCAT journey. It helps you build a <strong className="font-bold text-slate-900 dark:text-white">strong foundation</strong>, gain <strong className="font-bold text-slate-900 dark:text-white">exam confidence</strong>, and understand the <strong className="font-bold text-slate-900 dark:text-white">real MDCAT pattern</strong> from day one.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { title: "Concept-Based Preparation", desc: "Questions are designed strictly according to MDCAT syllabus, focusing on concept clarity, not rote learning.", icon: BookOpenCheck },
                            { title: "Freshers-Focused Difficulty", desc: "Tests start from basic to moderate level, perfect for beginners who feel overwhelmed by advanced MDCAT questions.", icon: TrendingUp },
                            { title: "Smart Subject Coverage", desc: "Biology, Chemistry, Physics, English & Logical Reasoning — all included with balanced weightage.", icon: FlaskConical },
                            { title: "Real Exam Experience", desc: "Timed tests, MDCAT-style MCQs, and exam-like environment help reduce fear and improve speed & accuracy.", icon: Timer },
                            { title: "Actionable Analysis", desc: "Know your strengths, weaknesses, accuracy, and time management after every test.", icon: BarChart3 },
                            { title: "Consistent Practice", desc: "Regular testing keeps you disciplined and exam-ready from the very start of your journey.", icon: Crown },
                            { title: "Affordable & High-Value", desc: "Maximum practice, structured tests, and expert-designed MCQs — all at a student-friendly cost.", icon: CheckCircle2 }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all hover:shadow-lg">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 text-center bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                        <p className="text-xl font-bold text-blue-900 dark:text-blue-200">
                            "Start early. Build strong concepts. Crack MDCAT with confidence."
                        </p>
                        <p className="text-blue-600 dark:text-blue-400 mt-2 font-medium">
                            👉 MDCAT Freshers Series is your first smart step towards medical college.
                        </p>
                    </div>
                </div>
            </section>

            {/* Who is this for */}
            <section className="py-12 px-4">
                <div className="max-w-4xl mx-auto bg-blue-50 dark:bg-blue-900/10 rounded-3xl p-8 md:p-12 border border-blue-100 dark:border-blue-800">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-6 text-center">Who is this for?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">1</div>
                            <p className="text-slate-700 dark:text-slate-300">Class XII students appearing for board exams in 2026.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">2</div>
                            <p className="text-slate-700 dark:text-slate-300">Students who want to start early for MDCAT/NUMS.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">3</div>
                            <p className="text-slate-700 dark:text-slate-300">Those managing college studies alongside entry test prep.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">4</div>
                            <p className="text-slate-700 dark:text-slate-300">Students looking for chapter-wise clarification.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Provided / Not Provided */}
            <section className="py-12 px-4">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-10 text-center">What's Included</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Provided */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-800">
                            <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-400 mb-6 flex items-center gap-2">
                                <CheckCircle2 className="w-6 h-6" /> What is Provided
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Subject-wise / Chapter-wise Tests</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Detailed Solutions & Keys</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Result Compilation</span>
                                </li>
                            </ul>
                        </div>

                        {/* Not Provided */}
                        <div className="bg-rose-50 dark:bg-rose-900/10 p-8 rounded-3xl border border-rose-100 dark:border-rose-800">
                            <h3 className="text-xl font-bold text-rose-800 dark:text-rose-400 mb-6 flex items-center gap-2">
                                <XCircle className="w-6 h-6" /> What is NOT Provided
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                                    <span>Full Syllabus crash courses (Initially)</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                                    <span>Hard copy study material</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Comparison CTA */}
            <section className="py-12 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">Already completed Mdcat? Check our Improver Series.</p>
                    <Link href="/series/improver" className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-full font-bold text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all">
                        View Improver Series <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

            {/* Mega Bundle */}
            <section className="py-12 px-4 bg-slate-100 dark:bg-slate-900/50">
                <div className="max-w-4xl mx-auto">
                    <div className="lg:col-span-1 h-full flex flex-col">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-center gap-2">
                            <Crown className="w-6 h-6 text-orange-500" />
                            Complete Bundle
                        </h3>
                        <div className="group bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-orange-400 relative overflow-hidden transform hover:-translate-y-2 transition-transform duration-300 flex-1 flex flex-col">

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
                                        FRESHERS COMPLETE
                                    </h3>
                                    <div className="text-orange-600 font-bold text-sm tracking-wider">BUNDLE DEAL</div>
                                </div>
                            </div>

                            <div className="mb-6 relative z-10">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">
                                        Rs. 3500
                                    </span>
                                    <span className="text-xl text-slate-400 font-bold line-through decoration-red-500 decoration-2 ml-2">
                                        Rs. 5000
                                    </span>
                                    <div className="inline-block ml-3 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full animate-pulse border border-green-200 dark:border-green-800">
                                        30% OFF DEAL
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">One-time payment</p>
                                    <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-bold px-2 py-1 rounded-full border border-green-200 dark:border-green-800">
                                        GROUP: 40% (2 Students) | 50% (3 Students)
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8 flex-1 relative z-10">
                                <p className="font-semibold text-slate-700 dark:text-slate-300">Everything you need:</p>
                                <ul className="space-y-4">
                                    <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> All Chapter-wise (Bio,Chem,Phy)</li>
                                    <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> English + Logical Reasoning</li>
                                    <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 12 General Tests</li>
                                    <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 26 FLPs & Mocks</li>
                                    <li className="flex gap-3 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800"><CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-500 flex-shrink-0" /> Make your Own Test from 20,000 MCQS worth Rs.1500</li>
                                </ul>

                                <div className="mt-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/50 text-center">
                                    <p className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">Total Question Bank</p>
                                    <p className="text-3xl font-black text-orange-600 dark:text-orange-400">
                                        32,300+ MCQs
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
            </section>

            <div className="py-12">
                <SeriesSchedule defaultTab="fresher" hideTabs={true} />
            </div>

            {/* Registration & Payment */}
            <HowToRegister />
        </div>
    );
}
