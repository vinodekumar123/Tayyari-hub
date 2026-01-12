"use client";

import React, { useState } from 'react';
import {
    BookOpen, Brain, Trophy, Smartphone, Users,
    CheckCircle2, Flame, Shield, Star, Zap,
    Clock, Filter, Award, Play, Settings, Lock, Target
} from 'lucide-react';
import { SpotlightCard } from "@/components/ui/spotlight";

/* --- DATA CONFIGURATION --- */
const FEATURES_DATA = [
    {
        id: 'core',
        label: 'Self-Assessment',
        color: 'blue',
        icon: <BookOpen className="w-5 h-5" />,
        items: [
            { title: "Extensive Quiz Library", desc: "Access 20,000+ high-yield MCQs standardized to PMDC patterns." },
            { title: "Topic-Wise Tests", desc: "Create custom quizzes for specific topics to target your weak areas." },
            { title: "Mock Exams", desc: "Simulate the real exam environment with full-length self-assessment papers." },
            { title: "Instant Feedback", desc: "Get immediate results and detailed performance analysis after every quiz." },
            { title: "Difficulty Levels", desc: "Practice with Easy, Medium, and Hard questions to build confidence progressively." },
            { title: "Negative Marking", desc: "Enable negative marking to master risk management and accuracy." },
            { title: "Smart Syllabus", desc: "Content strictly aligned with the latest syllabus and textbooks." },
            { title: "Past Papers", desc: "Solve chapter-wise past papers to understand exam trends." },
        ]
    },
    {
        id: 'analytics',
        label: 'Explanations & Analysis',
        color: 'violet',
        icon: <Brain className="w-5 h-5" />,
        items: [
            { title: "Detailed Explanations", desc: "Step-by-step textual explanations for every single question." },
            { title: "Concept Clarity", desc: "Understand the 'Why' behind every answer to build strong concepts." },
            { title: "Weakness Analysis", desc: "AI identifies your weak topics and suggests targeted practice." },
            { title: "Performance Graphs", desc: "Track your improvement over time with detailed visual analytics." },
            { title: "Time Tracking", desc: "Analyze time spent per question to improve your speed and efficiency." },
            { title: "Error Log", desc: "Automatically save incorrect questions to review and master them later." },
            { title: "Save & Resume", desc: "Your progress is saved automatically. Resume your test anytime, anywhere." },
        ]
    },
    {
        id: 'doubt',
        label: 'Doubt Solving',
        color: 'teal',
        icon: <Users className="w-5 h-5" />,
        items: [
            { title: "Expert Support", desc: "Get your doubts clarified by subject matter experts and toppers." },
            { title: "Community Discussions", desc: "Discuss tricky questions with a community of like-minded students." },
            { title: "Peer Learning", desc: "Share knowledge and learn from the experiences of other aspirants." },
            { title: "24/7 Access", desc: "Post your queries anytime and get them resolved quickly." },
            { title: "Verified Answers", desc: "Ensure you earn the correct concepts with teacher-verified solutions." },
        ]
    },
    {
        id: 'gamification',
        label: 'Gamification',
        color: 'orange',
        icon: <Trophy className="w-5 h-5" />,
        items: [
            { title: "XP & Levels", desc: "Earn XP for every correct answer and level up your profile." },
            { title: "Leaderboards", desc: "Compete with students across the country and see your rank." },
            { title: "Daily Streaks", desc: "Maintain your study consistency and build a daily habit." },
            { title: "Badges", desc: "Unlock achievements for reaching practice milestones." },
        ]
    },
    {
        id: 'ux',
        label: 'Platform Experience',
        color: 'rose',
        icon: <Smartphone className="w-5 h-5" />,
        items: [
            { title: "Dark Mode", desc: "Study comfortably at night with a fully integrated dark theme." },
            { title: "Mobile Friendly", desc: "Practice on the go with a seamless mobile experience." },
            { title: "Distraction Free", desc: "Clean interface designed purely for focused learning." },
            { title: "Bookmarks", desc: "Save important questions to revise before the exam." },
        ]
    }
];

