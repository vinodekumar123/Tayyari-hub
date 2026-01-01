'use client';

import { useEffect, useMemo, useState, memo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import {
    collection,
    getCountFromServer,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    documentId
} from 'firebase/firestore';
import {
    Users, Trophy, Database, AlertCircle, FileText,
    BookOpen, Star, Zap, Activity, Clock, Plus, Flag
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn, shadows, animations, glassmorphism } from '@/lib/design-tokens';

// --- Types ---
type TeacherStats = {
    myQuestions: number;
    myReports: number;
    pendingReports: number;
    assignedSubjectsCount: number;
    subjects: string[];
};

// --- Components ---

const StatCard = memo(function StatCard({
    title,
    value,
    icon,
    gradient,
    loading,
}: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    gradient: string;
    loading: boolean;
}) {
    return (
        <div className={cn(
            "relative group overflow-hidden rounded-2xl border p-6 transition-all duration-300",
            "bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 dark:border-slate-800",
            "hover:shadow-xl hover:scale-[1.02]",
            shadows.sm
        )}>
            {/* Dynamic Background Glow */}
            <div className={cn(
                "absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10 blur-2xl transition-all duration-500 group-hover:opacity-20",
                gradient
            )} />

            <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    {loading ? (
                        <Skeleton className="h-8 w-24 rounded-md bg-slate-200/50 dark:bg-slate-800/50" />
                    ) : (
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold tracking-tight text-foreground">{value}</span>
                        </div>
                    )}
                </div>
                <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl shadow-inner",
                    "bg-gradient-to-br from-white/80 to-white/20 dark:from-slate-800 dark:to-slate-900",
                    "border border-white/20 dark:border-slate-700 backdrop-blur-md"
                )}>
                    {icon}
                </div>
            </div>
        </div>
    );
});

