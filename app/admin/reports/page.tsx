'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { db, auth } from '@/app/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, getDoc, getDocs, where, documentId } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Flag, Eye, MessageSquare, Check, X, FolderOpen, BookOpen, Layers, CheckCircle, Calendar, Filter, User as UserIcon, AlertCircle, BarChart3, Search } from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { glassmorphism, brandColors } from '@/lib/design-tokens';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

interface Report {
    id: string;
    questionId: string;
    questionText: string;
    options?: string[];
    correctAnswer?: string;
    subject?: string;
    topic?: string;

    studentId: string;
    studentName: string;
    issue: string;
    status: 'pending' | 'resolved' | 'ignored' | 'approval_required';
    adminReply?: string;
    adminName?: string;
    createdAt: any;
    resolvedAt?: any;
    quizId: string;
}

interface QuestionDetails {
    explanation?: string;
    questionText?: string;
    options?: string[];
    correctAnswer?: string;
    subject?: string;
    topic?: string;
    images?: string[];
}

export default function AdminReportsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [questionDetails, setQuestionDetails] = useState<QuestionDetails | null>(null);

    // RBAC
    const [userRole, setUserRole] = useState<'admin' | 'superadmin' | 'teacher' | 'student' | null>(null);
    const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);

    // Filters & Range
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'ignored' | 'approval_required'>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [adminFilter, setAdminFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Reply State
    const [replyDialogOpen, setReplyDialogOpen] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [replying, setReplying] = useState(false);

    const router = useRouter();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                router.push('/login');
            } else {
                // Fetch role
                const { doc, getDoc } = await import('firebase/firestore');
                const snap = await getDoc(doc(db, 'users', u.uid));
                if (snap.exists()) {
                    const d = snap.data();

                    const isTeacher = d.role === 'teacher' || d.teacher === true;
                    const isSuperAdmin = d.role === 'superadmin' || d.superadmin === true;
                    const isAdmin = d.role === 'admin' || d.admin === true;

                    // Determine highest privilege role string for logic
                    let r: 'admin' | 'superadmin' | 'teacher' | 'student' = 'student';
                    if (isSuperAdmin) r = 'superadmin';
                    else if (isAdmin) r = 'admin';
                    else if (isTeacher) r = 'teacher';

                    setUserRole(r);
                    if (r === 'teacher') {
                        setTeacherSubjects(d.subjects || []);
                        if (d.subjects && d.subjects.length > 0) setSubjectFilter(d.subjects[0]);
                    }
                }
            }
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        const q = query(
            collection(db, 'reported_questions'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Report[];
            setReports(data);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching reports:", error);
            toast.error("Failed to load reports. Please check your permissions.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // ... (questionsCache logic remains same until handleReplySubmit)
    // We need to preserve the Cache logic, I will NOT replace lines 115-189 unless I include them.
    // The previous prompt replaced up to line 311 which is handleReplySubmit.
    // So I need to include the cache logic in replacement or be careful with ranges.
    // I replaced lines 36-311. So I must provide ALL logic in between.
    // This is large. I will break it down or provide the full block.
    // I will include the caching and other useEffects.

    // ... Caching Logic Re-implementation ...
    const [questionsCache, setQuestionsCache] = useState<Record<string, { subject: string; topic?: string }>>({});

    useEffect(() => {
        const fetchMissingSubjects = async () => {
            const missingIds = reports
                .map(r => r.questionId)
                .filter(id => id && !questionsCache[id] && id !== 'undefined');

            const uniqueMissingIds = Array.from(new Set(missingIds));

            if (uniqueMissingIds.length === 0) return;

            // Fetch in chunks of 10
            const chunkSize = 10;
            for (let i = 0; i < uniqueMissingIds.length; i += chunkSize) {
                const chunk = uniqueMissingIds.slice(i, i + chunkSize);
                try {
                    const qQuestions = query(collection(db, 'questions'), where(documentId(), 'in', chunk));
                    const snap = await getDocs(qQuestions);

                    const newCache: Record<string, { subject: string; topic?: string }> = {};
                    snap.forEach(doc => {
                        const data = doc.data();
                        newCache[doc.id] = { subject: data.subject || 'Unknown', topic: data.topic };
                    });

                    chunk.forEach(id => {
                        if (!newCache[id]) newCache[id] = { subject: 'Unknown' };
                    });

                    setQuestionsCache(prev => ({ ...prev, ...newCache }));
                } catch (e) {
                    console.error("Error fetching question subjects", e);
                }
            }
        };

        fetchMissingSubjects();
    }, [reports, questionsCache]);

    // Extract unique subjects
    const uniqueSubjects = useMemo(() => {
        // For Teachers, only show assigned subjects in filter list
        const allSubs = Array.from(new Set(Object.values(questionsCache).map(q => q.subject).filter(Boolean))).sort();
        if (userRole === 'teacher') {
            return allSubs.filter(s => teacherSubjects.includes(s));
        }
        return allSubs;
    }, [questionsCache, userRole, teacherSubjects]);

    // Extract unique admins (remains same)
    const uniqueAdmins = useMemo(() => {
        const admins = new Set(reports.map(r => r.adminName).filter(Boolean));
        return Array.from(admins).sort();
    }, [reports]);

    // Fetch deep details (remains same)
    useEffect(() => {
        if (!selectedReport) {
            setQuestionDetails(null);
            return;
        }

        const fetchDetails = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'questions', selectedReport.questionId));
                if (docSnap.exists()) {
                    setQuestionDetails(docSnap.data() as QuestionDetails);
                }
            } catch (error) {
                console.error("Failed to fetch details", error);
            }
        };
        fetchDetails();
    }, [selectedReport]);


    // Filter Logic
    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            // Teacher Restriction: Must match assigned subject
            if (userRole === 'teacher') {
                const subject = questionsCache[r.questionId]?.subject || 'Unknown';
                if (!teacherSubjects.includes(subject)) return false;
            }

            // Normal Filters
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;

            const subject = questionsCache[r.questionId]?.subject || 'Unknown';
            if (subjectFilter !== 'all' && subject !== subjectFilter) return false;

            if (adminFilter !== 'all' && r.adminName !== adminFilter) return false;

            // Search
            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                if (!r.questionText.toLowerCase().includes(lower) &&
                    !r.studentName.toLowerCase().includes(lower) &&
                    !r.issue.toLowerCase().includes(lower)) return false;
            }

            // Date Range
            if (dateRange === 'all') return true;
            const rDate = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : (r.createdAt instanceof Date ? r.createdAt : new Date());
            const now = new Date();
            if (dateRange === 'today') return isWithinInterval(rDate, { start: startOfDay(now), end: endOfDay(now) });
            if (dateRange === 'week') return rDate >= subDays(now, 7);
            if (dateRange === 'month') return rDate >= subDays(now, 30);
            if (dateRange === 'custom' && customStart && customEnd) {
                return isWithinInterval(rDate, {
                    start: startOfDay(new Date(customStart)),
                    end: endOfDay(new Date(customEnd))
                });
            }

            return true;
        });
    }, [reports, statusFilter, searchTerm, dateRange, customStart, customEnd, userRole, teacherSubjects, subjectFilter, questionsCache, adminFilter]);

    // Analytics (remains same code, but uses filteredReports which respects teacher/rbac)
    const analytics = useMemo(() => {
        const total = filteredReports.length;
        const pending = filteredReports.filter(r => r.status === 'pending').length;
        const resolved = filteredReports.filter(r => r.status === 'resolved').length;
        const ignored = filteredReports.filter(r => r.status === 'ignored').length;

        // Admin Leaderboard
        const adminCounts: Record<string, number> = {};
        filteredReports.forEach(r => {
            if (r.status === 'resolved' && r.adminName) {
                adminCounts[r.adminName] = (adminCounts[r.adminName] || 0) + 1;
            }
        });
        const topAdmins = Object.entries(adminCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        // Daily Trend
        const trendMap: Record<string, { pending: number, resolved: number, ignored: number }> = {};
        filteredReports.forEach(r => {
            const date = r.createdAt?.seconds
                ? format(new Date(r.createdAt.seconds * 1000), 'MMM dd')
                : 'N/A';
            if (!trendMap[date]) trendMap[date] = { pending: 0, resolved: 0, ignored: 0 };
            trendMap[date][r.status] = (trendMap[date][r.status] || 0) + 1; // Note: 'approval_required' might be missed if not handled in type
        });
        const dailyTrend = Object.entries(trendMap)
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-14);

        // Subject Distribution
        const subjectCounts: Record<string, number> = {};
        filteredReports.forEach(r => {
            const sub = questionsCache[r.questionId]?.subject || 'Unknown';
            subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
        });
        const subjectData = Object.entries(subjectCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { total, pending, resolved, ignored, topAdmins, dailyTrend, subjectData };
    }, [filteredReports, questionsCache]);

    const openReply = (report: Report) => {
        setSelectedReport(report);
        setReplyText(report.adminReply || '');
        setReplyDialogOpen(true);
    };

    const handleReplySubmit = async (status: 'resolved' | 'ignored' | 'approval_required') => {
        if (!selectedReport || !user) return;
        setReplying(true);

        let finalStatus = status;
        if (userRole === 'teacher' && status === 'resolved') {
            finalStatus = 'approval_required'; // Teacher Resolution needs Approval
        }

        try {
            await updateDoc(doc(db, 'reported_questions', selectedReport.id), {
                adminReply: replyText,
                adminName: user.displayName || user.email || 'Admin',
                status: finalStatus,
                resolvedAt: serverTimestamp()
            });
            toast.success(finalStatus === 'approval_required' ? 'Status set to Approval Required' : `Report marked as ${finalStatus}`);
            setReplyDialogOpen(false);
        } catch (e) {
            toast.error("Failed to update report");
        } finally {
            setReplying(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    return (
        <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-background to-background dark:from-gray-900/50 dark:via-background dark:to-background p-6 md:p-8">
            <div className="max-w-[1600px] mx-auto space-y-8">

                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 flex items-center gap-3">
                            <Flag className="w-8 h-8 text-red-600 dark:text-red-500" />
                            Report Analytics
                        </h1>
                        <p className="text-muted-foreground mt-1">Manage and resolve reported questions efficiently.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Dialog>
                            {/* Optional Settings/Export Trigger could go here */}
                        </Dialog>
                    </div>
                </div>

                {/* Filters Row */}
                <div className={`${glassmorphism.light} p-4 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end`}>
                    {/* Search */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Search</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search issue, question..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white/50 dark:bg-black/20 border-0 ring-1 ring-gray-200 dark:ring-gray-800"
                            />
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Time Period</Label>
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as any)}
                            className="w-full h-10 px-3 rounded-md bg-white/50 dark:bg-black/20 border-0 ring-1 ring-gray-200 dark:ring-gray-800 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all" className="dark:bg-gray-900">All Time</option>
                            <option value="today" className="dark:bg-gray-900">Today</option>
                            <option value="week" className="dark:bg-gray-900">Last 7 Days</option>
                            <option value="month" className="dark:bg-gray-900">Last 30 Days</option>
                            <option value="custom" className="dark:bg-gray-900">Custom Range</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full h-10 px-3 rounded-md bg-white/50 dark:bg-black/20 border-0 ring-1 ring-gray-200 dark:ring-gray-800 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all" className="dark:bg-gray-900">All Statuses</option>
                            <option value="pending" className="dark:bg-gray-900">Pending</option>
                            <option value="resolved" className="dark:bg-gray-900">Resolved</option>
                            <option value="ignored" className="dark:bg-gray-900">Ignored</option>
                        </select>
                    </div>

                    {/* Subject Filter */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Subject</Label>
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="w-full h-10 px-3 rounded-md bg-white/50 dark:bg-black/20 border-0 ring-1 ring-gray-200 dark:ring-gray-800 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all" className="dark:bg-gray-900">All Subjects</option>
                            {uniqueSubjects.map(sub => (
                                <option key={sub} value={sub} className="dark:bg-gray-900">{sub}</option>
                            ))}
                        </select>
                    </div>

                    {/* Subject Filter */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Subject</Label>
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="w-full h-10 px-3 rounded-md bg-white/50 dark:bg-black/20 border-0 ring-1 ring-gray-200 dark:ring-gray-800 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all" className="dark:bg-gray-900">All Subjects</option>
                            {uniqueSubjects.map(sub => (
                                <option key={sub} value={sub} className="dark:bg-gray-900">{sub}</option>
                            ))}
                        </select>
                    </div>

                    {/* Admin Filter */}
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Admin</Label>
                        <select
                            value={adminFilter}
                            onChange={(e) => setAdminFilter(e.target.value)}
                            className="w-full h-10 px-3 rounded-md bg-white/50 dark:bg-black/20 border-0 ring-1 ring-gray-200 dark:ring-gray-800 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all" className="dark:bg-gray-900">All Admins</option>
                            {uniqueAdmins.map(adm => (
                                <option key={adm} value={adm} className="dark:bg-gray-900">{adm}</option>
                            ))}
                        </select>
                    </div>

                    {/* Custom Range Inputs */}
                    {dateRange === 'custom' && (
                        <div className="flex gap-2">
                            <div className="space-y-2 flex-1">
                                <Label className="text-xs">Start</Label>
                                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-white/50 dark:bg-black/20" />
                            </div>
                            <div className="space-y-2 flex-1">
                                <Label className="text-xs">End</Label>
                                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-white/50 dark:bg-black/20" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Analytics Section */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="bg-white/60 dark:bg-white/5 border-white/20 dark:border-white/10 shadow-lg backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reports</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{analytics.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                In selected period
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-yellow-50/60 dark:bg-yellow-900/10 border-yellow-200/50 dark:border-yellow-900/20 shadow-lg backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-500">Pending</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-400">{analytics.pending}</div>
                            <p className="text-xs text-yellow-600/80 dark:text-yellow-500/60 mt-1">Requires attention</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-green-50/60 dark:bg-green-900/10 border-green-200/50 dark:border-green-900/20 shadow-lg backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-500">Resolved</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-900 dark:text-green-400">{analytics.resolved}</div>
                            <p className="text-xs text-green-600/80 dark:text-green-500/60 mt-1">Successfully handled</p>
                        </CardContent>
                    </Card>

                    {/* Top Admin Card */}
                    <Card className="bg-blue-50/60 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-900/20 shadow-lg backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-500">Top Solver</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {analytics.topAdmins.length > 0 ? (
                                <>
                                    <div className="text-xl font-bold text-blue-900 dark:text-blue-300 truncate">{analytics.topAdmins[0].name}</div>
                                    <p className="text-xs text-blue-600/80 dark:text-blue-500/60 mt-1">{analytics.topAdmins[0].count} resolved</p>
                                </>
                            ) : (
                                <div className="text-sm text-blue-800/60 dark:text-blue-300/60 font-medium">No activity yet</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Charts & Trends Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className={`${glassmorphism.light} border-0 shadow-lg md:col-span-2`}>
                        <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-indigo-500" />
                                Reports Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.dailyTrend}>
                                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="pending" name="Pending" stackId="a" fill="#F59E0B" radius={[0, 0, 4, 4]} />
                                    <Bar dataKey="resolved" name="Resolved" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="ignored" name="Ignored" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className={`${glassmorphism.light} border-0 shadow-lg`}>
                        <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-2">
                            <CardTitle className="text-lg">Status Distribution</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] pt-4 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Pending', value: analytics.pending, color: '#F59E0B' },
                                            { name: 'Resolved', value: analytics.resolved, color: '#10B981' },
                                            { name: 'Ignored', value: analytics.ignored, color: '#EF4444' },
                                        ].filter(x => x.value > 0)}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {[
                                            { name: 'Pending', value: analytics.pending, color: '#F59E0B' },
                                            { name: 'Resolved', value: analytics.resolved, color: '#10B981' },
                                            { name: 'Ignored', value: analytics.ignored, color: '#EF4444' },
                                        ].filter(x => x.value > 0).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Subject & Admin Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className={`${glassmorphism.light} border-0 shadow-lg`}>
                        <CardHeader className="border-b border-gray-100 dark:border-white/5 pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-pink-500" />
                                Reports by Subject
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.subjectData} layout="vertical" margin={{ left: 5, right: 30 }}>
                                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} hide />
                                    <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={80} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="value" name="Reports" fill="#EC4899" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#888888', fontSize: 12 }}>
                                        {
                                            analytics.subjectData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={['#EC4899', '#8B5CF6', '#F59E0B', '#10B981'][index % 4]} />
                                            ))
                                        }
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Enhanced Admin Leaderboard */}
                    <Card className={`${glassmorphism.light} border-0 shadow-lg`}>
                        <CardHeader className="border-b border-gray-100 dark:border-white/5">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-indigo-500" />
                                Top Solvers
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 overflow-y-auto max-h-[300px] custom-scrollbar">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-none hover:bg-transparent">
                                        <TableHead className="pl-4 h-10 text-xs uppercase tracking-wider">Admin</TableHead>
                                        <TableHead className="text-right pr-4 h-10 text-xs uppercase tracking-wider">Resolved</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {analytics.topAdmins.map((admin, idx) => (
                                        <TableRow key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5 border-gray-100 dark:border-white/5">
                                            <TableCell className="pl-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm
                                                        ${idx === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-500/20 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                                                        ${idx === 1 ? 'bg-gray-100 text-gray-700 ring-2 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-300' : ''}
                                                        ${idx === 2 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-500/20 dark:bg-orange-900/30 dark:text-orange-400' : ''}
                                                        ${idx > 2 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : ''}
                                                    `}>
                                                        {idx + 1}
                                                    </div>
                                                    <span className="text-sm font-medium">{admin.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="pr-4 text-right font-bold text-green-600 dark:text-green-400">
                                                {admin.count}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {analytics.topAdmins.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-muted-foreground py-6 text-sm">No activity recorded for this period.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    {/* Reports List */}
                    <Card className={`${glassmorphism.light} border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10`}>
                        <CardHeader className="border-b border-gray-100 dark:border-white/5">
                            <CardTitle>Detailed Reports</CardTitle>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-gray-100 dark:border-white/5">
                                        <TableHead>Status</TableHead>
                                        <TableHead>Issue</TableHead>
                                        <TableHead>Question</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredReports.map((report) => (
                                        <TableRow key={report.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 cursor-pointer border-gray-100 dark:border-white/5" onClick={() => openReply(report)}>
                                            <TableCell>
                                                <Badge variant="outline" className={`
                                                        ${report.status === 'pending' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800' : ''}
                                                        ${report.status === 'resolved' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : ''}
                                                        ${report.status === 'ignored' ? 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700' : ''}
                                                        ${report.status === 'approval_required' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : ''}
                                                        capitalize
                                                    `}>
                                                    {report.status.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px]">
                                                <div className="font-medium text-gray-900 dark:text-gray-200 truncate">{report.issue}</div>
                                                <div className="text-xs text-muted-foreground truncate">{report.studentName}</div>
                                            </TableCell>
                                            <TableCell className="max-w-[250px] truncate text-muted-foreground" title={report.questionText.replace(/<[^>]+>/g, '')}>
                                                {report.questionText.replace(/<[^>]+>/g, '')}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                {report.createdAt?.seconds ? format(new Date(report.createdAt.seconds * 1000), 'MMM d, p') : 'N/A'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openReply(report); }}>
                                                    <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredReports.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                                {userRole === 'teacher' && teacherSubjects.length === 0
                                                    ? "You have no subjects assigned. Please contact an administrator."
                                                    : "No reports found matching your filters."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>

                </div>

                {/* Reply Dialog */}
                <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl">Report Resolution</DialogTitle>
                            <DialogDescription>Review full question details and student issue.</DialogDescription>
                        </DialogHeader>

                        {selectedReport && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                                {/* Left: Question Content */}
                                <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
                                    <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-2">
                                        <BookOpen className="w-5 h-5 text-indigo-500" />
                                        Question Details
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="prose dark:prose-invert max-w-none text-sm bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                                            <div dangerouslySetInnerHTML={{ __html: questionDetails?.questionText || selectedReport.questionText }} />
                                            {/* Images */}
                                            {questionDetails?.images && questionDetails.images.length > 0 && (
                                                <div className="mt-4 grid gap-2">
                                                    {questionDetails.images.map((img, i) => (
                                                        <div key={i} className="rounded-lg border border-gray-200 dark:border-white/10 max-h-[300px] overflow-hidden">
                                                            <Image src={img} alt={`Question image ${i + 1}`} width={800} height={600} className="object-contain" unoptimized={true} />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Options */}
                                        <div className="grid gap-2">
                                            {(questionDetails?.options || selectedReport.options || []).map((opt, i) => {
                                                const correct = questionDetails?.correctAnswer || selectedReport.correctAnswer;
                                                const isCorrectKey = opt === correct;
                                                return (
                                                    <div key={i} className={`p-3 rounded-lg border text-sm flex items-center gap-3 ${isCorrectKey ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50' : 'bg-white dark:bg-transparent border-gray-200 dark:border-white/10'}`}>
                                                        {isCorrectKey ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" /> : <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 shrink-0" />}
                                                        <span className={isCorrectKey ? 'font-medium text-green-900 dark:text-green-300' : ''}>{opt}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Explanation */}
                                        {questionDetails?.explanation && (
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/20 space-y-2">
                                                <div className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Explanation</div>
                                                <div className="text-sm prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: questionDetails.explanation }} />
                                            </div>
                                        )}

                                        {/* Metadata */}
                                        <div className="flex flex-wrap gap-2 pt-2">
                                            {(questionDetails?.subject || selectedReport.subject) && <Badge variant="outline">{questionDetails?.subject || selectedReport.subject}</Badge>}
                                            {(questionDetails?.topic || selectedReport.topic) && <Badge variant="outline">{questionDetails?.topic || selectedReport.topic}</Badge>}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Issue & resolution */}
                                <div className="space-y-6 flex flex-col h-full">
                                    <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-2">
                                        <AlertCircle className="w-5 h-5 text-red-500" />
                                        Issue & Resolution
                                    </h3>

                                    <div className="space-y-4 flex-1">
                                        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl space-y-2">
                                            <div className="flex justify-between items-center text-xs text-red-700 dark:text-red-400 font-semibold uppercase">
                                                <span>Reported by: {selectedReport.studentName}</span>
                                                <span>{selectedReport.createdAt?.seconds ? format(new Date(selectedReport.createdAt.seconds * 1000), 'MMM d, p') : ''}</span>
                                            </div>
                                            <p className="text-red-900 dark:text-red-200 text-sm font-medium">&quot;{selectedReport.issue}&quot;</p>
                                        </div>

                                        <div className="space-y-2 pt-4">
                                            <Label>Admin Response</Label>
                                            <Textarea
                                                value={replyText}
                                                onChange={e => setReplyText(e.target.value)}
                                                placeholder="Write a message to the student explaining the resolution..."
                                                className="min-h-[150px] resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                                        <Button variant="outline" onClick={() => handleReplySubmit('ignored')} disabled={replying} className="w-full text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                                            Ignore Report
                                        </Button>

                                        {selectedReport.status === 'approval_required' && userRole !== 'teacher' ? (
                                            <Button onClick={() => handleReplySubmit('resolved')} disabled={replying} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                                {replying ? 'Processing...' : 'Approve Resolution'}
                                            </Button>
                                        ) : (
                                            <Button onClick={() => handleReplySubmit('resolved')} disabled={replying || !replyText.trim()} className="w-full bg-green-600 hover:bg-green-700 text-white">
                                                {replying ? 'Processing...' : (userRole === 'teacher' ? 'Submit for Approval' : 'Mark Resolved & Reply')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
