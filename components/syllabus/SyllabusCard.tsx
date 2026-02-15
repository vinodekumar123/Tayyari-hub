'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Dot } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';

interface Topic {
    title: string;
    details: string[];
}

export interface SyllabusSubject {
    subject: string;
    weight: string;
    color: string;
    topics: Topic[];
}

interface SyllabusCardProps {
    subject: SyllabusSubject;
    searchQuery: string;
}

export function SyllabusCard({ subject, searchQuery }: SyllabusCardProps) {
    // Filter topics based on search
    const filteredTopics = subject.topics.filter(topic => {
        const query = searchQuery.toLowerCase();
        return (
            topic.title.toLowerCase().includes(query) ||
            topic.details.some(d => d.toLowerCase().includes(query))
        );
    });

    if (filteredTopics.length === 0 && searchQuery) {
        return null; // Hide card if no topics match search
    }

    // Use filtered topics if searching, otherwise all topics
    const displayTopics = searchQuery ? filteredTopics : subject.topics;

    return (
        <Card className={`${glassmorphism.light} border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden`}>
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
                    {displayTopics.map((topic, tIdx) => (
                        <div key={tIdx} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                            <div className="flex items-start gap-4">
                                <div className={`mt-1 p-1 rounded-lg bg-${subject.color}-100 dark:bg-${subject.color}-900/30 text-${subject.color}-600 dark:text-${subject.color}-400`}>
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {highlightText(topic.title, searchQuery)}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                        {topic.details.map((detail, dIdx) => (
                                            <div key={dIdx} className="flex items-start gap-2 text-slate-600 dark:text-slate-400 text-sm">
                                                <Dot className={`w-4 h-4 mt-0.5 text-${subject.color}-500 shrink-0`} />
                                                <span>{highlightText(detail, searchQuery)}</span>
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
    );
}

// Helper to highlight search terms
function highlightText(text: string, query: string) {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-white rounded px-0.5">
                        {part}
                    </span>
                ) : part
            )}
        </>
    );
}
