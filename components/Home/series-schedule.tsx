"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    Zap,
    Trophy,
    Target,
    Clock,
    CheckCircle2,
    Microscope,
    FlaskConical,
    Atom,
    BrainCircuit,
    ArrowRight,
    Search,
    ChevronRight,
    Download
} from 'lucide-react';
import { freshersClassXII, freshersClassXI, improversS1, improversS2, freshersCards, flpPhases } from './schedule-data';
import { generateSchedulePDF } from '../../utils/generate-schedule-pdf';
import { SanitizedContent } from '@/components/SanitizedContent';

interface SeriesScheduleProps {
    defaultTab?: 'improver' | 'fresher' | 'flp';
    hideTabs?: boolean;
}

const SeriesSchedule = ({ defaultTab = 'improver', hideTabs = false, expandSeries = false }: { defaultTab?: 'improver' | 'fresher' | 'flp', hideTabs?: boolean, expandSeries?: boolean }) => {
    const [activeTab, setActiveTab] = useState<'improver' | 'fresher' | 'flp'>(defaultTab);
    const [improverSeries, setImproverSeries] = useState<1 | 2>(1);

    // --- Data: FLP Series ---
    // Imported from schedule-data.ts

    // Helper to render icons for freshers (since extracted data has string names)
    const getIcon = (name: string) => {
        switch (name) {
            case 'Microscope': return <Microscope className="w-6 h-6" />;
            case 'FlaskConical': return <FlaskConical className="w-6 h-6" />;
            case 'Atom': return <Atom className="w-6 h-6" />;
            case 'BrainCircuit': return <BrainCircuit className="w-6 h-6" />;
            default: return <Zap className="w-6 h-6" />;
        }
    }

    const tabs = [
        { id: 'improver', label: 'Improver Series' },
        { id: 'fresher', label: 'Fresher Series' }
    ];

    const FLPSection = () => (
        <div className="mt-16">
            <div className="max-w-4xl mx-auto mb-10">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center gap-8 text-center md:text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="bg-purple-100 dark:bg-purple-900/30 w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 mx-auto md:mx-0 relative z-10">
                        <Trophy className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 relative z-10">
                        <div className="inline-block px-3 py-1 mb-2 text-xs font-bold tracking-wider text-purple-700 bg-purple-100 rounded-full dark:bg-purple-900/30 dark:text-purple-300">
                            INCLUDED IN BOTH SERIES
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">FLP Mock Series</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">
                            Comprehensive final preparation with 26 Full-Length Papers and Subject-Wise Tests.
                        </p>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium">
                                <Calendar className="w-4 h-4" /> 01 July – 30 August
                            </span>
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium">
                                <Target className="w-4 h-4" /> 180 MCQs / Test
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {flpPhases.map((phase, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-bold text-xl text-slate-900 dark:text-white">{phase.title}</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm whitespace-nowrap w-20">Test #</th>
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm whitespace-nowrap w-24">Date</th>
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm whitespace-nowrap w-40">Type</th>
                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm">Syllabus / Topics</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {phase.tests.map((test, j) => (
                                        <tr key={j} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">#{test.test}</td>
                                            <td className="p-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{test.date}</td>
                                            <td className="p-4">
                                                <span className="inline-block px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-semibold whitespace-nowrap">
                                                    {test.type}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                <SanitizedContent content={test.syllabus} className="[&>b]:text-slate-900 [&>b]:dark:text-white [&>b]:font-semibold" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const ImproverScheduleTable = ({ data, title }: { data: typeof improversS1, title?: string }) => (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden mb-8">
            {title && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 border-b border-indigo-100 dark:border-indigo-800">
                    <h3 className="font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                        {title}
                    </h3>
                </div>
            )}
            {/* Desktop/Tablet View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                            <th className="p-5 font-bold text-slate-700 dark:text-slate-200 w-24">Test #</th>
                            <th className="p-5 font-bold text-slate-700 dark:text-slate-200 w-32">Date</th>
                            <th className="p-5 font-bold text-slate-700 dark:text-slate-200 w-24">Day</th>
                            <th className="p-5 font-bold text-slate-700 dark:text-slate-200">Subjects & Topics</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="p-5 text-slate-600 dark:text-slate-400 font-semibold">#{item.test}</td>
                                <td className="p-5 text-slate-900 dark:text-white font-medium">{item.date}</td>
                                <td className="p-5 text-slate-500 dark:text-slate-400 text-sm">{item.day}</td>
                                <td className="p-5 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                    <SanitizedContent content={item.topics} className="[&>b]:text-slate-900 [&>b]:dark:text-white [&>b]:font-semibold" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((item, i) => (
                    <div key={i} className="p-5">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <span className="inline-block px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg mb-1">
                                    Test #{item.test}
                                </span>
                                <h4 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                                    {item.date} <span className="text-slate-400 text-sm font-normal">({item.day})</span>
                                </h4>
                            </div>
                        </div>
                        <SanitizedContent content={item.topics} className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl [&>b]:text-slate-900 [&>b]:dark:text-white [&>b]:block [&>b]:mb-1 [&>b]:mt-2 [&>b]:first:mt-0" />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <section id="schedule" className="py-24 relative overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Background Decorations */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/40 dark:bg-blue-900/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/40 dark:bg-indigo-900/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
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
                        className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6"
                    >
                        Your Roadmap to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Success</span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
                    >
                        Systematic test series designed to cover every topic, rigorously test your concepts, and ensure you&apos;re exam-ready.
                    </motion.p>
                </div>

                {/* Main Tabs */}
                {!hideTabs && (
                    <div className="flex justify-center mb-12">
                        <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg inline-flex relative flex-wrap justify-center gap-1 md:gap-0">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-4 md:px-8 py-2 md:py-3 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 ${activeTab === tab.id
                                        ? 'text-white'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-md"
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="min-h-[400px]">
                    <AnimatePresence mode="wait">
                        {activeTab === 'improver' && (
                            <motion.div
                                key="improver"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="w-full"
                            >
                                {/* Expanded View or Tabbed View */}
                                {expandSeries ? (
                                    <>
                                        <div className="flex justify-center mb-12">
                                            <button
                                                onClick={() => generateSchedulePDF('improver')}
                                                className="w-full md:w-auto inline-flex justify-center items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download Schedule PDF
                                            </button>
                                        </div>
                                        <ImproverScheduleTable data={improversS1} title="Series 1" />
                                        <ImproverScheduleTable data={improversS2} title="Series 2 (Revision)" />
                                    </>
                                ) : (
                                    <>
                                        {/* Series Switcher */}
                                        <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
                                            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl inline-flex w-full md:w-auto">
                                                <button
                                                    onClick={() => setImproverSeries(1)}
                                                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${improverSeries === 1
                                                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                        }`}
                                                >
                                                    Series 1
                                                </button>
                                                <button
                                                    onClick={() => setImproverSeries(2)}
                                                    className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${improverSeries === 2
                                                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                        }`}
                                                >
                                                    Series 2 (Revision)
                                                </button>
                                            </div>
                                            {/* PDF Download Button */}
                                            <button
                                                onClick={() => generateSchedulePDF('improver')}
                                                className="w-full md:w-auto inline-flex justify-center items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download Schedule PDF
                                            </button>
                                        </div>

                                        {/* Schedule Table */}
                                        <ImproverScheduleTable data={improverSeries === 1 ? improversS1 : improversS2} />
                                    </>
                                )}

                                <FLPSection />

                                <div className="mt-8 flex justify-center">
                                    <Link href="/series/improver" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline">
                                        View Full Improver Series Details <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {activeTab === 'fresher' && (
                            <motion.div
                                key="fresher"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                {/* Class XII Schedule */}
                                <div className="space-y-8 mb-12">
                                    <div className="flex justify-between items-center mb-6">
                                        <div></div>
                                        <button
                                            onClick={() => generateSchedulePDF('fresher')}
                                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download Schedule PDF
                                        </button>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 border-b border-blue-100 dark:border-blue-800">
                                            <h3 className="font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
                                                <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                                                CLASS XII – CHAPTER-WISE + COMBINED GENERAL TESTS
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 dark:bg-slate-950/50">
                                                    <tr>
                                                        <th className="p-4 pl-6 font-bold text-slate-600 dark:text-slate-300 text-sm w-32">Date</th>
                                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm w-32">Test Code</th>
                                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm w-32">Subject</th>
                                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm">Chapter / Topic</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {freshersClassXII.map((row, idx) => (
                                                        <tr
                                                            key={idx}
                                                            className={`
                                                        ${row.isCombined ? 'bg-amber-50 dark:bg-amber-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} 
                                                        transition-colors
                                                        ${row.isFull ? 'bg-purple-50 dark:bg-purple-900/20 !border-l-4 !border-l-purple-500' : ''}
                                                    `}
                                                        >
                                                            <td className="p-4 pl-6 text-slate-900 dark:text-white font-medium whitespace-nowrap">{row.date}</td>
                                                            <td className="p-4">
                                                                <span className={`
                                                            inline-block px-2 py-1 rounded-lg text-xs font-bold
                                                            ${row.isCombined
                                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}
                                                            ${row.isFull ? '!bg-purple-100 !text-purple-700 dark:!bg-purple-900/40 dark:!text-purple-300' : ''}
                                                        `}>
                                                                    {row.code}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                                                                {row.subject || (row.isCombined ? <span className="text-amber-600 dark:text-amber-400 font-bold">Combined Test</span> : '-')}
                                                            </td>
                                                            <td className={`p-4 text-sm ${row.isCombined ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                {row.topic}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Class XI Schedule */}
                                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 border-b border-emerald-100 dark:border-emerald-800">
                                            <h3 className="font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
                                                <span className="w-2 h-8 bg-emerald-600 rounded-full"></span>
                                                CLASS XI – CHAPTER-WISE + COMBINED GENERAL TESTS
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 dark:bg-slate-950/50">
                                                    <tr>
                                                        <th className="p-4 pl-6 font-bold text-slate-600 dark:text-slate-300 text-sm w-32">Date</th>
                                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm w-32">Test Code</th>
                                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm w-32">Subject</th>
                                                        <th className="p-4 font-bold text-slate-600 dark:text-slate-300 text-sm">Chapter / Topic</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                    {freshersClassXI.map((row, idx) => (
                                                        <tr
                                                            key={idx}
                                                            className={`
                                                        ${row.isCombined ? 'bg-emerald-50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} 
                                                        transition-colors
                                                        ${row.isFull ? 'bg-purple-50 dark:bg-purple-900/20 !border-l-4 !border-l-purple-500' : ''}
                                                    `}
                                                        >
                                                            <td className="p-4 pl-6 text-slate-900 dark:text-white font-medium whitespace-nowrap">{row.date}</td>
                                                            <td className="p-4">
                                                                <span className={`
                                                            inline-block px-2 py-1 rounded-lg text-xs font-bold
                                                            ${row.isCombined
                                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}
                                                            ${row.isFull ? '!bg-purple-100 !text-purple-700 dark:!bg-purple-900/40 dark:!text-purple-300' : ''}
                                                        `}>
                                                                    {row.code}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-slate-600 dark:text-slate-400 font-medium">
                                                                {row.subject || (row.isCombined ? <span className="text-emerald-600 dark:text-emerald-400 font-bold">Combined Test</span> : '-')}
                                                            </td>
                                                            <td className={`p-4 text-sm ${row.isCombined ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                                                                {row.topic}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <FLPSection />

                                <div className="mt-8 flex justify-center">
                                    <Link href="/series/fresher" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold hover:underline">
                                        View Full Fresher Series Details <ArrowRight className="w-4 h-4" />
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section >
    );
};

export default SeriesSchedule;
