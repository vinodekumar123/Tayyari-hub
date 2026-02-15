'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Download, Search } from 'lucide-react';
import { UnifiedHeader } from '@/components/unified-header';
import { syllabusData } from './data';
import { generateSyllabusPDF } from '@/utils/generate-syllabus-pdf';
import { SyllabusCard } from '@/components/syllabus/SyllabusCard';

export default function SyllabusPage() {
    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounce search to avoid re-rendering on every keystroke
    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setSearchQuery(value), 300);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950">
            {/* Unified Header */}
            <UnifiedHeader
                title="PMDC 2025 Syllabus"
                subtitle="Official Syllabus Breakdown & Weightage"
                icon={<BookOpen className="w-6 h-6" />}
            >
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search topics..."
                            value={searchInput}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9 h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                    </div>
                    <Button
                        onClick={generateSyllabusPDF}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
                    >
                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download PDF</span>
                    </Button>
                </div>
            </UnifiedHeader>

            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
                {/* Main Content */}
                <div className="grid grid-cols-1 gap-8">
                    {syllabusData.map((subject, idx) => (
                        <SyllabusCard
                            key={idx}
                            subject={subject as any}
                            searchQuery={searchQuery}
                        />
                    ))}
                    {/* Empty State */}
                    {searchQuery && syllabusData.every(subject => {
                        const query = searchQuery.toLowerCase();
                        return !subject.topics.some(t =>
                            t.title.toLowerCase().includes(query) ||
                            t.details.some(d => d.toLowerCase().includes(query))
                        );
                    }) && (
                            <div className="text-center py-12">
                                <p className="text-slate-500 dark:text-slate-400">No topics found matching &quot;{searchQuery}&quot;</p>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}
