'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuizStatusBadgeProps {
    status: 'active' | 'upcoming' | 'ended';
    className?: string;
}

export function QuizStatusBadge({ status, className }: QuizStatusBadgeProps) {
    const variants = {
        active: "bg-gradient-to-r from-[#00B4D8]/20 to-[#66D9EF]/20 text-[#00B4D8] dark:text-[#66D9EF] border-transparent",
        upcoming: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
        ended: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
    };

    const labels = {
        active: "Active",
        upcoming: "Upcoming",
        ended: "Ended"
    };

    return (
        <Badge
            variant="outline"
            className={cn("px-3 py-1 rounded-full text-xs font-bold border", variants[status], className)}
        >
            {labels[status]}
        </Badge>
    );
}