const getColorVariants = (color: string) => {
    const variants: any = {
        blue: {
            activeTab: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-2 ring-blue-500/20",
            icon: "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
            itemHover: "group-hover:border-blue-500/30 group-hover:text-blue-600 dark:group-hover:text-blue-400"
        },
        violet: {
            activeTab: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 ring-2 ring-violet-500/20",
            icon: "bg-violet-100 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400",
            itemHover: "group-hover:border-violet-500/30 group-hover:text-violet-600 dark:group-hover:text-violet-400"
        },
        orange: {
            activeTab: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 ring-2 ring-orange-500/20",
            icon: "bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
            itemHover: "group-hover:border-orange-500/30 group-hover:text-orange-600 dark:group-hover:text-orange-400"
        },
        teal: {
            activeTab: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 ring-2 ring-teal-500/20",
            icon: "bg-teal-100 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400",
            itemHover: "group-hover:border-teal-500/30 group-hover:text-teal-600 dark:group-hover:text-teal-400"
        },
        rose: {
            activeTab: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 ring-2 ring-rose-500/20",
            icon: "bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
            itemHover: "group-hover:border-rose-500/30 group-hover:text-rose-600 dark:group-hover:text-rose-400"
        }
    };
    return variants[color] || variants.blue;
};

/* --- COMPONENT 1: HERO STATS BAR --- */
const StatsBar = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl mx-auto mb-16">
        {[
            { label: "Question Bank", value: "20,000+", icon: <BookOpen className="text-blue-500" /> },
            { label: "Past Papers", value: "Available", icon: <Clock className="text-violet-500" /> },
            { label: "Community", value: "Active", icon: <Users className="text-teal-500" /> },
            { label: "Access", value: "24/7", icon: <Zap className="text-orange-500" /> },
        ].map((stat, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center transform transition-transform hover:-translate-y-1">
                <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-full">
                    {stat.icon}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
            </div>
        ))}
    </div>
);

