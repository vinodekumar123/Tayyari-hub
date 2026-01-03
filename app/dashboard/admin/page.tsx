'use client';

import { useEffect, useMemo, useState, memo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import {
  collection,
  collectionGroup,
  getCountFromServer,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';

import {
  Users, Trophy, Database, AlertCircle, FileText,
  BookOpen, Star, Zap, Activity, Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { cn, glassmorphism, gradients, animations, shadows } from '@/lib/design-tokens';

// --- Types ---
type Counts = {
  totalStudents: number;
  totalPremiumStudents: number;
  totalQuizzes: number;
  totalMockQuizzes: number;
  activeQuizzes: number;
  quizQuestions: number;
  mockQuestions: number;
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
  value: number;
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
              <span className="text-3xl font-bold tracking-tight text-foreground">{value.toLocaleString()}</span>
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

export default function AdminDashboard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>({
    totalStudents: 0,
    totalPremiumStudents: 0,
    totalQuizzes: 0,
    totalMockQuizzes: 0,
    activeQuizzes: 0,
    quizQuestions: 0,
    mockQuestions: 0,
  });

  // Auth Protection
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAdminUser(user);
        try {
          const docRef = await import('firebase/firestore').then(mod => mod.getDoc(mod.doc(db, 'users', user.uid)));
          const userData = docRef.data();
          if (!docRef.exists() || (userData?.admin !== true && userData?.admin !== 'true')) {
            router.push('/');
          }
        } catch (e) {
          router.push('/');
        }
      } else {
        router.push('/');
      }
    });
    return () => unsub();
  }, [router]);

  // Fast Data Loading
  useEffect(() => {
    let isMounted = true;
    const now = Timestamp.fromDate(new Date());

    async function loadCountsFast() {
      try {
        const [
          usersSnap,
          premiumSnap,
          quizzesSnap,
          mockQuizzesSnap,
          questionsSnap,
          mockQuestionsSnap,
          activeStartSnap,
        ] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'users'), where('plan', '==', 'premium'))),
          getCountFromServer(collection(db, 'quizzes')),
          getCountFromServer(collectionGroup(db, 'mock-quizzes')),
          getCountFromServer(collection(db, 'questions')),
          getCountFromServer(collection(db, 'mock-questions')),
          getCountFromServer(query(collection(db, 'quizzes'), where('startDate', '<=', now))),
        ]);

        const endedSnap = await getCountFromServer(
          query(collection(db, 'quizzes'), where('endDate', '<', now))
        );
        const active = Math.max(0, activeStartSnap.data().count - endedSnap.data().count);

        if (!isMounted) return;
        setCounts({
          totalStudents: usersSnap.data().count,
          totalPremiumStudents: premiumSnap.data().count,
          totalQuizzes: quizzesSnap.data().count,
          totalMockQuizzes: mockQuizzesSnap.data().count,
          quizQuestions: questionsSnap.data().count,
          mockQuestions: mockQuestionsSnap.data().count,
          activeQuizzes: active,
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCountsFast();
    const id = setInterval(loadCountsFast, 30_000);
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  const statDefs = useMemo(
    () => [
      {
        title: 'Total Students',
        value: counts.totalStudents,
        icon: <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
        gradient: 'bg-blue-500'
      },
      {
        title: 'Premium Users',
        value: counts.totalPremiumStudents,
        icon: <Star className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
        gradient: 'bg-amber-500'
      },
      {
        title: 'Total Quizzes',
        value: counts.totalQuizzes,
        icon: <Trophy className="h-6 w-6 text-violet-600 dark:text-violet-400" />,
        gradient: 'bg-violet-500'
      },
      {
        title: 'Active Now',
        value: counts.activeQuizzes,
        icon: <Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />,
        gradient: 'bg-emerald-500'
      },
      {
        title: 'Question Bank',
        value: counts.quizQuestions,
        icon: <Database className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />,
        gradient: 'bg-indigo-500'
      },
      {
        title: 'Mock Questions',
        value: counts.mockQuestions,
        icon: <BookOpen className="h-6 w-6 text-rose-600 dark:text-rose-400" />,
        gradient: 'bg-rose-500'
      },
    ],
    [counts]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative h-full">
      {/* Background Gradient Mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/10" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-40 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <main className="flex-1 overflow-y-auto relative z-10 p-6 md:p-8 space-y-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              Dashboard Overview
            </h1>
            <p className="text-muted-foreground mt-1 font-medium">
              Welcome back, {adminUser?.displayName?.split(' ')[0] || 'Admin'} 👋
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center px-4 py-2 rounded-full border bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm text-sm font-medium text-muted-foreground">
              <Clock className="w-4 h-4 mr-2 text-primary" />
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {statDefs.map((s) => (
            <StatCard key={s.title} {...s} loading={loading} />
          ))}
        </div>

        {/* Quick Actions Grid */}
        <h2 className="text-xl font-bold text-foreground mt-8 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          <QuickActionCard
            title="Create New Quiz"
            description="Set up a new quiz series, add questions, and schedule exams."
            icon={FileText}
            href="/admin/quizzes/create"
            colorClass="bg-blue-500"
          />
          <QuickActionCard
            title="Manage Students"
            description="View enrolled students, track progress, and manage access."
            icon={Users}
            href="/admin/students"
            colorClass="bg-violet-500"
          />
          <QuickActionCard
            title="View Results"
            description="Analyze performance reports and view individual scorecards."
            icon={Trophy}
            href="/admin/results"
            colorClass="bg-emerald-500"
          />
          <QuickActionCard
            title="Content Bank"
            description="Manage question libraries and update course content."
            icon={Database}
            href="/admin/questions/questionbank"
            colorClass="bg-indigo-500"
          />
        </div>

      </main>
    </div>
  );
}
