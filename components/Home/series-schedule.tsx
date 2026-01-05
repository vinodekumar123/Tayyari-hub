"use client";

import React, { useState } from 'react';
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
import { freshersClassXII, freshersClassXI, improversS1, improversS2, freshersCards } from './schedule-data';
import { generateSchedulePDF } from '../../utils/generate-schedule-pdf';

const SeriesSchedule = () => {
    const [activeTab, setActiveTab] = useState<'improver' | 'fresher' | 'flp'>('improver');
    const [improverSeries, setImproverSeries] = useState<1 | 2>(1);


    // --- Data: FLP Series ---
    const flpPhases = [
        {
            title: "PHASE–1: SUBJECT-WISE FOUNDATION TESTS (100 MCQs)",
            tests: [
                { test: 1, date: "01 Jul", type: "Subject Test", syllabus: "<b>Full XI Biology</b> (All XI chapters)" },
                { test: 2, date: "03 Jul", type: "Subject Test", syllabus: "<b>Full XII Biology</b> (All XII chapters)" },
                { test: 3, date: "05 Jul", type: "Subject Test", syllabus: "<b>Full XI Chemistry</b> (All XI chapters)" },
                { test: 4, date: "07 Jul", type: "Subject Test", syllabus: "<b>Full XII Chemistry</b> (All XII chapters)" },
                { test: 5, date: "09 Jul", type: "Subject Test", syllabus: "<b>Full XI Physics</b> (All XI chapters)" },
                { test: 6, date: "11 Jul", type: "Subject Test", syllabus: "<b>Full XII Physics</b> (All XII chapters)" },
                { test: 7, date: "13 Jul", type: "Subject Test", syllabus: "<b>Full English</b> (All topics)" },
                { test: 8, date: "15 Jul", type: "Subject Test", syllabus: "<b>Full Logical Reasoning</b> (All topics)" },
            ]
        },
        {
            title: "PHASE–2: XI MOCK TESTS (180 MCQs)",
            tests: [
                {
                    test: 9, date: "17 Jul", type: "XI MOCK – 1st HALF",
                    syllabus: `<b>Biology XI (1st Half):</b> Biological Molecules, Enzymes, Cell Structure & Function, Bioenergetics, Acellular Life<br/>
                    <b>Chemistry XI (1st Half):</b> Stoichiometry, Atomic Structure, Chemical Bonding, State of Matter (Gases)<br/>
                    <b>Physics XI (1st Half):</b> Kinematics, Dynamics, Rotational & Circular Motion, Work, Power & Energy<br/>
                    <b>English:</b> Complete<br/><b>Logical Reasoning:</b> Complete`
                },
                {
                    test: 10, date: "19 Jul", type: "XI MOCK – 2nd HALF",
                    syllabus: `<b>Biology XI (2nd Half):</b> Holozoic Nutrition, Circulation, Immunity, Gaseous Exchange<br/>
                    <b>Chemistry XI (2nd Half):</b> Solids & Liquids, Equilibrium, Kinetics, Thermochemistry, Electrochemistry<br/>
                    <b>Physics XI (2nd Half):</b> Fluid Dynamics, Electric Fields, Capacitors, DC Circuits, Oscillations, Acoustics<br/>
                    <b>English:</b> Complete<br/><b>Logical Reasoning:</b> Complete`
                },
                { test: 11, date: "21 Jul", type: "FULL XI MOCK", syllabus: "Full XI + English + Logical" },
                { test: 12, date: "23 Jul", type: "FULL XI MOCK", syllabus: "Full XI + English + Logical" },
                { test: 13, date: "25 Jul", type: "FULL XI MOCK", syllabus: "Full XI + English + Logical" },
            ]
        },
        {
            title: "PHASE–3: XII MOCK TESTS (180 MCQs)",
            tests: [
                {
                    test: 14, date: "27 Jul", type: "XII MOCK – 1st HALF",
                    syllabus: `<b>Biology XII (1st Half):</b> Homeostasis, Support & Movement, Nervous Coordination, Reproduction<br/>
                    <b>Chemistry XII (1st Half):</b> Representative Elements, D-Block, Organic Compounds, Nomenclature, Hydrocarbons<br/>
                    <b>Physics XII (1st Half):</b> Gas Theory, Thermodynamics, Magnetic Field, Induction<br/>
                    <b>English:</b> Complete<br/><b>Logical Reasoning:</b> Complete`
                },
                {
                    test: 15, date: "29 Jul", type: "XII MOCK – 2nd HALF",
                    syllabus: `<b>Biology XII (2nd Half):</b> Inheritance, Evolution, Biotechnology<br/>
                    <b>Chemistry XII (2nd Half):</b> Alkyl Halides, Alcohols, Aldehydes, Carboxylic Acids, Biochemistry, Industrial<br/>
                    <b>Physics XII (2nd Half):</b> AC, Electronics, Quantum, Atomic & Nuclear Physics<br/>
                    <b>English:</b> Complete<br/><b>Logical Reasoning:</b> Complete`
                },
                { test: 16, date: "31 Jul", type: "FULL XII MOCK", syllabus: "Full XII + English + Logical" },
                { test: 17, date: "03 Aug", type: "FULL XII MOCK", syllabus: "Full XII + English + Logical" },
                { test: 18, date: "06 Aug", type: "FULL XII MOCK", syllabus: "Full XII + English + Logical" },
            ]
        },
        {
            title: "PHASE–4: FLPs (FULL LENGTH PAPERS – 180 MCQs)",
            tests: [
                { test: 19, date: "09 Aug", type: "FLP-1", syllabus: "Full XI + XII (All Subjects)" },
                { test: 20, date: "12 Aug", type: "FLP-2", syllabus: "Full XI + XII (All Subjects)" },
                { test: 21, date: "15 Aug", type: "FLP-3", syllabus: "Full XI + XII (All Subjects)" },
                { test: 22, date: "18 Aug", type: "FLP-4", syllabus: "Full XI + XII (All Subjects)" },
                { test: 23, date: "21 Aug", type: "FLP-5", syllabus: "Full XI + XII (All Subjects)" },
                { test: 24, date: "24 Aug", type: "FLP-6", syllabus: "Full XI + XII (All Subjects)" },
                { test: 25, date: "27 Aug", type: "FLP-7", syllabus: "Full XI + XII (All Subjects)" },
                { test: 26, date: "30 Aug", type: "FLP-8", syllabus: "Full XI + XII (All Subjects)" },
            ]
        }
    ];


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
                        Systematic test series designed to cover every topic, rigorously test your concepts, and ensure you're exam-ready.
                    </motion.p>
                </div>

                {/* Main Tabs */}
                <div className="flex justify-center mb-12">
                    <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg inline-flex relative flex-wrap justify-center gap-1 md:gap-0">
                        {[
                            { id: 'improver', label: 'Improver Series' },
                            { id: 'fresher', label: 'Fresher Series' },
                            { id: 'flp', label: 'FLP Series' }
                        ].map((tab) => (
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
                                {/* Series Switcher */}
                                <div className="flex justify-center mb-8">
                                    <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl inline-flex">
                                        <button
                                            onClick={() => setImproverSeries(1)}
                                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${improverSeries === 1
                                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                                }`}
                                        >
                                            Series 1
                                        </button>
                                        <button
                                            onClick={() => setImproverSeries(2)}
                                            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${improverSeries === 2
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
                                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download Schedule PDF
                                    </button>
                                </div>

                                {/* Schedule Table */}
                                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
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
                                                {(improverSeries === 1 ? improversS1 : improversS2).map((item, i) => (
                                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-5 text-slate-600 dark:text-slate-400 font-semibold">#{item.test}</td>
                                                        <td className="p-5 text-slate-900 dark:text-white font-medium">{item.date}</td>
                                                        <td className="p-5 text-slate-500 dark:text-slate-400 text-sm">{item.day}</td>
                                                        <td className="p-5 text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                                            <div dangerouslySetInnerHTML={{ __html: item.topics }} className="[&>b]:text-slate-900 [&>b]:dark:text-white [&>b]:font-semibold" />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile View (Cards) */}
                                    <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                                        {(improverSeries === 1 ? improversS1 : improversS2).map((item, i) => (
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
                                                <div
                                                    className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl [&>b]:text-slate-900 [&>b]:dark:text-white [&>b]:block [&>b]:mb-1 [&>b]:mt-2 [&>b]:first:mt-0"
                                                    dangerouslySetInnerHTML={{ __html: item.topics }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'fresher' && (
                            <motion.div
                                key="fresher"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                                    {freshersCards.map((item, i) => (
                                        <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
                                            <div className={`w-14 h-14 rounded-2xl bg-${item.color}-50 dark:bg-${item.color}-900/20 flex items-center justify-center text-${item.color}-600 dark:text-${item.color}-400 mb-6`}>
                                                {getIcon(item.icon)}
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
                                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <span className="font-bold text-slate-900 dark:text-white">{item.stats}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

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
                            </motion.div>
                        )}

                        {activeTab === 'flp' && (
                            <motion.div
                                key="flp"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="w-full"
                            >
                                <div className="max-w-4xl mx-auto mb-10">
                                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                                        <div className="bg-purple-100 dark:bg-purple-900/30 w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 mx-auto md:mx-0">
                                            <Trophy className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="flex-1">
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
                                                                    <div dangerouslySetInnerHTML={{ __html: test.syllabus }} className="[&>b]:text-slate-900 [&>b]:dark:text-white [&>b]:font-semibold" />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </div>
        </section>
    );
};

export default SeriesSchedule;
