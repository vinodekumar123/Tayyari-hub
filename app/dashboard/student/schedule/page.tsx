'use client';

import { useState, useEffect } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, getDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { useUserStore } from '@/stores/useUserStore';
import { Quiz } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, BookOpen, AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, addHours } from 'date-fns';
import { glassmorphism } from '@/lib/design-tokens';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { UnifiedHeader } from '@/components/unified-header';

interface ScheduleGroup {
    dateLabel: string;
    quizzes: Quiz[];
}

export default function SchedulePage() {
    const { user } = useUserStore();
    const [scheduleGroups, setScheduleGroups] = useState<ScheduleGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [enrolledSeriesIds, setEnrolledSeriesIds] = useState<string[]>([]);

    useEffect(() => {
        const fetchSchedule = async () => {
            if (!user) return;

            try {
                setLoading(true);

                // 1. Get User's Enrolled Series
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                const userData = userSnap.data();

                // Allow admin/teacher to see all or mock specific logic? 
                // For now stick to student logic: Filter by enrolled series.
                const seriesIds: string[] = userData?.enrolledSeries || [];
                setEnrolledSeriesIds(seriesIds);

                // 2. Fetch Quizzes
                // Note: Firestore 'in' or 'array-contains-any' is limited to 10. 
                // If a user has > 10 series, we might need multiple queries or client-side filtering.
                // For this implementation, we'll fetch all published quizzes and filter client-side 
                // to be robust against series count limits, though less efficient for massive datasets.
                // Ideally, we'd query by date range (e.g., upcoming month) + series filter.

                const quizzesRef = collection(db, 'quizzes');
                // Basic Filter: Published only
                const q = query(quizzesRef, where('published', '==', true));
                const querySnapshot = await getDocs(q);

                const allQuizzes: Quiz[] = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Quiz));

                // 3. Filter and Sort
                const now = new Date();

                const relevantQuizzes = allQuizzes.filter(quiz => {
                    // Check Series Enrollment
                    // If quiz has no series tag, is it free for all? detailed logic can be added. 
                    // Assuming quizzes MUST belong to a series to appear in "Personalized Schedule".
                    if (!quiz.series || quiz.series.length === 0) return false;

                    const hasAccess = quiz.series.some(sId => seriesIds.includes(sId));
                    return hasAccess;
                });

                // Sort by Start Date
                relevantQuizzes.sort((a, b) => {
                    const dateA = new Date(a.startDate).getTime();
                    const dateB = new Date(b.startDate).getTime();
                    return dateA - dateB;
                });

                // 4. Group by Date
                const groups: Record<string, Quiz[]> = {};

                relevantQuizzes.forEach(quiz => {
                    const date = new Date(quiz.startDate);
                    // Keep only future or recent past (e.g. last 24h) quizzes? 
                    // Let's show all for now, or maybe filter out way past ones.
                    // The prompt implies "Upcoming" focus.

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
        return <div className="p-8 text-center">Loading Schedule...</div>;
    }

    if (scheduleGroups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
                <div className="bg-purple-100 p-4 rounded-full">
                    <Calendar className="w-12 h-12 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold">No Scheduled Quizzes</h2>
                <p className="text-muted-foreground max-w-md">
                    It looks like you don&apos;t have any upcoming quizzes for your enrolled series.
                    Enroll in a series to see your exam schedule!
                </p>
                <Link href="/pricing">
                    <Button>Browse Series</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
            <UnifiedHeader
                title="Your Exam Schedule"
                subtitle="Stay on track with your personalized quiz timeline."
                icon={<Calendar className="w-6 h-6" />}
            />

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
                                const startDate = new Date(quiz.startDate);
                                const isLive = isToday(startDate) && new Date() >= startDate && new Date() <= addHours(startDate, quiz.duration / 60); // Approx check

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
                                                    {quiz.chapter && (
                                                        <Badge variant="secondary" className="text-xs font-normal">
                                                            {quiz.chapter}
                                                        </Badge>
                                                    )}
                                                </div>

                                                <h4 className="text-lg font-bold group-hover:text-blue-600 transition-colors">
                                                    {quiz.title}
                                                </h4>

                                                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-4 h-4" />
                                                        {format(startDate, 'h:mm a')}
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
                                                <Link href={`/quiz/start/${quiz.id}`}>
                                                    <Button className={isLive ? "bg-red-600 hover:bg-red-700" : ""}>
                                                        {isLive ? "Join Quiz" : "View Details"}
                                                        <ChevronRight className="w-4 h-4 ml-1" />
                                                    </Button>
                                                </Link>
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
    );
}
