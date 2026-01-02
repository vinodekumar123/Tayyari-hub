'use client';

import { useState, useEffect } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Calendar, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';
import { motion, AnimatePresence } from 'framer-motion';

interface ScheduleViewerProps {
    seriesId: string;
    seriesName: string;
    isOpen: boolean;
    onClose: () => void;
}

interface ScheduleItem {
    id: string;
    title: string;
    startDate: string;
    startTime?: string;
    subjects: Array<{ name: string } | string>;
    chapters: Array<{ name: string } | string>;
    status: 'upcoming' | 'live' | 'completed';
}

export function ScheduleViewer({ seriesId, seriesName, isOpen, onClose }: ScheduleViewerProps) {
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !seriesId) return;

        const fetchSchedule = async () => {
            setLoading(true);
            try {
                // Fetch quizzes assigned to this series
                // Note: 'series' is an array of series IDs in the Quiz document
                const q = query(
                    collection(db, 'quizzes'),
                    where('series', 'array-contains', seriesId),
                    // We can't order by startDate easily with array-contains in all cases without a composite index,
                    // so we'll sort client-side for safety/simplicity unless the index exists.
                );

                const snapshot = await getDocs(q);
                const now = new Date();

                const items: ScheduleItem[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    let start, end;
                    try {
                        start = new Date(`${data.startDate}T${data.startTime || '00:00:00'}`);
                        end = new Date(`${data.endDate}T${data.endTime || '23:59:59'}`);
                    } catch (e) {
                        // Fallback or skip invalid
                        start = new Date();
                        end = new Date();
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
                        status
                    };
                });

                // Sort by date ascending
                items.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
                setSchedules(items);

            } catch (error) {
                console.error("Error fetching schedule:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedule();
    }, [seriesId, isOpen]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'live': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
            default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] p-0 overflow-hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-white/20 dark:border-white/10">
                <DialogHeader className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <DialogTitle className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                        {seriesName} Schedule
                    </DialogTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        Timeline and syllabus for all tests in this series.
                    </p>
                </DialogHeader>

                <ScrollArea className="h-[60vh] p-6 bg-slate-50/30 dark:bg-slate-950/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p className="text-sm text-muted-foreground">Loading schedule...</p>
                        </div>
                    ) : schedules.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-3 text-center opacity-60">
                            <Calendar className="w-12 h-12 text-slate-400" />
                            <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">No tests scheduled yet.</p>
                            <p className="text-sm text-slate-400">Check back later for updates.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 relative">
                            {/* Timeline Line */}
                            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

                            {schedules.map((item, index) => {
                                const isPassed = item.status === 'completed';
                                const isLive = item.status === 'live';

                                return (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="relative md:pl-12"
                                    >
                                        {/* Timeline Dot */}
                                        <div className={`hidden md:flex absolute left-0 top-6 w-8 h-8 rounded-full items-center justify-center border-4 border-slate-50 dark:border-slate-950 z-10 
                      ${isLive ? 'bg-red-500 text-white animate-pulse' :
                                                isPassed ? 'bg-green-500 text-white' : 'bg-blue-100 dark:bg-slate-800 text-blue-600 dark:text-slate-400'}`}
                                        >
                                            {isLive ? <AlertCircle className="w-4 h-4" /> :
                                                isPassed ? <BookOpen className="w-4 h-4" /> :
                                                    <Calendar className="w-4 h-4" />}
                                        </div>

                                        <div className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-5 border transition-all hover:shadow-lg
                      ${isLive ? 'border-red-500/50 shadow-red-500/10' : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'}`}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className={`${getStatusColor(item.status)} capitalize`}>
                                                            {item.status}
                                                        </Badge>
                                                        <span className="text-xs font-mono text-slate-400">
                                                            {item.startDate} {item.startTime ? `• ${item.startTime}` : ''}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                        {item.title}
                                                    </h4>
                                                </div>
                                            </div>

                                            <div className="space-y-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800/50">
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                        <BookOpen className="w-3 h-3" /> Syllabus
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-400 block mb-1">Subjects</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.subjects.map((sub: any, i) => (
                                                                    <span key={i} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium text-slate-700 dark:text-slate-300">
                                                                        {typeof sub === 'string' ? sub : sub.name}
                                                                    </span>
                                                                ))}
                                                                {item.subjects.length === 0 && <span className="text-xs text-slate-400 italic">All Subjects</span>}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-400 block mb-1">Chapters</span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.chapters.map((ch: any, i) => (
                                                                    <span key={i} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-medium text-slate-700 dark:text-slate-300">
                                                                        {typeof ch === 'string' ? ch : ch.name}
                                                                    </span>
                                                                ))}
                                                                {item.chapters.length === 0 && <span className="text-xs text-slate-400 italic">All Chapters</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
