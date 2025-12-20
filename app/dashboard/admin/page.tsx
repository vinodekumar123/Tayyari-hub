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
  onSnapshot,
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar';
import { Users, Trophy, Database, AlertCircle, FileText, BookOpen, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

type Counts = {
  totalStudents: number;
  totalPremiumStudents: number;
  totalQuizzes: number;
  totalMockQuizzes: number;
  activeQuizzes: number;
  quizQuestions: number;
  mockQuestions: number;
};

const StatCard = memo(function StatCard({
  title,
  value,
  icon,
  bg,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  bg: string;
  loading: boolean;
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {loading ? (
              <Skeleton className="h-6 w-16 mt-2" />
            ) : (
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            )}
          </div>
          <div className={`p-3 rounded-full ${bg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
});

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

  // Auth with stricter Admin Check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setAdminUser(user);
        try {
          // Check if custom claims or Firestore document confirms admin
          const userDoc = await getCountFromServer(query(collection(db, 'users'), where('uid', '==', user.uid), where('admin', '==', true)));
          // Alternatively, since we are in a component, fetching the doc is safer to be sure
          const docRef = await import('firebase/firestore').then(mod => mod.getDoc(mod.doc(db, 'users', user.uid)));

          if (docRef.exists() && docRef.data().admin === true) {
            // Authorized
          } else {
            router.push('/');
          }
        } catch (e) {
          console.error(e);
          router.push('/');
        }
      } else {
        router.push('/');
      }
    });

    return () => unsub();
  }, [router]);

  // Fast counts using index-only aggregations (instant + minimal bytes)
  useEffect(() => {
    let isMounted = true;

    const now = Timestamp.fromDate(new Date());

    async function loadCountsFast() {
      try {
        const [
          usersCountSnap,
          premiumCountSnap,
          quizzesCountSnap,
          mockQuizzesCountSnap,
          questionsCountSnap,
          mockQuestionsCountSnap,
          // Active quizzes fast path: requires a composite index and ONE range.
          // If you can store isActive or a precomputed windowStart, use that instead.
          activeStartSnap, // startDate <= now
        ] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(query(collection(db, 'users'), where('plan', '==', 'premium'))),
          getCountFromServer(collection(db, 'quizzes')),
          getCountFromServer(collectionGroup(db, 'mock-quizzes')),
          getCountFromServer(collection(db, 'questions')),
          getCountFromServer(collection(db, 'mock-questions')),
          getCountFromServer(query(collection(db, 'quizzes'), where('startDate', '<=', now))),
        ]);

        // Active quizzes workaround (single-range limitation):
        // Count docs with startDate <= now, then subtract those already ended.
        // (This still uses index-only counts, so it's very fast.)
        const endedSnap = await getCountFromServer(
          query(collection(db, 'quizzes'), where('endDate', '<', now))
        );
        const active = Math.max(0, activeStartSnap.data().count - endedSnap.data().count);

        if (!isMounted) return;
        setCounts({
          totalStudents: usersCountSnap.data().count,
          totalPremiumStudents: premiumCountSnap.data().count,
          totalQuizzes: quizzesCountSnap.data().count,
          totalMockQuizzes: mockQuizzesCountSnap.data().count,
          quizQuestions: questionsCountSnap.data().count,
          mockQuestions: mockQuestionsCountSnap.data().count,
          activeQuizzes: active,
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadCountsFast();
    // Refresh occasionally while staying cheap (no huge snapshots):
    const id = setInterval(loadCountsFast, 30_000); // every 30s
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, []);

  const statDefs = useMemo(
    () => [
      { title: 'Total Students', value: counts.totalStudents, icon: <Users className="h-6 w-6 text-blue-600" />, bg: 'bg-blue-100' },
      { title: 'Total Premium Students', value: counts.totalPremiumStudents, icon: <Star className="h-6 w-6 text-indigo-600" />, bg: 'bg-indigo-100' },
      { title: 'Total Quizzes', value: counts.totalQuizzes, icon: <Trophy className="h-6 w-6 text-green-600" />, bg: 'bg-green-100' },
      { title: 'Mock Quizzes', value: counts.totalMockQuizzes, icon: <FileText className="h-6 w-6 text-yellow-600" />, bg: 'bg-yellow-100' },
      { title: 'Active Quizzes', value: counts.activeQuizzes, icon: <AlertCircle className="h-6 w-6 text-red-600" />, bg: 'bg-red-100' },
      { title: 'Quiz Questions', value: counts.quizQuestions, icon: <Database className="h-6 w-6 text-purple-600" />, bg: 'bg-purple-100' },
      { title: 'Mock Questions', value: counts.mockQuestions, icon: <BookOpen className="h-6 w-6 text-pink-600" />, bg: 'bg-pink-100' },
    ],
    [counts]
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600">Quick platform analytics</p>
            </div>
            {adminUser && (
              <div className="flex items-center space-x-3">
                <img
                  src={adminUser.photoURL || '/default-avatar.png'}
                  alt="Admin Avatar"
                  className="w-10 h-10 rounded-full object-cover border"
                />
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">{adminUser.displayName || 'Admin'}</p>
                  <p className="text-xs text-gray-500 truncate">{adminUser.email}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {statDefs.map((s) => (
              <StatCard key={s.title} {...s} loading={loading} />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/quizzes/create" passHref>
              <Button className="h-24 w-full flex flex-col justify-center items-center space-y-2">
                <span className="text-lg font-semibold">Create Quiz</span>
              </Button>
            </Link>
            <Link href="/admin/students" passHref>
              <Button variant="outline" className="h-24 w-full flex flex-col justify-center items-center space-y-2">
                <span className="text-lg font-semibold">Manage Students</span>
              </Button>
            </Link>
            <Link href="/admin/results" passHref>
              <Button variant="outline" className="h-24 w-full flex flex-col justify-center items-center space-y-2">
                <span className="text-lg font-semibold">View Results</span>
              </Button>
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
