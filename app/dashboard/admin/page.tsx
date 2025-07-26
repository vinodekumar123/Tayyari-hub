'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar';
import { Users, Trophy, Database, AlertCircle, FileText, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export default function AdminDashboard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [mockQuizzes, setMockQuizzes] = useState<any[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [mockQuestions, setMockQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) setAdminUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const unsubscribeFirestore = onSnapshot(collection(db, 'users'), (snapshot) => {
      const studentList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentList);
    });

    return () => unsubscribeFirestore();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      const [quizSnap, mockSnap, quizQSnap, mockQSnap] = await Promise.all([
        getDocs(collection(db, 'quizzes')),
        getAllMockQuizzes(),
        getDocs(collection(db, 'questions')),
        getDocs(collection(db, 'mock-questions')),
      ]);

      const now = new Date();
      const quizzesData = quizSnap.docs.map(doc => doc.data());
      const active = quizzesData.filter(q => {
        const start = new Date(q.startDate);
        const end = new Date(q.endDate);
        return now >= start && now <= end;
      });

      setQuizzes(quizzesData);
      setMockQuizzes(mockSnap);
      setQuizQuestions(quizQSnap.docs.map(doc => doc.data()));
      setMockQuestions(mockQSnap.docs.map(doc => doc.data()));
      setLoading(false);
    };

    fetchStats();
  }, []);

  const getAllMockQuizzes = async () => {
    const userSnap = await getDocs(collection(db, 'users'));
    const allMockQuizzes = [];
    for (const docRef of userSnap.docs) {
      const subSnap = await getDocs(collection(db, `users/${docRef.id}/mock-quizzes`));
      subSnap.forEach(doc => allMockQuizzes.push(doc.data()));
    }
    return allMockQuizzes;
  };

  const dashboardStats = {
    totalStudents: students.length,
    totalQuizzes: quizzes.length,
    totalMockQuizzes: mockQuizzes.length,
    activeQuizzes: quizzes.filter(q => {
      const now = new Date();
      const start = new Date(q.startDate);
      const end = new Date(q.endDate);
      return now >= start && now <= end;
    }).length,
    quizQuestions: quizQuestions.length,
    mockQuestions: mockQuestions.length,
  };

  const StatCard = ({ title, value, icon, bg }: any) => (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {loading ? <Skeleton className="h-6 w-16 mt-2" /> : <p className="text-2xl font-bold text-gray-900">{value}</p>}
          </div>
          <div className={`p-3 rounded-full ${bg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
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
                  <p className="text-sm font-semibold text-gray-800">
                    {adminUser.displayName || 'Admin'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{adminUser.email}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard title="Total Students" value={dashboardStats.totalStudents} icon={<Users className="h-6 w-6 text-blue-600" />} bg="bg-blue-100" />
            <StatCard title="Total Quizzes" value={dashboardStats.totalQuizzes} icon={<Trophy className="h-6 w-6 text-green-600" />} bg="bg-green-100" />
            <StatCard title="Mock Quizzes" value={dashboardStats.totalMockQuizzes} icon={<FileText className="h-6 w-6 text-yellow-600" />} bg="bg-yellow-100" />
            <StatCard title="Active Quizzes" value={dashboardStats.activeQuizzes} icon={<AlertCircle className="h-6 w-6 text-red-600" />} bg="bg-red-100" />
            <StatCard title="Quiz Questions" value={dashboardStats.quizQuestions} icon={<Database className="h-6 w-6 text-purple-600" />} bg="bg-purple-100" />
            <StatCard title="Mock Questions" value={dashboardStats.mockQuestions} icon={<BookOpen className="h-6 w-6 text-pink-600" />} bg="bg-pink-100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="" passHref>
              <Button className="h-24 w-full flex flex-col justify-center items-center space-y-2">
                <span className="text-lg font-semibold">Create Quiz</span>
              </Button>
            </Link>
            <Link href="/admin/students" passHref>
              <Button variant="outline" className="h-24 w-full flex flex-col justify-center items-center space-y-2">
                <span className="text-lg font-semibold">Manage Students</span>
              </Button>
            </Link>
            <Link href="/admin/results/" passHref>
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