const QuickActionCard = ({
    title,
    description,
    icon: Icon,
    href,
    colorClass
}: {
    title: string,
    description: string,
    icon: any,
    href: string,
    colorClass: string
}) => (
    <Link href={href} className="block group">
        <div className={cn(
            "h-full p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden",
            "bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 dark:border-slate-800",
            "hover:border-primary/20 hover:shadow-lg dark:hover:border-primary/40",
            animations.smoothScaleSmall
        )}>
            <div className={cn(
                "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300",
                colorClass
            )} />
            <div className="flex items-start gap-4">
                <div className={cn(
                    "p-3 rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110",
                    "bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900",
                    "border border-slate-100 dark:border-slate-700"
                )}>
                    <Icon className={cn("h-6 w-6", colorClass.replace('bg-', 'text-'))} />
                </div>
                <div>
                    <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                        {title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    </Link>
);

// --- Main Page ---

export default function TeacherDashboard() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<TeacherStats>({
        myQuestions: 0,
        myReports: 0,
        pendingReports: 0,
        assignedSubjectsCount: 0,
        subjects: []
    });

    // Auth Protection & Data Fetching
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));

                    if (!userDoc.exists()) {
                        router.push('/');
                        return;
                    }

                    const userData = userDoc.data();

                    // Robust Role Verification
                    const isTeacher = userData.role === 'teacher' || userData.teacher === true;
                    const isAdmin = userData.admin === true || userData.role === 'admin';
                    const isSuperAdmin = userData.role === 'superadmin' || userData.superadmin === true;

                    // Allow Teachers, Admins, SuperAdmins
                    if (!isTeacher && !isAdmin && !isSuperAdmin) {
                        toast.error("Access Denied: You are not authorized to view this page.");
                        router.push('/dashboard/student');
                        return;
                    }

                    // Fetch Stats
                    const subjects = userData.subjects || [];

                    // Count Questions created by this user (Assuming createdBy field exists or we loosely count)
                    // Actually question creation usually tracks 'createdBy'
                    // If 'createdBy' isn't indexed, this might fail. For now, let's try.
                    // If not indexed, we might skip or handle error. Safest is to just count subjects for now 
                    // or use the 'questions' collection if indexed.

                    let myQuestionsCount = 0;
                    try {
                        const qSnap = await getCountFromServer(query(collection(db, 'questions'), where('createdBy', '==', user.uid)));
                        myQuestionsCount = qSnap.data().count;
                    } catch (e) {
                        console.warn("Could not fetch my questions count (index might be missing)", e);
                    }

                    // Reports (Involving assigned subjects)
                    // This is complex without a direct 'assignedTo' field on reports. 
                    // We can just fetch all reports and filter in memory if small, or just show TOTAL reports for now.
                    // Better: Count reports where status is 'pending' (Todo)

                    // 1. Resolve Subject Names First
                    let subjectNames: string[] = [];
                    let teacherSubjectNames: string[] = [];

                    try {
                        const subjectsRef = collection(db, 'subjects');
                        const subjectSnap = await getDocs(subjectsRef);
                        const subjectMap = new Map();
                        subjectSnap.forEach(doc => {
                            subjectMap.set(doc.id, doc.data().name);
                        });

                        if (subjects.length > 0) {
                            subjects.forEach((id: string) => {
                                if (subjectMap.has(id)) {
                                    const name = subjectMap.get(id);
                                    subjectNames.push(name);
                                    teacherSubjectNames.push(name);
                                } else {
                                    subjectNames.push(id); // Fallback
                                    teacherSubjectNames.push(id);
                                }
                            });
                        }
                    } catch (e) {
                        console.error("Error fetching subjects", e);
                        subjectNames = [...subjects];
                        teacherSubjectNames = [...subjects];
                    }

                    // 2. Filtered Pending Reports
                    let pendingReportsCount = 0;
                    try {
                        // Fetch all pending reports
                        const rQuery = query(collection(db, 'reported_questions'), where('status', '==', 'pending'));
                        const rSnap = await getDocs(rQuery);
                        const pendingReports = rSnap.docs.map(d => d.data());

                        if (pendingReports.length > 0) {
                            const questionIds = Array.from(new Set(pendingReports.map(r => r.questionId).filter(id => id)));

                            // Fetch questions to check subjects
                            const validQuestionIds = new Set();
                            const chunkSize = 10;
                            for (let i = 0; i < questionIds.length; i += chunkSize) {
                                const chunk = questionIds.slice(i, i + chunkSize);
                                if (chunk.length === 0) continue;

                                const qSnap = await getDocs(query(collection(db, 'questions'), where(documentId(), 'in', chunk)));
                                qSnap.forEach(doc => {
                                    const qData = doc.data();
                                    // Check if question subject matches any of teacher's subjects
                                    if (teacherSubjectNames.includes(qData.subject)) {
                                        validQuestionIds.add(doc.id);
                                    }
                                });
                            }

                            // Count reports that belong to valid questions
                            pendingReportsCount = pendingReports.filter(r => validQuestionIds.has(r.questionId)).length;
                        }

                    } catch (e) {
                        console.error("Error calculating pending reports", e);
                    }

                    setStats({
                        myQuestions: myQuestionsCount,
                        myReports: 0,
                        pendingReports: pendingReportsCount,
                        assignedSubjectsCount: subjects.length,
                        subjects: subjectNames
                    });

                    setLoading(false);

                } catch (e) {
                    console.error("Error fetching teacher dashboard data", e);
                    router.push('/');
                }
            } else {
                router.push('/');
            }
        });
        return () => unsub();
    }, [router]);

    const statDefs = useMemo(
        () => [
            {
                title: 'Assigned Subjects',
                value: stats.assignedSubjectsCount,
                icon: <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
                gradient: 'bg-blue-500'
            },
            {
                title: 'My Questions',
                value: stats.myQuestions,
                icon: <Database className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
                gradient: 'bg-indigo-500'
            },
            {
                title: 'Pending Reports',
                value: stats.pendingReports,
                icon: <Flag className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
                gradient: 'bg-amber-500'
            },
        ],
        [stats]
    );

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative h-full">
            {/* Background Gradient Mesh */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-900/10" />
                <div className="absolute top-20 right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
            </div>

            <main className="flex-1 overflow-y-auto relative z-10 p-6 md:p-8 space-y-8">

                {/* Header */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
                    <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2">
                                    Teacher Workspace
                                </h1>
                                <p className="text-muted-foreground font-semibold mt-1">
                                    Welcome, {currentUser?.displayName?.split(' ')[0] || 'Teacher'}! Manage your content efficiently.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="hidden md:flex items-center px-4 py-2 rounded-full border bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-sm font-medium text-muted-foreground">
                                    <Clock className="w-4 h-4 mr-2 text-[#00B4D8]" />
                                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Subject Pills */}
                {stats.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
                        {stats.subjects.map(sub => (
                            <span key={sub} className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {sub}
                            </span>
                        ))}
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {statDefs.map((s) => (
                        <StatCard key={s.title} {...s} loading={loading} />
                    ))}
                </div>

                {/* Quick Actions */}
                <h2 className="text-xl font-bold text-foreground mt-8 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    Quick Actions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                    <QuickActionCard
                        title="Add New Question"
                        description="Create a new question in your assigned subjects."
                        icon={Plus}
                        href="/admin/questions/create"
                        colorClass="bg-emerald-500"
                    />
                    <QuickActionCard
                        title="Question Bank"
                        description="Browse and edit existing questions."
                        icon={Database}
                        href="/admin/questions/questionbank"
                        colorClass="bg-blue-500"
                    />
                    <QuickActionCard
                        title="Review Reports"
                        description="Check and resolve assigned question reports."
                        icon={Flag}
                        href="/dashboard/teacher/reports"
                        colorClass="bg-amber-500"
                    />
                </div>

            </main>
        </div>

    );
}
