'use client';

import { useState, useEffect } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { useUserStore } from '@/stores/useUserStore';
import { Quiz } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format, isToday, isTomorrow, addHours } from 'date-fns';
import { glassmorphism } from '@/lib/design-tokens';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UnifiedHeader } from '@/components/unified-header';
import { safeDate } from '@/lib/date-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ScheduleGroup {
    dateLabel: string;
    quizzes: Quiz[];
}

export default function SchedulePage() {
    const { user } = useUserStore();
    const [scheduleGroups, setScheduleGroups] = useState<ScheduleGroup[]>([]);
    const [loading, setLoading] = useState(true);

    // Helper to combine Date and Time strings into a Date object
    const parseQuizDateTime = (dateStr: string, timeStr?: string): Date => {
        const date = safeDate(dateStr);
        if (!timeStr) return date;

        const [hours, minutes] = timeStr.split(':').map(Number);
        date.setHours(hours || 0, minutes || 0, 0, 0);
        return date;
    };

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user) {
                return;
            }

            try {
                setLoading(true);

                // 1. Get User's Enrolled Series (Robust fetch)
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();

                // Fetch true source of truth: Enrollment Receipts
                const enrollmentsQ = query(collection(db, 'enrollments'), where('studentId', '==', user.uid));
                const enrollmentsSnap = await getDocs(enrollmentsQ);

                // Filter for active (Handle case sensitivity)
                const receiptSeriesIds = enrollmentsSnap.docs
                    .map(d => d.data())
                    .filter(r => r.seriesId && (r.status === 'active' || r.status === 'Active'))
                    .map(r => r.seriesId as string);

                const profileSeriesIds: string[] = userData?.enrolledSeries || [];

                // Merge and Deduplicate
                const seriesIds = Array.from(new Set([...profileSeriesIds, ...receiptSeriesIds]));

                // OPTIMIZATION: If no series, no need to fetch quizzes
                if (seriesIds.length === 0) {
                    setScheduleGroups([]);
                    setLoading(false);
                    return;
                }

                // 2. Fetch Quizzes (Chunked to bypass 10-item limit of array-contains-any)
                // Chunk size 10
                const chunks = [];
                for (let i = 0; i < seriesIds.length; i += 10) {
                    chunks.push(seriesIds.slice(i, i + 10));
                }

                const quizzesRef = collection(db, 'quizzes');
                let allQuizzes: Quiz[] = [];

                for (const chunk of chunks) {
                    const q = query(
                        quizzesRef,
                        where('published', '==', true),
                        where('series', 'array-contains-any', chunk)
                    );
                    const snap = await getDocs(q);
                    const chunkQuizzes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
                    allQuizzes = [...allQuizzes, ...chunkQuizzes];
                }

                // Remove duplicates (if quiz in multiple series)
                const uniqueQuizzes = Array.from(new Map(allQuizzes.map(item => [item.id, item])).values());

                // 3. Filter and Sort
                // Double check series enrollment (redundant if using filtered query, but safe)
                const relevantQuizzes = uniqueQuizzes.filter(quiz => {
                    if (!quiz.series) return false;
                    return quiz.series.some(sId => seriesIds.includes(sId));
                });

                // Sort by Start Date
                relevantQuizzes.sort((a, b) => {
                    const paramsA = parseQuizDateTime(a.startDate, a.startTime).getTime();
                    const paramsB = parseQuizDateTime(b.startDate, b.startTime).getTime();
                    return paramsA - paramsB;
                });

                // 4. Group by Date
                const groups: Record<string, Quiz[]> = {};

                relevantQuizzes.forEach(quiz => {
                    const date = parseQuizDateTime(quiz.startDate, quiz.startTime);

                    let label = format(date, 'yyyy-MM-dd');
                    if (isToday(date)) label = 'Today';
                    else if (isTomorrow(date)) label = 'Tomorrow';
                    else label = format(date, 'EEEE, MMMM do');

                    if (!groups[label]) groups[label] = [];
                    groups[label].push(quiz);
                });

                // Convert to array
                const groupArray: ScheduleGroup[] = Object.keys(groups).map(key => ({
                    dateLabel: key,
                    quizzes: groups[key]
                }));

                setScheduleGroups(groupArray);

            } catch (error) {
                console.error("Error fetching schedule:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [user]);

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
                </div>

                {[1, 2].map((i) => (
                    <div key={i} className="pl-8 border-l-2 border-slate-200 pb-8">
                        <div className="h-6 w-32 bg-slate-200 rounded mb-4 animate-pulse" />
                        <div className="grid gap-4">
                            <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />
                            <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (scheduleGroups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
                <div className="bg-purple-100 p-4 rounded-full">
                    <Calendar className="w-12 h-12 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold">No Schedule Found</h2>
                <p className="text-muted-foreground max-w-md">
                    You are enrolled in series, but there are no upcoming quizzes scheduled at the moment.
                </p>
                <Link href="/dashboard/student/library">
                    <Button variant="outline">Browse Library</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
            <UnifiedHeader
                title="Your Exam Schedule"
                subtitle="Stay on track with your personalized quiz timeline."
                icon={<Calendar className="w-6 h-6" />}
            />
            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">

                <div className="space-y-8">
                    {scheduleGroups.map((group, idx) => (
                        <div key={idx} className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-800 pb-8 last:pb-0">
                            {/* Date Bead */}
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-600 ring-4 ring-white dark:ring-slate-950" />

                            <h3 className={`text-xl font-bold mb-4 ${group.dateLabel === 'Today' ? 'text-purple-600' : ''}`}>
                                {group.dateLabel}
                            </h3>

                            <div className="grid gap-4">
                                {group.quizzes.map(quiz => {
                                    const startDateTime = parseQuizDateTime(quiz.startDate, quiz.startTime);
                                    const endDateTime = quiz.endDate ? parseQuizDateTime(quiz.endDate, quiz.endTime) : addHours(startDateTime, quiz.duration / 60);

                                    const now = new Date();
                                    const isLive = now >= startDateTime && now <= endDateTime;

                                    // Cast to access potential dynamic fields
                                    const q: any = quiz;
                                    const subjects = q.subjects || [];
                                    const chapters = q.chapters || [];
                                    const hasSyllabus = subjects.length > 0 || chapters.length > 0;

                                    return (
                                        <Card key={quiz.id} className={`${glassmorphism.light} border-l-4 ${isLive ? 'border-l-red-500' : 'border-l-blue-500'} hover:shadow-lg transition-all group`}>
                                            <CardContent className="p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        {isLive && (
                                                            <Badge variant="destructive" className="animate-pulse">
                                                                LIVE NOW
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className="text-xs font-normal">
                                                            {quiz.subject}
                                                        </Badge>
                                                    </div>

                                                    <h4 className="text-lg font-bold group-hover:text-blue-600 transition-colors">
                                                        {quiz.title}
                                                    </h4>

                                                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-4 h-4" />
                                                            {format(startDateTime, 'h:mm a')}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-4 h-4" />
                                                            {quiz.duration} mins
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <BookOpen className="w-4 h-4" />
                                                            {quiz.totalQuestions} Qs
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {/* Syllabus / Details Button */}
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant={isLive ? "outline" : "default"} className={!isLive ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}>
                                                                View Syllabus
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-2xl max-h-[80vh]">
                                                            <DialogHeader>
                                                                <DialogTitle>{quiz.title} - Syllabus</DialogTitle>
                                                            </DialogHeader>
                                                            <ScrollArea className="h-full max-h-[60vh] pr-4">
                                                                {hasSyllabus ? (
                                                                    <div className="space-y-6">
                                                                        {subjects.length > 0 && (
                                                                            <div className="space-y-3">
                                                                                <h4 className="font-bold text-lg text-primary">Subjects</h4>
                                                                                <div className="flex flex-wrap gap-2">
                                                                                    {subjects.map((sub: any, i: number) => (
                                                                                        <Badge key={i} variant="secondary" className="text-base px-3 py-1">
                                                                                            {typeof sub === 'string' ? sub : sub.name}
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {chapters.length > 0 && (
                                                                            <div className="space-y-3">
                                                                                <h4 className="font-bold text-lg text-primary">Chapters</h4>
                                                                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                                    {chapters.map((chap: any, i: number) => (
                                                                                        <li key={i} className="flex items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-md text-sm shadow-sm border border-slate-100 dark:border-slate-800">
                                                                                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                                                                                            <span className="font-medium truncate">
                                                                                                {typeof chap === 'string' ? chap : chap.name}
                                                                                            </span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                                                        <BookOpen className="w-10 h-10 mb-2 opacity-20" />
                                                                        <p>Syllabus details not available.</p>
                                                                    </div>
                                                                )}

                                                                {!isLive && (
                                                                    <div className="mt-8 pt-4 border-t flex justify-end">
                                                                        <Link href={`/quiz/start/${quiz.id}`}>
                                                                            <Button>Go to Exam Page <ChevronRight className="w-4 h-4 ml-2" /></Button>
                                                                        </Link>
                                                                    </div>
                                                                )}
                                                            </ScrollArea>
                                                        </DialogContent>
                                                    </Dialog>

                                                    {/* Join Button (if Live) */}
                                                    {isLive && (
                                                        <Link href={`/quiz/start/${quiz.id}`}>
                                                            <Button className="bg-red-600 hover:bg-red-700">
                                                                Join Now
                                                                <ChevronRight className="w-4 h-4 ml-1" />
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
