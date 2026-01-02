'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Calendar, BookOpen, AlertCircle, Filter, Clock } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ScheduleItem {
    id: string;
    title: string;
    startDate: string;
    startTime?: string;
    subjects: Array<{ name: string } | string>;
    chapters: Array<{ name: string } | string>;
    status: 'upcoming' | 'live' | 'completed';
    seriesName?: string;
}

interface EnrolledSeries {
    id: string;
    title: string;
}

export default function StudentSchedulePage() {
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [enrolledSeries, setEnrolledSeries] = useState<EnrolledSeries[]>([]);
    const [filterSeries, setFilterSeries] = useState('all');

    // 1. Auth & Enrollments
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                fetchEnrollments(u.uid);
            } else {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    const fetchEnrollments = async (uid: string) => {
        try {
            const enrolRef = collection(db, 'enrollments');
            const q = query(enrolRef, where('studentId', '==', uid), where('status', '==', 'active'));
            const snap = await getDocs(q);

            const seriesIds = snap.docs.map(d => d.data().seriesId);

            // Fetch Series Details for Dropdown
            const seriesData: EnrolledSeries[] = [];
            for (const sid of seriesIds) {
                const sDoc = await getDoc(doc(db, 'series', sid));
                if (sDoc.exists()) {
                    seriesData.push({ id: sDoc.id, title: sDoc.data().title });
                }
            }
            setEnrolledSeries(seriesData);
        } catch (error) {
            console.error("Error fetching enrollments:", error);
            toast.error("Failed to load enrolled courses");
        }
    };

    // 2. Fetch Schedule based on Filter
    useEffect(() => {
        if (!user || enrolledSeries.length === 0) {
            if (enrolledSeries.length === 0 && user) setLoading(false);
            return;
        }

        const fetchSchedule = async () => {
            setLoading(true);
            try {
                let allItems: ScheduleItem[] = [];
                const targetSeriesIds = filterSeries === 'all'
                    ? enrolledSeries.map(s => s.id)
                    : [filterSeries];

                // Fetch quizzes for each target series
                // We do this concurrently
                const promises = targetSeriesIds.map(async (sid) => {
                    const q = query(collection(db, 'quizzes'), where('series', 'array-contains', sid));
                    const snapshot = await getDocs(q);
                    const seriesTitle = enrolledSeries.find(s => s.id === sid)?.title;

                    return snapshot.docs.map(doc => {
                        const data = doc.data();
                        const now = new Date();
                        let start, end;
                        try {
                            start = new Date(`${data.startDate}T${data.startTime || '00:00:00'}`);
                            end = new Date(`${data.endDate}T${data.endTime || '23:59:59'}`);
                        } catch {
                            start = now; end = now;
                        }

                        let status: 'upcoming' | 'live' | 'completed' = 'upcoming';
                        if (now > end) status = 'completed';
                        else if (now >= start && now <= end) status = 'live';

                        return {
                            id: doc.id,
                            title: data.title,
                            startDate: data.startDate,
                            startTime: data.startTime,
                            subjects: data.subjects || [],
                            chapters: data.chapters || [],
                            status,
                            seriesName: seriesTitle
                        } as ScheduleItem;
                    });
                });

                const results = await Promise.all(promises);
                allItems = results.flat();

                // Deduplicate by ID just in case a quiz is in multiple enrolled series (unlikely but safe)
                const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

                // Sort by Date
                uniqueItems.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                setSchedules(uniqueItems);

            } catch (error) {
                console.error("Error fetching schedule:", error);
                toast.error("Failed to load schedule");
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [filterSeries, enrolledSeries, user]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'live': return 'bg-red-500/10 text-red-600 border-red-500/20';
            case 'completed': return 'bg-green-500/10 text-green-600 border-green-500/20';
            default: return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="relative group rounded-3xl overflow-hidden p-8 mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] opacity-90 dark:opacity-80" />
                <div className="relative z-10 text-white">
                    <h1 className="text-4xl font-black mb-2">My Schedule</h1>
                    <p className="text-red-100 font-medium max-w-2xl">
                        Keep track of your upcoming tests, live exams, and completed assessments timeline.
                    </p>
                </div>
                {/* Decorative Circle */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    Filter by Series:
                </div>
                <Select value={filterSeries} onValueChange={setFilterSeries}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                        <SelectValue placeholder="All Series" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Enrolled Series</SelectItem>
                        {enrolledSeries.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Timeline */}
            <div className="relative min-h-[500px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                        <p className="text-muted-foreground mt-4">Loading your schedule...</p>
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No Tests Scheduled</h3>
                        <p className="text-slate-500">There are no upcoming tests for the selected series.</p>
                    </div>
                ) : (
                    <div className="space-y-8 relative pl-4 md:pl-8">
                        {/* Timeline Line */}
                        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

                        {schedules.map((item, index) => {
                            const isLive = item.status === 'live';
                            const isPassed = item.status === 'completed';

                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="relative md:pl-12"
                                >
                                    {/* Timeline Dot */}
                                    {/* Desktop Dot */}
                                    <div className={`hidden md:flex absolute left-[1.3rem] top-8 w-4 h-4 rounded-full border-4 border-white dark:border-slate-950 z-10 transform -translate-x-1/2
                                        ${isLive ? 'bg-red-500 ring-4 ring-red-100 dark:ring-red-900' :
                                            isPassed ? 'bg-green-500 ring-4 ring-green-100 dark:ring-green-900' :
                                                'bg-blue-500 ring-4 ring-blue-100 dark:ring-blue-900'}`}
                                    />

                                    <Card className={`overflow-hidden transition-all hover:shadow-lg border-l-4 
                                        ${isLive ? 'border-l-red-500 shadow-red-500/5' :
                                            isPassed ? 'border-l-green-500' : 'border-l-blue-500'}`}>
                                        <CardContent className="p-0">
                                            <div className="flex flex-col md:flex-row">
                                                {/* Date Column */}
                                                <div className="p-6 bg-slate-50 dark:bg-secondary/20 md:w-48 flex-shrink-0 flex flex-col justify-center items-center md:items-start text-center md:text-left border-b md:border-b-0 md:border-r border-slate-100 dark:border-white/5">
                                                    <span className="text-3xl font-black text-slate-700 dark:text-slate-200">
                                                        {format(new Date(item.startDate), 'dd')}
                                                    </span>
                                                    <span className="text-lg font-medium text-slate-500 uppercase">
                                                        {format(new Date(item.startDate), 'MMM')}
                                                    </span>
                                                    <span className="text-sm text-slate-400 mt-1">
                                                        {format(new Date(item.startDate), 'EEEE')}
                                                    </span>
                                                    {item.startTime && (
                                                        <Badge variant="secondary" className="mt-3 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {item.startTime}
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Details Column */}
                                                <div className="p-6 flex-1">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Badge variant="outline" className={`${getStatusColor(item.status)} capitalize`}>
                                                                    {item.status}
                                                                </Badge>
                                                                {item.seriesName && (
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {item.seriesName}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl">
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Subjects</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.subjects.map((sub: any, i) => (
                                                                    <span key={i} className="px-2 py-1 bg-white dark:bg-black border rounded text-xs">
                                                                        {typeof sub === 'string' ? sub : sub.name}
                                                                    </span>
                                                                ))}
                                                                {item.subjects.length === 0 && <span className="text-xs italic text-muted-foreground">All Subjects</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Chapters</p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.chapters.map((ch: any, i) => (
                                                                    <span key={i} className="px-2 py-1 bg-white dark:bg-black border rounded text-xs">
                                                                        {typeof ch === 'string' ? ch : ch.name}
                                                                    </span>
                                                                ))}
                                                                {item.chapters.length === 0 && <span className="text-xs italic text-muted-foreground">All Chapters</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
