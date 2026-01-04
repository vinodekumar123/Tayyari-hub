'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, FileDown, Download, CheckCircle, Clock } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { Badge } from '@/components/ui/badge';
import { UnifiedHeader } from '@/components/unified-header';

export default function SyllabusPage() {
    const [activeTab, setActiveTab] = useState('full');

    // Hardcoded syllabus data for demonstration - in real app, fetch from specific collection
    const syllabusData = [
        {
            subject: "Biology",
            topics: [
                { title: "Cell Structure and Function", status: "completed", lectures: 12, weight: "15%" },
                { title: "Biological Molecules", status: "completed", lectures: 8, weight: "10%" },
                { title: "Enzymes", status: "ongoing", lectures: 5, weight: "8%" },
                { title: "Bioenergetics", status: "pending", lectures: 10, weight: "12%" },
                { title: "Biodiversity", status: "pending", lectures: 15, weight: "20%" },
            ]
        },
        {
            subject: "Chemistry",
            topics: [
                { title: "Atomic Structure", status: "completed", lectures: 10, weight: "12%" },
                { title: "Chemical Bonding", status: "ongoing", lectures: 14, weight: "15%" },
                { title: "Gases, Liquids, and Solids", status: "pending", lectures: 12, weight: "15%" },
                { title: "Chemical Equilibrium", status: "pending", lectures: 8, weight: "10%" },
            ]
        },
        {
            subject: "Physics",
            topics: [
                { title: "Measurements", status: "completed", lectures: 4, weight: "5%" },
                { title: "Vectors and Equilibrium", status: "completed", lectures: 8, weight: "10%" },
                { title: "Motion and Force", status: "ongoing", lectures: 12, weight: "15%" },
                { title: "Work and Energy", status: "pending", lectures: 10, weight: "12%" },
            ]
        }
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Unified Header */}
            <UnifiedHeader
                title="Course Syllabus"
                subtitle="Detailed breakdown of your curriculum and progress."
                icon={<BookOpen className="w-6 h-6" />}
            >
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4" /> Download PDF
                </Button>
            </UnifiedHeader>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Navigation / Overview */}
                <div className="lg:col-span-3 space-y-8">
                    {syllabusData.map((subject, idx) => (
                        <Card key={idx} className={`${glassmorphism.light} border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden`}>
                            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="flex items-center gap-2 text-xl">
                                        <BookOpen className="w-5 h-5 text-blue-500" />
                                        {subject.subject}
                                    </CardTitle>
                                    <Badge variant="outline" className="bg-background">
                                        {subject.topics.filter(t => t.status === 'completed').length} / {subject.topics.length} Topics Done
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {subject.topics.map((topic, tIdx) => (
                                        <div key={tIdx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1">
                                                    {topic.status === 'completed' ? <CheckCircle className="w-5 h-5 text-green-500" /> :
                                                        topic.status === 'ongoing' ? <Clock className="w-5 h-5 text-amber-500" /> :
                                                            <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-700" />}
                                                </div>
                                                <div>
                                                    <h4 className={`font-semibold ${topic.status === 'completed' ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                                                        {topic.title}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Weightage: {topic.weight} • Approx {topic.lectures} Lectures
                                                    </p>
                                                </div>
                                            </div>
                                            <div>
                                                {topic.status === 'completed' && <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">Completed</Badge>}
                                                {topic.status === 'ongoing' && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">In Progress</Badge>}
                                                {topic.status === 'pending' && <Badge variant="outline" className="text-slate-400 border-slate-200">Pending</Badge>}
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
