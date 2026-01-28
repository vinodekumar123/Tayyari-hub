'use client';

import React from 'react';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import {
    BookOpen,
    Users,
    Rocket,
    History,
    Globe,
    Award,
    GraduationCap,
    CheckCircle,
    Heart,
    Calculator,
    FileText,
    Newspaper
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export function AboutContent() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900">

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-4 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100 dark:bg-blue-900/20 rounded-full blur-[100px] -mr-32 -mt-32 opacity-60"></div>
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-100 dark:bg-cyan-900/20 rounded-full blur-[100px] -ml-32 -mb-32 opacity-60"></div>
                </div>

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <ScrollReveal>
                        <Badge variant="outline" className="mb-4 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 px-4 py-1.5 text-sm rounded-full">
                            Our Story
                        </Badge>
                        <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6">
                            Tayyari Hub <span className="text-slate-400 dark:text-slate-600 px-2 lg:px-4 text-2xl md:text-4xl font-light">|</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Medico Engineer</span>
                        </h1>
                        <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
                            A cutting-edge online ecosystem empowering thousands of students to excel in MDCAT, ECAT, and other competitive exams.
                        </p>
                    </ScrollReveal>
                </div>
            </section>

            {/* Tayyari Hub Section */}
            <section className="py-20 px-4 relative">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <ScrollReveal>
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-3xl blur-2xl opacity-20 transform rotate-3"></div>
                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl relative z-10">
                                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400">
                                        <Rocket className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">The Preparation Ecosystem</h3>
                                    <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                                        Tayyari Hub isn&apos;t just another test-prep site. It is a complete digital learning platform designed to replace traditional limitations with 24/7 smart preparation.
                                    </p>
                                    <ul className="space-y-3">
                                        {[
                                            "Massive Question Bank with high-yield MCQs",
                                            "Chapter-wise tests & Full-length Mocks",
                                            "AI-Powered Learning Paths & Analytics",
                                            "4 Years of Legacy of Medico Engineer"
                                        ].map((item, i) => (
                                            <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm font-medium">
                                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </ScrollReveal>

                        <ScrollReveal>
                            <div className="space-y-6">
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                                    Why <span className="text-blue-600">Tayyari Hub?</span>
                                </h2>
                                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                                    We bridge the gap between hard work and smart work. Our platform offers structured progress tracking, intelligent analytics, and a syllabus aligned with the latest exam patterns.
                                </p>
                                <div className="grid grid-cols-2 gap-4 pt-4">
                                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">20k+</div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">MCQs Available</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-900/20">
                                        <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400 mb-1">24/7</div>
                                        <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">Access Anywhere</div>
                                    </div>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </section>

            {/* Medico Engineer Section */}
            <section className="py-20 px-4 bg-slate-100/50 dark:bg-slate-900/50 relative overflow-hidden">
                <div className="max-w-5xl mx-auto relative z-10">
                    <ScrollReveal>
                        <div className="text-center mb-16">
                            <Badge variant="secondary" className="mb-4">Power Behind The Hub</Badge>
                            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                                Medico Engineer
                            </h2>
                            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                                A free online educational platform created to support students with high-quality resources, accessible to everyone.
                            </p>
                        </div>
                    </ScrollReveal>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <BookOpen className="w-6 h-6 text-indigo-500" />,
                                title: "Question Bank",
                                desc: "Access thousands of free practice MCQs tailored for MDCAT & ECAT preparation."
                            },
                            {
                                icon: <FileText className="w-6 h-6 text-blue-500" />,
                                title: "Mock Exams",
                                desc: "Full-length mock tests designed to simulate the actual exam environment."
                            },
                            {
                                icon: <CheckCircle className="w-6 h-6 text-emerald-500" />,
                                title: "Study Materials",
                                desc: "Comprehensive notes, PDFs, and resources to cover every topic in depth."
                            },
                            {
                                icon: <History className="w-6 h-6 text-orange-500" />,
                                title: "Past Papers",
                                desc: "Building on 4 years of legacy of Medico Engineer to guide your preparation."
                            },
                            {
                                icon: <Calculator className="w-6 h-6 text-purple-500" />,
                                title: "Merit Calculators",
                                desc: "Advanced tools to calculate and predict your aggregate for various universities."
                            },
                            {
                                icon: <Newspaper className="w-6 h-6 text-pink-500" />,
                                title: "Scholarship Updates",
                                desc: "Stay informed about the latest scholarship opportunities and admissions."
                            }
                        ].map((card, i) => (
                            <ScrollReveal key={i} delay={i * 0.1}>
                                <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all h-full">
                                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800">
                                        {card.icon}
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{card.title}</h4>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{card.desc}</p>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* History Section */}
            <section className="py-20 px-4">
                <ScrollReveal>
                    <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-950 rounded-3xl p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                            <History className="w-64 h-64" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                                    <History className="w-6 h-6 text-blue-200" />
                                </div>
                                <h2 className="text-3xl font-bold">Our History</h2>
                            </div>

                            <div className="space-y-6 text-slate-200 leading-relaxed text-lg">
                                <p>
                                    <strong className="text-white">Medico Engineer</strong> was founded in <strong className="text-white">2023</strong> by <strong className="text-white">Vinode Narain</strong> and <strong className="text-white">Naveed Narain</strong>, along with a dedicated team of students passionate about education and technology.
                                </p>
                                <div className="pl-6 border-l-2 border-white/20 my-6 space-y-2">
                                    <div className="flex items-center gap-3">
                                        <Users className="w-5 h-5 text-blue-300" />
                                        <span><strong>Vinode Narain</strong> – Founder</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Users className="w-5 h-5 text-blue-300" />
                                        <span><strong>Naveed Narain</strong> – Co-Founder</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Users className="w-5 h-5 text-blue-300" />
                                        <span>Supported by academic associates & student volunteers</span>
                                    </div>
                                </div>
                                <p>
                                    The idea began with a simple goal: <span className="text-blue-200 italic">to make high-quality exam preparation accessible to every student</span>, regardless of background or financial constraint.
                                </p>
                                <p>
                                    Over time, it has grown into one of the most trusted free MDCAT resources in Pakistan, offering targeted tools and notes designed with student-focused learning in mind.
                                </p>
                            </div>

                            <div className="mt-10 flex gap-4">
                                <Link href="/auth/register">
                                    <button className="bg-white text-slate-900 px-6 py-3 rounded-full font-bold hover:bg-blue-50 transition-colors">
                                        Join Our Community
                                    </button>
                                </Link>
                                <Link href="/">
                                    <button className="px-6 py-3 rounded-full font-medium border border-white/30 hover:bg-white/10 transition-colors">
                                        Explore Platform
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </ScrollReveal>
            </section>

        </div>
    );
}
