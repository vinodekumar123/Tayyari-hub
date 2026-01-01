'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Flag, MessageSquare, CheckCircle, BookOpen, AlertCircle, BarChart3, Search, Filter, Calendar } from 'lucide-react';
import { format, subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { glassmorphism } from '@/lib/design-tokens';
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

export default function TeacherReportsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [questionDetails, setQuestionDetails] = useState<QuestionDetails | null>(null);

    // Context
    const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]); // These are IDs
    const [authorized, setAuthorized] = useState(false);
    const [subjectsMap, setSubjectsMap] = useState<Record<string, string>>({}); // ID -> Name

    // Filters & Range
    const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'ignored' | 'approval_required'>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Reply State
    const [replyDialogOpen, setReplyDialogOpen] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [replying, setReplying] = useState(false);

    const router = useRouter();

    // Fetch Subjects Map on Mount
    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const snap = await getDocs(collection(db, 'subjects'));
                const map: Record<string, string> = {};
                snap.forEach(doc => {
                    const d = doc.data();
                    map[doc.id] = d.name; // ID -> Name
                });
                setSubjectsMap(map);
            } catch (e) {
                console.error("Failed to fetch subjects map", e);
            }
        };
        fetchSubjects();
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                router.push('/login');
            } else {
                try {
                    const snap = await getDoc(doc(db, 'users', u.uid));
                    if (snap.exists()) {
                        const d = snap.data();
                        const isTeacher = d.role === 'teacher' || d.teacher === true;

                        // Allow admins to view this page too if they really want, but primarily for teachers
                        const isAdmin = d.role === 'admin' || d.admin === true || d.superadmin === true;

                        if (!isTeacher && !isAdmin) {
                            toast.error("Unauthorized");
                            router.push('/dashboard/student');
                            return;
                        }

                        // Load assigned subjects (IDs)
                        setTeacherSubjects(d.subjects || []);
                        setAuthorized(true);
                        // Default filter isn't set, we show all "assigned" subjects by default
                    } else {
                        router.push('/');
                    }
                } catch (e) {
                    console.error(e);
                    router.push('/');
                }
            }
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!authorized) return;

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
            setLoading(false);
        });

        return () => unsubscribe();
    }, [authorized]);

    // Caching Logic
    const [questionsCache, setQuestionsCache] = useState<Record<string, { subject: string; topic?: string }>>({});

    useEffect(() => {
        const fetchMissingSubjects = async () => {
            const missingIds = reports
                .map(r => r.questionId)
                .filter(id => id && !questionsCache[id] && id !== 'undefined');

            const uniqueMissingIds = Array.from(new Set(missingIds));
            if (uniqueMissingIds.length === 0) return;

            const chunkSize = 10;
            for (let i = 0; i < uniqueMissingIds.length; i += chunkSize) {
                const chunk = uniqueMissingIds.slice(i, i + chunkSize);
                try {
                    const qQuestions = query(collection(db, 'questions'), where(documentId(), 'in', chunk));
                    const snap = await getDocs(qQuestions);

                    const newCache: Record<string, { subject: string; topic?: string }> = {};
                    snap.forEach(doc => {
                        const data = doc.data();
                        // Assuming question 'subject' field is NAME based on other files
                        newCache[doc.id] = { subject: data.subject || 'Unknown', topic: data.topic };
                    });

                    // Also cache questions that didn't have detailed metadata to prevent refetch loops
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
    }, [reports]);

    // Derived State
    // Resolve teacher subject IDs to Names for the dropdown
    const availableSubjects = useMemo(() => {
        if (!teacherSubjects.length) return [];
        // Map ID -> Name
        const names = teacherSubjects.map(id => subjectsMap[id]).filter(Boolean);
        // If map isn't ready or some IDs don't match, we might have partial list
        // If teacherSubjects contains NAMES directly (legacy data), handle that too
        const legacyNames = teacherSubjects.filter(id => !subjectsMap[id]); // Assume it's a name if not in map? 
        // Or safer: just unique sorted names
        return Array.from(new Set([...names, ...legacyNames])).sort();
    }, [teacherSubjects, subjectsMap]);

    // Filter Logic
    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            // STRICT Teacher Restriction
            const subject = questionsCache[r.questionId]?.subject || 'Unknown';

            // If user has no subjects, they see nothing
            // Enforce: report subject MUST be in availableSubjects (Names)
            // Note: teacherSubjects are IDs, availableSubjects are resolved Names.
            // Questions store Names. So we compare Name (report) vs Name (available)
            if (availableSubjects.length > 0 && !availableSubjects.includes(subject)) return false;

            // Filters
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (subjectFilter !== 'all' && subject !== subjectFilter) return false;

            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                if (!r.questionText.toLowerCase().includes(lower) &&
                    !r.studentName.toLowerCase().includes(lower) &&
                    !r.issue.toLowerCase().includes(lower)) return false;
            }

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
    }, [reports, statusFilter, searchTerm, dateRange, customStart, customEnd, availableSubjects, subjectFilter, questionsCache]);

    const analytics = useMemo(() => {
        const total = filteredReports.length;
        const pending = filteredReports.filter(r => r.status === 'pending').length;
        const resolved = filteredReports.filter(r => r.status === 'resolved').length;
        const ignored = filteredReports.filter(r => r.status === 'ignored').length;

        const trendMap: Record<string, { pending: number, resolved: number, ignored: number }> = {};
        filteredReports.forEach(r => {
            const date = r.createdAt?.seconds
                ? format(new Date(r.createdAt.seconds * 1000), 'MMM dd')
                : 'N/A';
            if (!trendMap[date]) trendMap[date] = { pending: 0, resolved: 0, ignored: 0 };
            trendMap[date][r.status] = (trendMap[date][r.status] || 0) + 1;
        });
        const dailyTrend = Object.entries(trendMap)
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(-14);

        const subjectCounts: Record<string, number> = {};
        filteredReports.forEach(r => {
            const sub = questionsCache[r.questionId]?.subject || 'Unknown';
            subjectCounts[sub] = (subjectCounts[sub] || 0) + 1;
        });
        const subjectData = Object.entries(subjectCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { total, pending, resolved, ignored, dailyTrend, subjectData };
    }, [filteredReports, questionsCache]);

    const openReply = (report: Report) => {
        setSelectedReport(report);
        setReplyText(report.adminReply || '');
        setReplyDialogOpen(true);
    };

    // Deep fetch details
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
            } catch (error) { console.error(error); }
        };
        fetchDetails();
    }, [selectedReport]);

    const handleReplySubmit = async (status: 'resolved' | 'ignored' | 'approval_required') => {
        if (!selectedReport || !user) return;
        setReplying(true);

        let finalStatus = status;
        // Teacher actions typically require approval
        if (status === 'resolved') {
            finalStatus = 'approval_required';
        }

        try {
            await updateDoc(doc(db, 'reported_questions', selectedReport.id), {
                adminReply: replyText,
                adminName: user.displayName || user.email || 'Teacher',
                status: finalStatus,
                resolvedAt: serverTimestamp()
            });
            toast.success(finalStatus === 'approval_required' ? 'Submitted for Approval' : `Report marked as ${finalStatus}`);
            setReplyDialogOpen(false);
        } catch (e) {
            toast.error("Failed to update report");
        } finally {
            setReplying(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    if (!authorized) return null;

    return (
        <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50 via-background to-background dark:from-indigo-900/10 dark:via-background dark:to-background p-6 md:p-8">
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Unified Header */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
                    <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2">
                                    My Reports
                                </h1>
                                <p className="text-muted-foreground font-semibold flex items-center gap-2">
                                    <Flag className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]" />
                                    Manage reported questions for your assigned subjects
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className={`${glassmorphism.light} p-4 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 items-end`}>
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
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Subject</Label>
                        <select
                            value={subjectFilter}
                            onChange={(e) => setSubjectFilter(e.target.value)}
                            className="w-full h-10 px-3 rounded-md bg-white/50 dark:bg-black/20 border-0 ring-1 ring-gray-200 dark:ring-gray-800 text-sm focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all" className="dark:bg-gray-900">All My Subjects</option>
                            {availableSubjects.map(sub => (
                                <option key={sub} value={sub} className="dark:bg-gray-900">{sub}</option>
                            ))}
                        </select>
                    </div>
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
                </div>

                {/* Analytics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-white/60 dark:bg-white/5 border-white/20 dark:border-white/10 shadow hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-amber-500">{analytics.pending}</div>
                            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/60 dark:bg-white/5 border-white/20 dark:border-white/10 shadow hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Handled</CardTitle></CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-indigo-500">{analytics.resolved + analytics.ignored}</div>
                            <p className="text-xs text-muted-foreground mt-1">Resolved or Ignored cases</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/60 dark:bg-white/5 border-white/20 dark:border-white/10 shadow hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Subject Spread</CardTitle></CardHeader>
                        <CardContent className="h-[100px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.subjectData}>
                                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* Reports Table */}
                <Card className={`${glassmorphism.light} border-0 shadow-xl ring-1 ring-black/5 dark:ring-white/10`}>
                    <CardHeader className="border-b border-gray-100 dark:border-white/5">
                        <CardTitle>Reports Queue</CardTitle>
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
                                    <TableRow key={report.id} onClick={() => openReply(report)} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 border-gray-100 dark:border-white/5">
                                        <TableCell>
                                            <Badge variant="outline" className={`
                                                ${report.status === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' : ''}
                                                ${report.status === 'resolved' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : ''}
                                                ${report.status === 'approval_required' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : ''}
                                                ${report.status === 'ignored' ? 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700' : ''}
                                                capitalize
                                             `}>
                                                {report.status.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[200px]">
                                            <div className="font-medium truncate text-gray-900 dark:text-gray-200">{report.issue}</div>
                                            <div className="text-xs text-muted-foreground">{report.studentName}</div>
                                        </TableCell>
                                        <TableCell className="max-w-[250px] truncate text-muted-foreground" title={report.questionText.replace(/<[^>]+>/g, '')}>
                                            {report.questionText.replace(/<[^>]+>/g, '')}
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                            {report.createdAt?.seconds ? format(new Date(report.createdAt.seconds * 1000), 'MMM d, p') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost">
                                                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredReports.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                            {teacherSubjects.length === 0
                                                ? "You have no assigned subjects. Please contact admin."
                                                : "No reports found."}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                {/* Dialog */}
                <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Resolve Report</DialogTitle>
                        </DialogHeader>
                        {selectedReport && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                                <div className="space-y-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
                                    <h3 className="font-bold border-b pb-2 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-indigo-500" /> Question Context
                                    </h3>
                                    <div className="prose dark:prose-invert text-sm p-4 bg-muted/30 rounded-lg border border-gray-100 dark:border-white/5">
                                        <div dangerouslySetInnerHTML={{ __html: questionDetails?.questionText || selectedReport.questionText }} />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg">
                                        <div className="text-xs text-red-700 dark:text-red-400 font-semibold uppercase flex items-center gap-2">
                                            <AlertCircle className="w-3 h-3" /> Student Issue
                                        </div>
                                        <p className="text-red-900 dark:text-red-200 text-sm mt-1">"{selectedReport.issue}"</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Your Reply</Label>
                                        <Textarea
                                            value={replyText}
                                            onChange={e => setReplyText(e.target.value)}
                                            placeholder="Explain the fix or why it was ignored..."
                                            className="min-h-[120px] resize-none"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 dark:border-white/5">
                                        <Button variant="outline" onClick={() => handleReplySubmit('ignored')} disabled={replying} className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20">
                                            Ignore
                                        </Button>
                                        <Button onClick={() => handleReplySubmit('resolved')} disabled={replying || !replyText.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                            {replying ? 'Sending...' : 'Submit Resolution'}
                                        </Button>
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
