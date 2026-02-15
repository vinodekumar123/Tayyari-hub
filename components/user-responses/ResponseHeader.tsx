'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User as UserIcon, Mail, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ResponseHeaderProps {
    quizTitle: string;
    quizSubject: string;
    studentProfile?: any;
    remark: string;
    remarkColor: string;
    isAdmin: boolean;
    studentIdParam: string | null;
}

export function ResponseHeader({
    quizTitle,
    quizSubject,
    studentProfile,
    remark,
    remarkColor,
    isAdmin,
    studentIdParam
}: ResponseHeaderProps) {
    const router = useRouter();

    return (
        <div className="mb-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    {studentProfile && (
                        <div className="mb-4 p-3 md:p-4 bg-muted/30 border border-primary/10 rounded-xl flex flex-row gap-3 md:gap-4 items-center animate-in fade-in slide-in-from-top-4 overflow-hidden">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <UserIcon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                            </div>
                            <div className="space-y-0.5 md:space-y-1 min-w-0">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <h2 className="text-base md:text-lg font-bold truncate">
                                        {studentProfile.displayName || studentProfile.fullName || studentProfile.name || studentProfile.email || 'Unknown Student'}
                                    </h2>
                                    <Badge variant="outline" className="text-[10px] h-4 md:h-5 px-1 shrink-0">Student</Badge>
                                </div>
                                <div className="flex flex-col xs:flex-row xs:flex-wrap gap-x-3 gap-y-0.5 text-[10px] md:text-sm text-muted-foreground truncate">
                                    {studentProfile.email && (
                                        <div className="flex items-center gap-1 truncate">
                                            <Mail className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" /> <span className="truncate">{studentProfile.email}</span>
                                        </div>
                                    )}
                                    {studentProfile.phoneNumber && (
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Phone className="w-3 md:w-3.5 h-3 md:h-3.5 shrink-0" /> {studentProfile.phoneNumber}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{quizTitle}</h1>
                    <p className="text-muted-foreground mt-1 text-sm font-medium uppercase tracking-wide">
                        {quizSubject} &bull; Result Analysis
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-8">
                <Button
                    variant="ghost"
                    size="sm"
                    className="hover:bg-muted group text-muted-foreground hover:text-foreground transition-all"
                    onClick={() => router.push(isAdmin && studentIdParam ? `/admin/students/foradmin?id=${studentIdParam}` : '/dashboard/student/user-created-quizzes')}
                >
                    <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
                    <span className="inline">Back to History</span>
                </Button>
                <Badge className={`text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg ${remarkColor} text-white ml-auto`}>
                    {remark}
                </Badge>
            </div>
        </div>
    );
}
