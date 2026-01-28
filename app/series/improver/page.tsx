'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    CheckCircle2,
    Crown,
    Zap,
    Target,
    Trophy,
    ArrowRight,
    Download,
    Calendar,
    XCircle,
    AlertCircle,
    Timer,
    BarChart3,
    Layers,
    Repeat,
    TrendingUp
} from 'lucide-react';
import SeriesSchedule from '@/components/Home/series-schedule';
import Link from 'next/link';
import HowToRegister from '@/components/Home/how-to-register';

export default function ImproverSeriesPage() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 pt-20">

            {/* Hero Section */}
            <section className="relative py-20 px-4 overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-100/40 dark:bg-indigo-900/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold text-sm mb-6">
                        <Zap className="w-4 h-4" />
                        <span>Dedicated for Improvers 2026</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
                        Improver <span className="text-indigo-600 dark:text-indigo-400">Series</span>
                    </h1>
                    <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed mb-8">
                        The ultimate roadmap to rewrite your future. A structured, rigorous test series designed specially for repeaters to maximize their score.
                    </p>
                    <Link href="/auth/register" className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-all shadow-lg hover:shadow-indigo-500/30">
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

            {/* What's Included */}
            <section className="py-12 px-4">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Series 1 */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                            <Zap className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Series 1</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Starting 15 Jan</p>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 16 General Tests</li>
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> XI & XII Combined</li>
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Rs. 1000</li>
                        </ul>
                    </div>

                    {/* Series 2 */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-6">
                            <Target className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Series 2</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Starting 01 April</p>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 16 General Tests</li>
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Full Revision</li>
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Rs. 1000</li>
                        </ul>
                    </div>

                    {/* FLP Series */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all">
                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">FLP Series</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Starting 01 July</p>
                        <ul className="space-y-3">
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 26 Full-Length Papers</li>
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> 180 MCQs / Test</li>
                            <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Rs. 2000</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Why Join (Benefits) */}
            <section className="py-12 px-4 bg-white dark:bg-slate-900/50">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Why Join MDCAT Improvers Series?</h2>
                        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            The <strong className="font-bold text-slate-900 dark:text-white">MDCAT Improvers Series</strong> is designed for repeaters who already know the syllabus and now need <strong className="font-bold text-slate-900 dark:text-white">speed, precision, and maximum revision</strong> to boost their score.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { title: "Fast-Paced Testing", desc: "No basics, no time waste — straight exam-level MCQs to keep your preparation sharp.", icon: Zap },
                            { title: "High-Revision Question Bank", desc: "Repeated concepts, mixed chapters, and frequently tested MDCAT patterns for strong retention.", icon: Repeat },
                            { title: "Accuracy & Time Management", desc: "Train yourself to attempt more questions in less time with smart elimination techniques.", icon: Timer },
                            { title: "Mixed & Integrated Tests", desc: "Biology, Chemistry, Physics, English & Logical Reasoning combined — just like the real MDCAT.", icon: Layers },
                            { title: "Identify Weak Spots Quickly", desc: "Instant performance insights help you fix mistakes fast and avoid repeating them.", icon: AlertCircle },
                            { title: "Score Improvement Strategy", desc: "Designed to help improvers cross merit gaps and push scores to the next level.", icon: TrendingUp },
                            { title: "Exam-Day Readiness", desc: "Regular full-length and revision tests build confidence under pressure.", icon: BarChart3 }
                        ].map((item, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-all hover:shadow-lg">
                                <div className="flex items-center gap-4 mb-3">
                                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                                        <item.icon className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 text-center bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                        <p className="text-xl font-bold text-indigo-900 dark:text-indigo-200">
                            "You don’t need more books — you need smarter tests."
                        </p>
                        <p className="text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
                            👉 MDCAT Improvers Series = Faster revision. Better accuracy. Higher score.
                        </p>
                    </div>
                </div>
            </section>

            {/* Who is this for */}
            <section className="py-12 px-4">
                <div className="max-w-4xl mx-auto bg-indigo-50 dark:bg-indigo-900/10 rounded-3xl p-8 md:p-12 border border-indigo-100 dark:border-indigo-800">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-6 text-center">Who is this for?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold flex-shrink-0">1</div>
                            <p className="text-slate-700 dark:text-slate-300">Students who have completed their syllabus once and need rigorous practice.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold flex-shrink-0">2</div>
                            <p className="text-slate-700 dark:text-slate-300">Repeaters aiming to maximize their score in MDCAT/NUMS 2026.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold flex-shrink-0">3</div>
                            <p className="text-slate-700 dark:text-slate-300">Those who need a structured roadmap to stay disciplined.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold flex-shrink-0">4</div>
                            <p className="text-slate-700 dark:text-slate-300">Students looking for high-quality, conceptual questions.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* What is Provided vs Not Provided */}
            <section className="py-12 px-4">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-10 text-center">What to Expect</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Provided */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-8 rounded-3xl border border-emerald-100 dark:border-emerald-800">
                            <h3 className="text-xl font-bold text-emerald-800 dark:text-emerald-400 mb-6 flex items-center gap-2">
                                <CheckCircle2 className="w-6 h-6" /> What is Provided
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>High-quality PDF Test Papers</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Detailed Key & Solutions</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Merit Lists & Result Compilation</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                                    <span>Group Discussion Access</span>
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
                                    <span>Live Video Lectures (unless specified)</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                                    <span>Physical Hard Copies of Tests</span>
                                </li>
                                <li className="flex gap-3 text-slate-700 dark:text-slate-300">
                                    <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                                    <span>1-on-1 Personal Tuition</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Comparison CTA */}
            <section className="py-12 px-4">
                <div className="max-w-4xl mx-auto text-center">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">Not an improver? Check out our Fresher Series for Class XII students.</p>
                    <Link href="/series/fresher" className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-full font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 transition-all">
                        View Fresher Series <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

            {/* Mega Bundle */}
            <section className="py-12 px-4 bg-slate-100 dark:bg-slate-900/50">
                <div className="max-w-4xl mx-auto">
                    <div className="lg:col-span-1 h-full flex flex-col">
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center justify-center gap-2">
                            <Crown className="w-6 h-6 text-orange-500" />
                            Mega Bundle
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
                                        IMPROVERS MEGA
                                    </h3>
                                    <div className="text-orange-600 font-bold text-sm tracking-wider">BUNDLE DEAL</div>
                                </div>
                            </div>

                            <div className="mb-6 relative z-10">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">
                                        Rs. 2800
                                    </span>
                                    <span className="text-xl text-slate-400 font-bold line-through decoration-red-500 decoration-2 ml-2">
                                        Rs. 4000
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
                                    <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Series 1 (16 General Tests)</li>
                                    <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> Series 2 (16 General Tests)</li>
                                    <li className="flex gap-3 text-sm text-slate-600 dark:text-slate-400"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /> FLP Series (26 FLPs & Mocks)</li>
                                    <li className="flex gap-3 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800"><CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-500 flex-shrink-0" /> Make your Own Test from 20,000 MCQS worth Rs.1500</li>
                                </ul>

                                <div className="mt-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/50 text-center">
                                    <p className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-1">Total Question Bank</p>
                                    <p className="text-3xl font-black text-orange-600 dark:text-orange-400">
                                        30,000 MCQs
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
                <SeriesSchedule defaultTab="improver" hideTabs={true} expandSeries={true} />
            </div>

            {/* Registration & Payment */}
            <HowToRegister />
        </div>
    );
}
