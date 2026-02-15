'use client';

import React from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { ResultType } from '@/hooks/useStudentResults';

interface ResultsFiltersProps {
    viewType: ResultType;
    setViewType: (val: ResultType) => void;
    search: string;
    setSearch: (val: string) => void;
    selectedSubject: string;
    setSelectedSubject: (val: string) => void;
    selectedChapter: string;
    setSelectedChapter: (val: string) => void;
    subjects: string[];
    chapters: string[];
}

export function ResultsFilters({
    viewType, setViewType,
    search, setSearch,
    selectedSubject, setSelectedSubject,
    selectedChapter, setSelectedChapter,
    subjects, chapters
}: ResultsFiltersProps) {
    return (
        <>
            {/* Quiz Type Toggle */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-slate-800 mb-6 inline-flex">
                <button
                    onClick={() => setViewType('admin')}
                    className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${viewType === 'admin'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                >
                    Admin Quizzes
                </button>
                <button
                    onClick={() => setViewType('user')}
                    className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${viewType === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                        }`}
                >
                    User Quizzes
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <Filter className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                            placeholder="Search by title, subject or course..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-12 border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
                        />
                    </div>

                    <Select
                        value={selectedSubject}
                        onValueChange={(val) => {
                            setSelectedSubject(val);
                            setSelectedChapter('all');
                        }}
                    >
                        <SelectTrigger className="h-12 border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white">
                            <SelectValue placeholder="Filter by Subject" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                            <SelectItem value="all" className="dark:text-white dark:focus:bg-slate-700">All Subjects</SelectItem>
                            {subjects.map((subj, idx) => (
                                <SelectItem key={idx} value={subj} className="dark:text-white dark:focus:bg-slate-700">{subj}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={selectedChapter}
                        onValueChange={setSelectedChapter}
                        disabled={viewType === 'user' || chapters.length === 0}
                    >
                        <SelectTrigger className="h-12 border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white">
                            <SelectValue placeholder="Filter by Chapter" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                            <SelectItem value="all" className="dark:text-white dark:focus:bg-slate-700">All Chapters</SelectItem>
                            {chapters.map((ch, idx) => (
                                <SelectItem key={idx} value={ch} className="dark:text-white dark:focus:bg-slate-700">{ch}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </>
    );
}