/* --- COMPONENT 2: GAMIFICATION WIDGET (HUD) --- */
const GamificationHUD = () => (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden border border-slate-700 w-full max-w-sm mx-auto">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 blur-[80px] opacity-20"></div>

        <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 p-1">
                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center">
                    <span className="text-2xl">👨‍⚕️</span>
                </div>
            </div>
            <div>
                <h3 className="font-bold text-lg">Dr. Hamza Ali</h3>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded text-xs font-semibold border border-blue-500/30">Level 5</span>
                    <span>Scholar</span>
                </div>
            </div>
        </div>

        {/* XP Bar */}
        <div className="mb-6">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
                <span>2,450 XP</span>
                <span>Next: 3,000</span>
            </div>
            <div className="h-3 w-full bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-teal-400 w-[82%] shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-700/50 p-3 rounded-xl border border-slate-600 flex flex-col items-center">
                <Flame className="w-6 h-6 text-orange-400 mb-1" />
                <span className="text-xl font-bold">12</span>
                <span className="text-xs text-slate-400">Day Streak</span>
            </div>
            <div className="bg-slate-700/50 p-3 rounded-xl border border-slate-600 flex flex-col items-center">
                <Award className="w-6 h-6 text-yellow-400 mb-1" />
                <span className="text-xl font-bold">#42</span>
                <span className="text-xs text-slate-400">Rank</span>
            </div>
        </div>

        {/* Badges */}
        <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Badges</h4>
            <div className="flex gap-2">
                {[
                    { icon: <Zap className="w-4 h-4" />, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" },
                    { icon: <Brain className="w-4 h-4" />, color: "bg-purple-500/20 text-purple-400 border-purple-500/50" },
                    { icon: <Target className="w-4 h-4" />, color: "bg-red-500/20 text-red-400 border-red-500/50" },
                ].map((badge, i) => (
                    <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center border ${badge.color}`}>
                        {badge.icon}
                    </div>
                ))}
                <div className="w-10 h-10 rounded-full flex items-center justify-center border border-dashed border-slate-600 text-slate-500 text-xs">
                    +8
                </div>
            </div>
        </div>
    </div>
);

/* --- COMPONENT 3: TEST CREATOR MOCKUP --- */
const TestCreatorMockup = () => {
    const [isNegativeOn, setIsNegativeOn] = useState(true);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden w-full max-w-sm mx-auto flex flex-col">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Custom Test
                </h3>
                <span className="text-xs bg-white/20 px-2 py-1 rounded">Pro Feature</span>
            </div>

            <div className="p-5 space-y-5">
                {/* Subject Selection */}
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Select Subjects</label>
                    <div className="flex gap-2">
                        {['Bio', 'Phy', 'Chem', 'Eng'].map((sub, i) => (
                            <button key={i} suppressHydrationWarning className={`flex-1 py-2 text-sm font-medium rounded-lg border ${i === 1 ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                                {sub}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Difficulty Slider Mock */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-slate-700 dark:text-slate-200">Difficulty</span>
                        <span className="text-orange-500 font-bold">Hard</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full relative">
                        <div className="absolute left-0 top-0 h-full w-3/4 bg-orange-500 rounded-full"></div>
                        <div className="absolute right-[25%] top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-orange-500 rounded-full shadow-sm"></div>
                    </div>
                </div>

                {/* Elegant Mode Selection */}
                <div
                    onClick={() => setIsNegativeOn(!isNegativeOn)}
                    className="group cursor-pointer flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl transition-colors duration-300 ${isNegativeOn ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                            <Lock className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Negative Marking</span>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Master Risk Control</span>
                        </div>
                    </div>

                    <div className={`w-12 h-6 rounded-full transition-colors duration-300 relative ${isNegativeOn ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ease-out ${isNegativeOn ? 'right-1' : 'right-7'}`} />
                    </div>
                </div>

                <button suppressHydrationWarning className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    <Play className="w-4 h-4 fill-current" /> Start Test
                </button>
            </div>
        </div>
    );
};

/* --- MAIN COMPONENT: FEATURES SHOWCASE --- */
const FeaturesBento = () => {
    const [activeTab, setActiveTab] = useState(FEATURES_DATA[0].id);

    const activeCategory = FEATURES_DATA.find(c => c.id === activeTab) || FEATURES_DATA[0];
    const variants = getColorVariants(activeCategory.color);

    return (
        <div id="features" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-12 font-sans relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/20 dark:bg-blue-900/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

            {/* Header Section */}
            <div className="max-w-4xl mx-auto text-center mb-12 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
                    <Star className="w-3 h-3 fill-current" /> 40+ Premium Features
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold mb-6 leading-tight">
                    Everything You Need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-teal-500">Ace MDCAT</span>
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                    Tayyari Hub isn&apos;t just a website; it&apos;s a complete digital ecosystem designed to replace traditional academies with smarter, faster, and 24/7 preparation.
                </p>
            </div>

            <StatsBar />

            <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto relative z-10">

                {/* Left Side: Navigation & Content */}
                <div className="lg:w-2/3">

                    {/* Tabs Navigation */}
                    <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
                        {FEATURES_DATA.map((cat) => {
                            const catVars = getColorVariants(cat.color);
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveTab(cat.id)}
                                    suppressHydrationWarning
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200
                  ${activeTab === cat.id
                                            ? catVars.activeTab
                                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    {cat.icon}
                                    {cat.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Feature Grid */}
                    <div className="grid md:grid-cols-2 gap-4">
                        {activeCategory.items.map((item, idx) => (
                            <SpotlightCard
                                key={idx}
                                className={`group p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-200 ${variants.itemHover}`}
                            >
                                <div className="flex items-start gap-3 relative z-10">
                                    <div className={`mt-1 p-1.5 rounded-full shrink-0 ${variants.icon}`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-slate-800 dark:text-slate-100 text-lg mb-1 transition-colors ${variants.itemHover.split(" ")[2]}`}>
                                            {item.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {item.desc}
                                        </p>
                                    </div>
                                </div>
                            </SpotlightCard>
                        ))}
                    </div>

                </div>

                {/* Right Side: Interactive Visuals */}
                <div className="lg:w-1/3 flex flex-col gap-6 lg:pt-20">
                    {/* Conditional Rendering based on active tab to show relevant "Mini App" view */}

                    {activeTab === 'gamification' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-4">
                                <span className="text-xs font-bold text-slate-400 uppercase">Live Preview</span>
                            </div>
                            <GamificationHUD />
                        </div>
                    ) : activeTab === 'ux' || activeTab === 'core' || activeTab === 'doubt' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-4">
                                <span className="text-xs font-bold text-slate-400 uppercase">Custom Test Interface</span>
                            </div>
                            <TestCreatorMockup />
                        </div>
                    ) : (
                        <div className="bg-indigo-600 rounded-3xl p-8 text-white text-center flex flex-col items-center justify-center h-full min-h-[300px]">
                            <Shield className="w-16 h-16 mb-4 opacity-80" />
                            <h3 className="text-2xl font-bold mb-2">Premium Experience</h3>
                            <p className="opacity-80 text-sm mb-6">Join thousands of students securing their medical seats.</p>
                            <button suppressHydrationWarning className="bg-white text-indigo-700 px-6 py-3 rounded-full font-bold hover:bg-indigo-50 transition-colors w-full">
                                Start Free Trial
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default FeaturesBento;
