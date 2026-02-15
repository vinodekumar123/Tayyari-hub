'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Enrollment } from '@/hooks/useStudentSettings';

interface EnrollmentListProps {
    enrollments: Enrollment[];
}

export function EnrollmentList({ enrollments }: EnrollmentListProps) {
    return (
        <div className="mt-6">
            <h4 className="text-base font-semibold">Enrolled Series</h4>
            {enrollments.length === 0 ? (
                <p className="text-sm text-slate-500 mt-2">You are not enrolled in any series.</p>
            ) : (
                <div className="mt-3 space-y-2">
                    {enrollments.map((s) => (
                        <div key={s.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-white/50 dark:bg-slate-900/50 gap-3">
                            <div>
                                <div className="font-semibold flex items-center gap-2">
                                    {s.seriesName}
                                    {s.status === 'active' && <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">Valid upto MDCAT 2026 Test</Badge>}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Enrolled on: {s.enrolledAt ? format(new Date(s.enrolledAt?.seconds ? s.enrolledAt.seconds * 1000 : s.enrolledAt), 'MMM dd, yyyy') : 'N/A'}
                                </div>
                                <div className="text-[11px] text-amber-600 dark:text-amber-500 mt-1 font-medium bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded inline-block">
                                    Note: This is an online Self-assessment session only. No classes or lectures provided.
                                </div>
                            </div>
                            <div>
                                <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status || 'active'}</Badge>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
