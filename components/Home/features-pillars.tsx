"use client";

import React, { useState } from 'react';
import {
    BookOpen,
    Trophy,
    Users,
    BarChart2,
    CheckCircle,
    ArrowRight,
    Sparkles,
    MessageCircle,
    TrendingUp,
    Target
} from 'lucide-react';

const FeaturesPillars = () => {
    const [activeTab, setActiveTab] = useState(0);

    const pillars = [
        {
            id: "hub",
            title: "Comprehensive Study Hub",
            icon: BookOpen,
            iconColor: "text-blue-600",
            checkColor: "text-blue-600",
            description: "A complete ecosystem for preparation with smart content organization.",
            features: [
                "Smart library organized by Subject, Chapter, & Province",
                "High-quality notes & revision materials",
                "Real-time mock exams with exam-like timers",
                "Instant analysis with detailed explanations"
            ],
            gradient: "from-blue-500 to-cyan-500",
            bgGradient: "from-blue-50 to-cyan-50"
        },
        {
            id: "gamification",
            title: "Gamified Learning",
            icon: Trophy,
            iconColor: "text-purple-600",
            checkColor: "text-purple-600",
            description: "Make learning addictive with our dynamic reward system.",
            features: [
                "National Leaderboards & Hall of Fame",
                "Earn XP, Points, & Badges for consistency",
                "Interactive interface that kills boredom",
                "Compete with students nationwide"
            ],
            gradient: "from-purple-500 to-pink-500",
            bgGradient: "from-purple-50 to-pink-50"
        },
        {
            id: "community",
            title: "Collaborative Community",
            icon: Users,
            iconColor: "text-emerald-600",
            checkColor: "text-emerald-600",
            description: "Never learn alone. Connect, discuss, and grow together.",
            features: [
                "'Ask a Doubt' forum with peer support",
                "Filter discussions by Province & Chapter",
                "Upvote system for top-quality answers",
                "Mentorship from toppers & teachers"
            ],
            gradient: "from-emerald-500 to-teal-500",
            bgGradient: "from-emerald-50 to-teal-50"
        },
        {
            id: "analytics",
            title: "Advanced Analytics",
            icon: TrendingUp,
            iconColor: "text-orange-600",
            checkColor: "text-orange-600",
            description: "Data-driven insights to pinpoint your weak areas.",
            features: [
                "Visual progress tracking graphs",
                "Subject & Chapter-wise weakness analysis",
                "Personalized improvement strategies",
                "Score prediction & performance trends"
            ],
            gradient: "from-orange-500 to-amber-500",
            bgGradient: "from-orange-50 to-amber-50"
        }
    ];

    return (
        <section id="features" className="py-24 relative overflow-hidden bg-white">
            {/* Background Decor */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className="container mx-auto px-6 relative z-10">

                {/* Header */}
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-600 font-semibold text-sm mb-6 animate-fade-in">
                        <Sparkles className="w-4 h-4" />
                        <span>Why Choose TayyariHub?</span>
                    </div>

                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight">
                        A Complete <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Student Ecosystem</span>
                    </h2>

                    <p className="text-lg text-slate-600 leading-relaxed">
                        We don&apos;t just provide content—we provide a complete environment designed to keep you consistent, motivated, and exam-ready.
                    </p>
                </div>

                {/* Desktop Layout: Tabs & Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

                    {/* Navigation/Pillars List */}
                    <div className="lg:col-span-5 space-y-4">
                        {pillars.map((pillar, index) => {
                            const isActive = activeTab === index;
                            return (
                                <div
                                    key={index}
                                    onClick={() => setActiveTab(index)}
                                    className={`group cursor-pointer p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden ${isActive
                                        ? 'bg-white border-blue-200 shadow-xl scale-105 z-10'
                                        : 'bg-white/50 border-transparent hover:bg-white hover:border-slate-100 hover:shadow-lg'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${isActive
                                            ? `bg-gradient-to-br ${pillar.gradient} text-white shadow-lg`
                                            : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                                            }`}>
                                            <pillar.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className={`text-lg font-bold transition-colors ${isActive ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-900'
                                                }`}>
                                                {pillar.title}
                                            </h3>
                                            {isActive && (
                                                <p className="text-sm text-slate-500 mt-1 animate-fade-in line-clamp-1">
                                                    {pillar.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {isActive && (
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${pillar.gradient}`}></div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Active Content Display */}
                    <div className="lg:col-span-7">
                        <div className="relative bg-white rounded-3xl border border-slate-100 shadow-2xl overflow-hidden min-h-[500px]">
                            {/* Dynamic Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${pillars[activeTab].bgGradient} opacity-50 transition-colors duration-500`}></div>

                            <div className="relative p-8 md:p-12 h-full flex flex-col justify-center">
                                <div className="flex items-start justify-between mb-8">
                                    <div className={`p-4 rounded-2xl bg-white shadow-sm inline-block`}>
                                        {React.createElement(pillars[activeTab].icon, {
                                            className: `w-10 h-10 ${pillars[activeTab].iconColor}`
                                        } as any)}
                                    </div>
                                    <div className="hidden md:block">
                                        <span className="text-9xl font-black text-slate-900/5 select-none">
                                            0{activeTab + 1}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="text-3xl font-bold text-slate-900 mb-4">
                                    {pillars[activeTab].title}
                                </h3>
                                <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                                    {pillars[activeTab].description}
                                </p>

                                <div className="space-y-4">
                                    {pillars[activeTab].features.map((feature, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-white/60 p-3 rounded-xl backdrop-blur-sm border border-white/50 animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                                            <CheckCircle className={`w-5 h-5 flex-shrink-0 ${pillars[activeTab].checkColor}`} />
                                            <span className="font-medium text-slate-700">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-10">
                                    <a href="#" className="inline-flex items-center gap-2 font-bold text-blue-600 hover:text-blue-700 group transition-colors">
                                        Learn more about features
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </a>
                                </div>

                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default FeaturesPillars;
