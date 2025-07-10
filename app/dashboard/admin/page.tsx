'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar';
import { Users, Trophy, Database, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);

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

 

  const dashboardStats = {
    totalStudents: students.length,
    activeQuizzes: 0,
    totalQuestions: 0,
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar  />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
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

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Students</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalStudents}</p>
                  </div>
                  <div className="p-3 bg-blue-100 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Quizzes</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardStats.activeQuizzes}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-full">
                    <Trophy className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Question Bank</p>
                    <p className="text-2xl font-bold text-gray-900">{dashboardStats.totalQuestions}</p>
                  </div>
                  <div className="p-3 bg-purple-100 rounded-full">
                    <Database className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

   
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button className="h-24 flex flex-col justify-center items-center space-y-2">
              <span className="text-lg font-semibold">Create Quiz</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col justify-center items-center space-y-2">
              <span className="text-lg font-semibold">Add Questions</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col justify-center items-center space-y-2">
              <span className="text-lg font-semibold">Manage Students</span>
            </Button>
            <Button variant="outline" className="h-24 flex flex-col justify-center items-center space-y-2">
              <span className="text-lg font-semibold">View Analytics</span>
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
