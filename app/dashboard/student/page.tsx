'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { db } from '@/app/firebase';
import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Sidebar } from '@/components/ui/sidebar';
import {
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
import { toast } from 'react-hot-toast';

const CACHE_KEY = 'student_dashboard_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function UltraFastStudentDashboard() {
  // UI State
  const [greeting, setGreeting] = useState('');
  const [uid, setUid] = useState<string | null>(null);

  // Dashboard Data State
  const [studentData, setStudentData] = useState<any | null>(null);
  const [completedQuizzes, setCompletedQuizzes] = useState<any[]>([]);
  const [quizSubjectStats, setQuizSubjectStats] = useState<any[]>([]);
  const [avgPerformance, setAvgPerformance] = useState<number | null>(null);
  const [quizStats, setQuizStats] = useState<{ attempted: number; correct: number } | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [leaderboardAccuracy, setLeaderboardAccuracy] = useState<number | null>(null);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start false for instant UI
  const [filling, setFilling] = useState(true);

  // Memoized greeting calculation
  const currentGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good Morning';
    else if (hour < 17) return '🌤️ Good Afternoon';
    else return '🌙 Good Evening';
  }, []);

  // Set greeting once
  useEffect(() => {
    setGreeting(currentGreeting);
  }, [currentGreeting]);

  // Auth state with cleanup
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
    });
    return () => unsubscribe();
  }, []);

  // Optimized data fetcher
  const fetchData = useCallback(async () => {
    if (!uid) return;
    setFilling(true);

    try {
      // 1. Get current user and leaderboard/top in parallel
      const [userSnap, leaderboardSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDoc(doc(db, 'leaderboard', 'top')),
      ]);
      const studentData = userSnap.exists() ? userSnap.data() : null;
      setStudentData(studentData);

      // 2. Set leaderboardAccuracy and rank directly from Firestore
      setLeaderboardAccuracy(studentData?.leaderboardAccuracy ?? null);
      setRank(studentData?.leaderboardRank ?? null);

      // 3. Set completed quizzes for quiz count and subject stats
      const quizSnap = await getDocs(query(collection(db, 'users', uid, 'quizAttempts')));
      const completedQuizzes = quizSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCompletedQuizzes(completedQuizzes);

      // 4. Optional: subject stats for user's own attempts
      // This block is kept from your original logic, but runs only for the current user
      // (Optimized for single-user, so it's fast)
      const processQuizResult = async (quiz) => {
        const [resultSnap, quizSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid, 'quizAttempts', quiz.id, 'results', quiz.id)),
          getDoc(doc(db, 'quizzes', quiz.id)),
        ]);
        if (!resultSnap.exists()) return null;
        const resultData = resultSnap.data();
        const selectedQuestions = quizSnap.exists() ? quizSnap.data()?.selectedQuestions || [] : [];
        return { ...resultData, selectedQuestions };
      };
      const quizResults = await Promise.all(completedQuizzes.map(processQuizResult));
      let totalPercent = 0, percentCount = 0, quizAttempted = 0, quizCorrect = 0;
      const quizMap = new Map();

      for (const result of quizResults.filter(Boolean)) {
        const answers = result.answers || {};
        let correct = 0, attempted = 0;
        for (const q of result.selectedQuestions || []) {
          if (!q.id) continue;
          const subject = typeof q.subject === 'string' ? q.subject : q.subject?.name || 'N/A';
          const userAnswer = answers[q.id];
          const isCorrect = (userAnswer?.trim().toLowerCase() || '') === (q.correctAnswer?.trim().toLowerCase() || '');
          attempted++;
          if (isCorrect) correct++;
          const stats = quizMap.get(subject) || { attempted: 0, correct: 0, wrong: 0 };
          stats.attempted++;
          if (isCorrect) stats.correct++;
          else if (userAnswer) stats.wrong++;
          quizMap.set(subject, stats);
        }
        quizAttempted += attempted;
        quizCorrect += correct;
        if (attempted > 0) {
          totalPercent += Math.round((correct / attempted) * 100);
          percentCount++;
        }
      }
      const userAvg = percentCount > 0 ? Math.round(totalPercent / percentCount) : 0;
      const formatStats = (map) =>
        Array.from(map.entries()).map(([subject, stats]) => ({
          subject,
          accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0,
          ...stats,
        }));
      setQuizSubjectStats(formatStats(quizMap));
      setAvgPerformance(userAvg);
      setQuizStats({ attempted: quizAttempted, correct: quizCorrect });

      // 5. Set top 10 leaderboard
      const leaderboardData = leaderboardSnap.exists() ? leaderboardSnap.data() : { users: [] };
      setTopStudents(leaderboardData.users || []);

      setFilling(false);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      toast.error('Failed to load dashboard. Try again.');
      setFilling(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) fetchData();
  }, [uid, fetchData]);

  // Memoized components for better performance
  const StatsCards = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
      <Card>
        <CardContent className="p-3 sm:p-4 text-center">
          <Trophy className="mx-auto text-purple-500 w-6 h-6 sm:w-8 sm:h-8" />
          <p className="font-semibold mt-2 text-sm sm:text-base">Quizzes Completed</p>
          <p className="text-xl sm:text-2xl">
            {filling ? <span className="animate-pulse bg-gray-200 rounded px-4">&nbsp;</span> : completedQuizzes.length}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4 text-center">
          <Medal className="mx-auto text-green-500 w-6 h-6 sm:w-8 sm:h-8" />
          <p className="font-semibold mt-2 text-sm sm:text-base">Your Created Tests</p>
          <p className="text-xl sm:text-2xl">
            <span className="animate-pulse bg-gray-100 rounded px-4">&nbsp;</span>
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4 text-center">
          <CalendarDays className="mx-auto text-yellow-500 w-6 h-6 sm:w-8 sm:h-8" />
          <p className="font-semibold mt-2 text-sm sm:text-base">Your Rank</p>
          <p className="text-xl sm:text-2xl">
            {filling ? <span className="animate-pulse bg-gray-200 rounded px-4">&nbsp;</span> : (rank ?? '-')}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 sm:p-4 text-center">
          <Activity className="mx-auto text-indigo-600 w-6 h-6 sm:w-8 sm:h-8" />
          <p className="font-semibold mt-2 text-sm sm:text-base">Overall Accuracy</p>
          <p className="text-xl sm:text-2xl">
            {filling ? <span className="animate-pulse bg-gray-200 rounded px-4">&nbsp;</span> : (leaderboardAccuracy != null ? `${leaderboardAccuracy}%` : '-')}
          </p>
        </CardContent>
      </Card>
    </div>
  ), [filling, completedQuizzes.length, rank, leaderboardAccuracy]);

  return (
    <div className="flex min-h-screen bg-gradient-to-tr from-white to-slate-100 flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 p-4 mt-8 sm:p-6 md:p-8 space-y-6 md:space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
              {greeting}, {studentData?.fullName || 'Student'}! 🌟
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Stay focused and keep learning.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <button
              onClick={() => { setFilling(true); fetchData(); }}
              disabled={filling}
              className={`flex items-center gap-1 bg-gray-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-gray-200 ${filling ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <RefreshCw className={`w-4 h-4 ${filling ? 'animate-spin' : ''}`} />
              <span>{filling ? 'Refreshing...' : 'Refresh'}</span>
            </button>
            <a href="/admin/students/results" className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-blue-700">
              <Activity className="w-4 h-4" /> Results
            </a>
            <a href="/admin/quizzes/quizebank" className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-green-700">
              <ClipboardList className="w-4 h-4" /> Quizzes
            </a>
          </div>
        </div>

        {/* Stats Section - Memoized */}
        {StatsCards}

        {/* Top 10 Leaderboard */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">🏆 Top 10 Students</h2>
            <div className="max-h-60 sm:max-h-64 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 pr-2">
              {filling && topStudents.length === 0 ? (
                [...Array(10)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-gray-100 h-9 rounded-md" />
                ))
              ) : (
                topStudents.length === 0 ? (
                  <p className="text-gray-500 text-center text-sm sm:text-base">No student data available.</p>
                ) : (
                  topStudents.map((student, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-md shadow-sm">
                      <span className="font-medium text-sm sm:text-base">{index + 1}. {student.name}</span>
                      <span className="text-green-600 font-semibold text-sm sm:text-base">{student.accuracy}%</span>
                    </div>
                  ))
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quiz Attempt Stats */}
        <Card>
          <CardContent className="p-3 sm:p-4 text-center">
            <p className="font-semibold text-sm sm:text-base">📝 Quiz Questions Attempted</p>
            <p className="text-xl sm:text-2xl">
              {filling ? <span className="animate-pulse bg-gray-100 rounded px-4">&nbsp;</span> : (quizStats?.attempted ?? 0)}
            </p>
            <p className="text-green-600 font-bold text-sm sm:text-base">
              {filling ? <span className="animate-pulse bg-gray-100 rounded px-4">&nbsp;</span> : `${quizStats?.correct ?? 0} Correct`}
            </p>
          </CardContent>
        </Card>

        {/* Quiz Subject Stats Table */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📝 Quiz Subject Statistics</h2>
            {filling && quizSubjectStats.length === 0 ? (
              <div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse h-7 bg-gray-100 rounded mb-2"></div>
                ))}
              </div>
            ) : quizSubjectStats.length === 0 ? (
              <p className="text-gray-500 text-center text-sm sm:text-base">No quiz data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Subject</th>
                      <th className="p-2 text-center">Total Attempts</th>
                      <th className="p-2 text-center">Correct</th>
                      <th className="p-2 text-center">Wrong</th>
                      <th className="p-2 text-center">Accuracy (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizSubjectStats.map((stat, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{stat.subject}</td>
                        <td className="p-2 text-center">{stat.attempted}</td>
                        <td className="p-2 text-center text-green-600">{stat.correct}</td>
                        <td className="p-2 text-center text-red-600">{stat.wrong}</td>
                        <td className="p-2 text-center">{stat.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quiz Subject Accuracy Chart */}
        <div className="rounded-lg p-4 sm:p-6 bg-white shadow">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📈 Quiz Subject Accuracy</h2>
          {filling && quizSubjectStats.length === 0 ? (
            <div className="animate-pulse bg-gray-100 h-40 rounded"></div>
          ) : (
            <ResponsiveContainer width="100%" height={250} minHeight={200}>
              <LineChart data={quizSubjectStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="accuracy" stroke="#6366F1" name="Accuracy (%)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
