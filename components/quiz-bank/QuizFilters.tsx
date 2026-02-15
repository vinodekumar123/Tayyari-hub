'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

export interface QuizFiltersState {
    search: string;
    status: string;
    series: string;
}

interface QuizFiltersProps {
    filters: QuizFiltersState;
    onChange: (newFilters: QuizFiltersState) => void;
    seriesList: { id: string; name: string }[];
}

export function QuizFilters({ filters, onChange, seriesList }: QuizFiltersProps) {
    const handleChange = (key: keyof QuizFiltersState, value: string) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <Card className={cn(glassmorphism.light, "border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl")}>
            <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-2 md:col-span-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            placeholder="Search quizzes..."
                            value={filters.search}
                            onChange={(e) => handleChange('search', e.target.value)}
                            className="pl-10 bg-background/50 border-[#004AAD]/20 focus:border-[#0066FF]"
                        />
                    </div>

                    <div className="col-span-1">
                        <Select
                            value={filters.status}
                            onValueChange={(v) => handleChange('status', v)}
                        >
                            <SelectTrigger className="bg-background/50 border-[#004AAD]/20">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="upcoming">Upcoming</SelectItem>
                                <SelectItem value="ended">Ended</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="col-span-1">
                        <Select
                            value={filters.series}
                            onValueChange={(v) => handleChange('series', v)}
                        >
                            <SelectTrigger className="bg-background/50 border-[#004AAD]/20">
                                <SelectValue placeholder="Filter by Series" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All My Series</SelectItem>
                                {seriesList.length === 0 && (
                                    <SelectItem value="none" disabled>No Enrolled Series</SelectItem>
                                )}
                                {seriesList.map(s => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
