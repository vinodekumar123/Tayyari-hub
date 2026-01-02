'use client';

import React, { useEffect, useState } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, limit, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Flag, MessageSquare, CheckCircle, Clock, AlertCircle, BookOpen, Layers, Check, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { glassmorphism } from '@/lib/design-tokens';
import parse from 'html-react-parser';

interface Report {
    id: string;
    questionId: string;
    questionText: string;
    options?: string[]; // Optional for backward compatibility
    correctAnswer?: string;
    subject?: string;
    topic?: string;

    issue: string;
    status: 'pending' | 'resolved' | 'ignored';
    adminReply?: string;
    adminName?: string;
    createdAt: any;
    quizId: string;
}

export default function StudentReportsPage() {
    const [user, setUser] = useState<User | null>(null);
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'ignored'>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');
    const router = useRouter();

    // Get unique subjects with robust handling
    const subjects = Array.from(new Set(reports.map(r => (r.subject || 'Uncategorized').trim()).filter(Boolean))) as string[];

    const filteredReports = reports.filter(report => {
        const matchStatus = statusFilter === 'all' || report.status === statusFilter;
        const reportSubject = (report.subject || 'Uncategorized').trim();
        const matchSubject = subjectFilter === 'all' || reportSubject === subjectFilter;
        return matchStatus && matchSubject;
    });

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) router.push('/login');
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!user) return;

        // Optimization: Fetch all and sort client-side to avoid index/timestamp issues
        const q = query(
            collection(db, 'reported_questions'),
            where('studentId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Report[];
                // Client-side sort by createdAt descending
                // Handle potential missing/null createdAt during serverTimestamp resolution
                const sortedData = data.sort((a, b) => {
                    const timeA = a.createdAt?.seconds ? a.createdAt.seconds :
                        (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
                    const timeB = b.createdAt?.seconds ? b.createdAt.seconds :
                        (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
                    return timeB - timeA;
                });

                setReports(sortedData);
                setLoading(false);
            },
            (error) => {
                console.error("Firestore Error:", error);
                if (error.code === 'failed-precondition') {
                    toast.error("Database Index Missing. Please Check Console.");
                } else {
                    toast.error("Failed to load reports");
                }
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const fetchMissingData = async () => {
            if (reports.length === 0) return;

            const updates = new Map<string, Partial<Report>>();
            const missingDataReports = reports.filter(r => !r.subject || !r.options || r.options.length === 0);

            if (missingDataReports.length === 0) return;

            // Fetch question data for reports with missing info
            await Promise.all(missingDataReports.map(async (report) => {
                try {
                    const qDoc = await getDoc(doc(db, 'questions', report.questionId));
                    if (qDoc.exists()) {
                        const qData = qDoc.data();
                        updates.set(report.id, {
                            subject: qData.subject || 'Uncategorized',
                            options: qData.options || [],
                            questionText: qData.questionText || report.questionText, // Update text too just in case
                            correctAnswer: qData.correctAnswer || report.correctAnswer
                        });
                    }
                } catch (err) {
                    console.error(`Failed to fetch question ${report.questionId}`, err);
                }
            }));

            if (updates.size > 0) {
                setReports(prev => prev.map(r => updates.has(r.id) ? { ...r, ...updates.get(r.id) } : r));
            }
        };
        fetchMissingData();
    }, [reports]); // Run when reports are loaded

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6 md:p-12">
                <div className="max-w-4xl mx-auto space-y-8">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="h-8 w-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
                        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse" />
                    </div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white dark:bg-white/5 rounded-xl h-64 border border-gray-100 dark:border-white/10 animate-pulse shadow-sm p-6 space-y-4">
                            <div className="h-6 w-1/3 bg-gray-100 dark:bg-white/10 rounded" />
                            <div className="h-24 w-full bg-gray-50 dark:bg-white/5 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background p-6 md:p-12">
            <div className="max-w-5xl mx-auto space-y-8">
                <header>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 flex items-center gap-3">
                        <Flag className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        Reported Questions
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">Track the status of your reported issues and view admin replies.</p>
                </header>

                {/* Filters */}
                <div className={`${glassmorphism.light} p-5 rounded-2xl border border-white/20 dark:border-white/10 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between`}>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Filter className="w-4 h-4" />
                        </div>
                        <span>Filter Reports:</span>
                    </div>
                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="appearance-none pl-4 pr-10 py-2.5 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer min-w-[140px]"
                            >
                                <option value="all" className="dark:bg-gray-900">All Status</option>
                                <option value="pending" className="dark:bg-gray-900">Pending</option>
                                <option value="resolved" className="dark:bg-gray-900">Resolved</option>
                                <option value="ignored" className="dark:bg-gray-900">Ignored</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        <div className="relative">
                            <select
                                value={subjectFilter}
                                onChange={(e) => setSubjectFilter(e.target.value)}
                                className="appearance-none pl-4 pr-10 py-2.5 bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer min-w-[140px]"
                            >
                                <option value="all" className="dark:bg-gray-900">All Subjects</option>
                                {subjects.map(sub => (
                                    <option key={sub} value={sub} className="dark:bg-gray-900">{sub}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        {(statusFilter !== 'all' || subjectFilter !== 'all') && (
                            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setSubjectFilter('all'); }} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl h-[42px] px-4">
                                Reset Filters
                            </Button>
                        )}
                    </div>
                </div>

                {filteredReports.length === 0 ? (
                    <div className={`${glassmorphism.light} text-center py-20 rounded-2xl shadow-sm border border-white/20 dark:border-white/10`}>
                        <CheckCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4 p-3 bg-gray-50 dark:bg-white/5 rounded-full" />
                        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">No Reports Found</h3>
                        <p className="text-gray-500 dark:text-gray-400 mt-2">
                            {reports.length > 0 ? "Try adjusting your filters." : "You haven't reported any questions yet."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {filteredReports.map((report) => (
                            <Card key={report.id} className={`${glassmorphism.light} overflow-hidden border-0 shadow-lg ring-1 ring-black/5 dark:ring-white/10 transition-all hover:shadow-xl`}>
                                <CardHeader className="bg-white/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 pb-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <Clock className="w-4 h-4" />
                                                {report.createdAt?.seconds ? format(new Date(report.createdAt.seconds * 1000), 'PPP p') :
                                                    (report.createdAt instanceof Date ? format(report.createdAt, 'PPP p') : 'Just now')}
                                            </div>
                                            <Badge variant={report.status === 'resolved' ? 'default' : report.status === 'ignored' ? 'destructive' : 'secondary'}
                                                className={`
                                                  ${report.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200' : ''}
                                                  ${report.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200' : ''}
                                                  ${report.status === 'ignored' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200' : ''}
                                                  capitalize
                                                `}
                                            >
                                                {report.status}
                                            </Badge>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Question Context</h3>
                                            {(report.subject || report.topic) && (
                                                <div className="flex gap-2 text-xs">
                                                    {report.subject && <Badge variant="outline" className="flex gap-1 items-center border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"><BookOpen className="w-3 h-3" /> {report.subject}</Badge>}
                                                    {report.topic && <Badge variant="outline" className="flex gap-1 items-center border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"><Layers className="w-3 h-3" /> {report.topic}</Badge>}
                                                </div>
                                            )}
                                        </div>

                                        {/* Question Text */}
                                        <div className="p-5 bg-gray-50/50 dark:bg-black/20 rounded-xl border border-gray-200/60 dark:border-white/5">
                                            {report.questionText ? (
                                                <div className="text-gray-900 dark:text-gray-100 font-medium text-lg leading-relaxed prose dark:prose-invert max-w-none"
                                                    dangerouslySetInnerHTML={{ __html: report.questionText }}
                                                />
                                            ) : (
                                                <div className="text-gray-400 italic flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4" />
                                                    Question text unavailable
                                                </div>
                                            )}
                                        </div>

                                        {/* Options & Correct Answer */}
                                        <div className="mt-4">
                                            {report.options && report.options.length > 0 ? (
                                                <div className="grid grid-cols-1 gap-2">
                                                    {report.options.map((opt, idx) => {
                                                        const isCorrect = report.correctAnswer === opt;
                                                        return (
                                                            <div key={idx} className={`p-3 rounded-lg border text-base flex items-center gap-3 transition-colors ${isCorrect
                                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-300 font-medium ring-1 ring-green-200 dark:ring-green-900/50'
                                                                : 'bg-white/50 dark:bg-white/5 border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-300'
                                                                }`}>
                                                                {isCorrect
                                                                    ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                                                                    : <div className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 flex-shrink-0" />
                                                                }
                                                                <span>{opt}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-gray-50/50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-500 dark:text-gray-400 text-center">
                                                    No options recorded for this question
                                                </div>
                                            )}

                                            {report.correctAnswer && (!report.options || report.options.length === 0) && (
                                                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium rounded-lg border border-green-100 dark:border-green-900/30 flex items-center gap-2">
                                                    <Check className="w-4 h-4" />
                                                    <span>Correct Answer: {report.correctAnswer}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Your Report</h3>
                                        {report.issue ? (
                                            <div className="text-gray-700 dark:text-gray-300 leading-relaxed bg-red-50/50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/20 prose dark:prose-invert max-w-none">
                                                {parse(report.issue)}
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 italic bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/10">
                                                No description provided
                                            </p>
                                        )}
                                    </div>

                                    {report.adminReply && (
                                        <div className="mt-6 pt-6 border-t border-dashed border-gray-200 dark:border-white/10">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                                                    <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="font-bold text-gray-900 dark:text-gray-100">Admin Reply</h4>
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">By {report.adminName || 'Admin'}</span>
                                                    </div>
                                                    <div className="text-gray-700 dark:text-gray-300 leading-relaxed bg-indigo-50/50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/20 prose dark:prose-invert max-w-none">
                                                        {parse(report.adminReply)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
