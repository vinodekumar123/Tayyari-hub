'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Download, ChevronRight, Dot } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { UnifiedHeader } from '@/components/unified-header';
import { syllabusData } from './data';
import { generateSyllabusPDF } from '@/utils/generate-syllabus-pdf';

export default function SyllabusPage() {

    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950">
            {/* Unified Header */}
            <UnifiedHeader
                title="PMDC 2025 Syllabus"
                subtitle="Official Syllabus Breakdown & Weightage"
                icon={<BookOpen className="w-6 h-6" />}
            >
                <Button
                    onClick={generateSyllabusPDF}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <Download className="w-4 h-4" /> Download PDF
                </Button>
            </UnifiedHeader>
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">

                {/* Main Content */}
                <div className="grid grid-cols-1 gap-8">
                    {syllabusData.map((subject, idx) => (
                        <Card key={idx} className={`${glassmorphism.light} border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden`}>
                            <CardHeader className={`bg-${subject.color}-50/50 dark:bg-${subject.color}-900/10 border-b border-slate-100 dark:border-slate-800`}>
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <CardTitle className="text-2xl font-black text-slate-900 dark:text-white">
                                        {subject.subject}
                                    </CardTitle>
                                    <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        {subject.weight}
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {subject.topics.map((topic, tIdx) => (
                                        <div key={tIdx} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className={`mt-1 p-1 rounded-lg bg-${subject.color}-100 dark:bg-${subject.color}-900/30 text-${subject.color}-600 dark:text-${subject.color}-400`}>
                                                    <ChevronRight className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 space-y-3">
                                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                                                        {topic.title}
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                                        {topic.details.map((detail, dIdx) => (
                                                            <div key={dIdx} className="flex items-start gap-2 text-slate-600 dark:text-slate-400 text-sm">
                                                                <Dot className={`w-4 h-4 mt-0.5 text-${subject.color}-500 shrink-0`} />
                                                                <span>{detail}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
