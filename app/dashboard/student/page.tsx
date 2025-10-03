'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { db } from '@/app/firebase';
import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Sidebar } from '@/components/ui/sidebar';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Trophy,
  Medal,
  CalendarDays,
  RefreshCw,
  Activity,
  ClipboardList,
} from 'lucide-react';

const PIE_COLORS = ['#4CAF50', '#FF9800', '#F44336'];

function percent(val: number, total: number) {
  return total === 0 ? 0 : Math.round((val / total) * 100);
}

export default function UltraFastStudentDash() {
  const [uid, setUid] = useState<string | null>(null);
  const [student, setStudent] = useState<any>(null);

  // Quiz stats
  const [adminResults, setAdminResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);

  // Mock question bank
  const [mockBank, setMockBank] = useState({ total: 0, used: 0, unused: 0 });

  // UI
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Auth
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => {
      setUid(user ? user.uid : null);
    });
  }, []);

  // Load student info, quiz stats, mock bank
  const fetchAll = useCallback(async () => {
    if (!uid) return;
    setRefreshing(true);

    // 1. User Info
    const userSnap = await getDoc(doc(db, 'users', uid));
    setStudent(userSnap.exists() ? userSnap.data() : null);

    // 2. Admin quiz results
    const adminAttempts = await getDocs(query(collection(db, 'users', uid, 'quizAttempts'), orderBy('submittedAt', 'desc')));
    const adminRes: any[] = [];
    for (const docSnap of adminAttempts.docs) {
      const data = docSnap.data();
      if (!data.completed) continue;
      const quizMetaSnap = await getDoc(doc(db, 'quizzes', docSnap.id));
      adminRes.push({
        ...data,
        id: docSnap.id,
        meta: quizMetaSnap.exists() ? quizMetaSnap.data() : {},
      });
    }
    setAdminResults(adminRes);

    // 3. User quiz results
    const userAttempts = await getDocs(query(collection(db, 'users', uid, 'user-quizattempts'), orderBy('submittedAt', 'desc')));
    const userRes: any[] = [];
    for (const docSnap of userAttempts.docs) {
      const data = docSnap.data();
      if (!data.completed) continue;
      const quizMetaSnap = await getDoc(doc(db, 'user-quizzes', docSnap.id));
      userRes.push({
        ...data,
        id: docSnap.id,
        meta: quizMetaSnap.exists() ? quizMetaSnap.data() : {},
      });
    }
    setUserResults(userRes);

    // 4. Mock questions bank stats
    const mockSnap = await getDocs(collection(db, 'mock-questions'));
    let used = 0, unused = 0;
    mockSnap.forEach(d => {
      const usedInQuizzes = d.data().usedInQuizzes || 0;
      if (usedInQuizzes > 0) used++;
      else unused++;
    });
    setMockBank({ total: mockSnap.size, used, unused });

    setRefreshing(false);
    setLoading(false);
  }, [uid]);

  useEffect(() => { if (uid) fetchAll(); }, [uid, fetchAll]);

  // Analytics calculation
  useEffect(() => {
    const getStats = (results: any[]) => {
      let attempted = 0, correct = 0, wrong = 0, skipped = 0;
      let subjectMap: Record<string, { attempted: number; correct: number }> = {};
      results.forEach(r => {
        if (!r.selectedQuestions || !r.answers) return;
        r.selectedQuestions.forEach((q: any) => {
          const subject = typeof q.subject === 'string' ? q.subject : (q.subject?.name || 'Unknown');
          subjectMap[subject] = subjectMap[subject] || { attempted: 0, correct: 0 };
          const ans = r.answers[q.id];
          if (ans === undefined || ans === null || ans === '') {
            skipped += 1;
          } else if ((ans?.trim?.().toLowerCase?.() ?? '') === (q.correctAnswer?.trim?.().toLowerCase?.() ?? '')) {
            correct++; subjectMap[subject].correct++;
          } else {
            wrong++;
          }
          attempted++; subjectMap[subject].attempted++;
        });
      });
      const subjectStats = Object.entries(subjectMap).map(([subject, v]) => ({
        subject,
        attempted: v.attempted,
        correct: v.correct,
        accuracy: percent(v.correct, v.attempted),
      }));
      return {
        attempted, correct, wrong, skipped, subjectStats,
        accuracy: percent(correct, attempted),
      };
    };
    setAdminStats(getStats(adminResults));
    setUserStats(getStats(userResults));
  }, [adminResults, userResults]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good Morning';
    else if (hour < 17) return '🌤️ Good Afternoon';
    else return '🌙 Good Evening';
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-tr from-white to-slate-100 flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 p-4 mt-8 sm:p-6 md:p-8 space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
              {greeting}, {student?.fullName || 'Student'}! 🌟
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Keep growing!</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <button
              onClick={fetchAll}
              disabled={refreshing}
              className={`flex items-center gap-1 bg-gray-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-gray-200 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <a href="/admin/students/results" className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-blue-700">
              <Activity className="w-4 h-4" /> Results
            </a>
            <a href="/admin/quizzes/quizebank" className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-green-700">
              <ClipboardList className="w-4 h-4" /> Quizzes
            </a>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {/* Admin Quizzes */}
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <Trophy className="mx-auto text-purple-500 w-6 h-6 sm:w-8 sm:h-8" />
              <p className="font-semibold mt-2 text-sm sm:text-base">Admin Quizzes Completed</p>
              <p className="text-xl sm:text-2xl">{adminResults.length}</p>
              <p className="text-green-600 font-bold text-xs mt-1">Accuracy: {adminStats?.accuracy ?? 0}%</p>
            </CardContent>
          </Card>
          {/* User Quizzes */}
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <Medal className="mx-auto text-indigo-500 w-6 h-6 sm:w-8 sm:h-8" />
              <p className="font-semibold mt-2 text-sm sm:text-base">Your Quizzes Completed</p>
              <p className="text-xl sm:text-2xl">{userResults.length}</p>
              <p className="text-green-600 font-bold text-xs mt-1">Accuracy: {userStats?.accuracy ?? 0}%</p>
            </CardContent>
          </Card>
          {/* Admin Questions */}
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <CalendarDays className="mx-auto text-yellow-500 w-6 h-6 sm:w-8 sm:h-8" />
              <p className="font-semibold mt-2 text-sm sm:text-base">Admin Questions Attempted</p>
              <p className="text-xl sm:text-2xl">{adminStats?.attempted ?? 0}</p>
              <p className="text-blue-600 font-bold text-xs mt-1">Correct: {adminStats?.correct ?? 0}</p>
            </CardContent>
          </Card>
          {/* User Questions */}
          <Card>
            <CardContent className="p-3 sm:p-4 text-center">
              <Activity className="mx-auto text-pink-500 w-6 h-6 sm:w-8 sm:h-8" />
              <p className="font-semibold mt-2 text-sm sm:text-base">Your Questions Attempted</p>
              <p className="text-xl sm:text-2xl">{userStats?.attempted ?? 0}</p>
              <p className="text-blue-600 font-bold text-xs mt-1">Correct: {userStats?.correct ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Mock Bank */}
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <h2 className="text-lg font-bold mb-3 text-gray-800">Mock Questions Bank</h2>
            <div className="flex flex-wrap gap-4 justify-center">
              <div className="bg-gray-100 px-3 py-2 rounded">
                <span className="font-semibold">Total:</span> {mockBank.total}
              </div>
              <div className="bg-green-100 px-3 py-2 rounded text-green-800">
                <span className="font-semibold">Used:</span> {mockBank.used}
              </div>
              <div className="bg-yellow-100 px-3 py-2 rounded text-yellow-800">
                <span className="font-semibold">Unused:</span> {mockBank.unused}
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <PieChart width={240} height={180}>
                <Pie
                  data={[
                    { name: 'Used', value: mockBank.used },
                    { name: 'Unused', value: mockBank.unused }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={60}
                  fill="#8884d8"
                  paddingAngle={4}
                  dataKey="value"
                  label
                >
                  <Cell key="used" fill="#4CAF50" />
                  <Cell key="unused" fill="#FBC02D" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </div>
          </CardContent>
        </Card>

        {/* Subject Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Admin subject stats */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <h2 className="text-lg font-bold mb-2">Admin Quiz Subject Analytics</h2>
              {adminStats?.subjectStats?.length === 0 && <p className="text-gray-500">No data</p>}
              {adminStats?.subjectStats?.length > 0 && (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={adminStats.subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" fontSize={12} />
                    <YAxis domain={[0, 100]} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="accuracy" stroke="#6366F1" name="Accuracy (%)" />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {adminStats?.subjectStats?.length > 0 && (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-1 text-left">Subject</th>
                        <th className="p-1 text-center">Attempted</th>
                        <th className="p-1 text-center">Correct</th>
                        <th className="p-1 text-center">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminStats.subjectStats.map((s: any, i: number) => (
                        <tr key={i} className="border-b">
                          <td className="p-1">{s.subject}</td>
                          <td className="p-1 text-center">{s.attempted}</td>
                          <td className="p-1 text-center text-green-600">{s.correct}</td>
                          <td className="p-1 text-center">{s.accuracy}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          {/* User subject stats */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <h2 className="text-lg font-bold mb-2">Your Quiz Subject Analytics</h2>
              {userStats?.subjectStats?.length === 0 && <p className="text-gray-500">No data</p>}
              {userStats?.subjectStats?.length > 0 && (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={userStats.subjectStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" fontSize={12} />
                    <YAxis domain={[0, 100]} fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="accuracy" stroke="#EF4444" name="Accuracy (%)" />
                  </LineChart>
                </ResponsiveContainer>
              )}
              {userStats?.subjectStats?.length > 0 && (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-1 text-left">Subject</th>
                        <th className="p-1 text-center">Attempted</th>
                        <th className="p-1 text-center">Correct</th>
                        <th className="p-1 text-center">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userStats.subjectStats.map((s: any, i: number) => (
                        <tr key={i} className="border-b">
                          <td className="p-1">{s.subject}</td>
                          <td className="p-1 text-center">{s.attempted}</td>
                          <td className="p-1 text-center text-green-600">{s.correct}</td>
                          <td className="p-1 text-center">{s.accuracy}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
