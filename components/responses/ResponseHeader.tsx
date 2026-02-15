'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ResponseHeaderProps {
    title: string;
    subject: string;
    remark: string;
    remarkColor: string;
    onDownload: () => void;
    isExporting: boolean;
}

export function ResponseHeader({ title, subject, remark, remarkColor, onDownload, isExporting }: ResponseHeaderProps) {
    const router = useRouter();

    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex-1 space-y-1">
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="pl-0 hover:bg-transparent text-muted-foreground mb-1">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
                <p className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                    {subject} • Result Analysis
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    onClick={onDownload}
                    disabled={isExporting}
                    variant="outline"
                    className="bg-white dark:bg-slate-900 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 gap-2 shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    {isExporting ? 'Generating PDF...' : 'Download Result Card'}
                </Button>
                <Badge className={`text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg ${remarkColor} text-white hover:${remarkColor}`}>
                    {remark}
                </Badge>
            </div>
        </div>
    );
}
