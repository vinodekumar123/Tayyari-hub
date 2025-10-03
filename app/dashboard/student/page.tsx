'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { db } from '@/app/firebase';
import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  limit,
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

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

export default function UltraFastStudentDashboard() {
  // UI State
  const [greeting, setGreeting] = useState('');
  const [uid, setUid] = useState(null);

  // Dashboard Data State
  const [studentData, setStudentData] = useState(null);
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [quizSubjectStats, setQuizSubjectStats] = useState([]);
  const [avgPerformance, setAvgPerformance] = useState(null);
  const [quizStats, setQuizStats] = useState(null);
  const [rank, setRank] = useState(null);
  const [topStudents, setTopStudents] = useState([]);
  const [loading, setLoading] = useState(false); // Start false for instant UI
  const [filling, setFilling] = useState(true);

  const isFetching = useRef(false);
  const abortController = useRef(null);
  const dataCache = useRef(new Map());

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

  // Cache helpers
  const loadFromCache = useCallback(() => {
    try {
      const memoryCached = dataCache.current.get(uid || '');
      if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_DURATION) {
        const data = memoryCached.data;
        setStudentData(data.studentData || null);
        setCompletedQuizzes(data.completedQuizzes || []);
        setQuizSubjectStats(data.quizSubjectStats || []);
        setAvgPerformance(data.avgPerformance ?? null);
        setQuizStats(data.quizStats ?? null);
        setRank(data.rank ?? null);
        setTopStudents(data.topStudents || []);
        setFilling(false);
        return true;
      }
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setStudentData(data.studentData || null);
          setCompletedQuizzes(data.completedQuizzes || []);
          setQuizSubjectStats(data.quizSubjectStats || []);
          setAvgPerformance(data.avgPerformance ?? null);
          setQuizStats(data.quizStats ?? null);
          setRank(data.rank ?? null);
          setTopStudents(data.topStudents || []);
          dataCache.current.set(uid || '', { data, timestamp });
          setFilling(false);
          return true;
        }
      }
    } catch (error) {
      console.warn('Cache load failed:', error);
    }
    return false;
  }, [uid]);

  const saveToCache = useCallback((data) => {
    try {
      const timestamp = Date.now();
      const cacheData = { data, timestamp };
      dataCache.current.set(uid || '', cacheData);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache save failed:', error);
    }
  }, [uid]);

  // FAST Optimized data fetcher: parallel, minimal, no mocks, quick stats, quick leaderboard
  const fetchData = useCallback(async () => {
    if (!uid || isFetching.current) return;
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();
    isFetching.current = true;
    setFilling(true);

    try {
      // 1. Try cache for instant fill
      if (loadFromCache()) {
        // Continue with fresh fetch in background
      }

      // 2. Fetch user and quiz attempts in parallel
      const [userSnap, quizSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDocs(query(collection(db, 'users', uid, 'quizAttempts')))
      ]);

      setStudentData(userSnap.exists() ? userSnap.data() : null);
      const completedQuizzes = quizSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCompletedQuizzes(completedQuizzes);

      // 3. Fast batch fetch quiz results, in parallel
      const quizResults = await Promise.all(completedQuizzes.map(async quiz => {
        const [resultSnap, quizSnap] = await Promise.all([
          getDoc(doc(db, 'users', uid, 'quizAttempts', quiz.id, 'results', quiz.id)),
          getDoc(doc(db, 'quizzes', quiz.id)),
        ]);
        if (!resultSnap.exists()) return null;
        const resultData = resultSnap.data();
        const selectedQuestions = quizSnap.exists() ? quizSnap.data()?.selectedQuestions || [] : [];
        return { ...resultData, selectedQuestions };
      }));

      // 4. Quick stats in-memory
      let quizAttempted = 0, quizCorrect = 0, totalPercent = 0, percentCount = 0;
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
      setQuizSubjectStats(Array.from(quizMap.entries()).map(([subject, stats]) => ({
        subject, accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0, ...stats
      })));
      setAvgPerformance(percentCount > 0 ? Math.round(totalPercent / percentCount) : 0);
      setQuizStats({ attempted: quizAttempted, correct: quizCorrect });

      // 5. Fast leaderboard: just accuracy, top 10, batch fetch, only quizzes (no mocks)
      const allUsersSnap = await getDocs(query(collection(db, 'users')));
      const processUserRank = async (userDoc) => {
        const attempts = await getDocs(query(
          collection(db, 'users', userDoc.id, 'quizAttempts'),
          limit(20)
        ));
        let correct = 0, attempted = 0;
        await Promise.all(attempts.docs.map(async (attemptDoc) => {
          const [resultDoc, quizDoc] = await Promise.all([
            getDoc(doc(db, 'users', userDoc.id, 'quizAttempts', attemptDoc.id, 'results', attemptDoc.id)),
            getDoc(doc(db, 'quizzes', attemptDoc.id)),
          ]);
          if (!resultDoc.exists()) return;
          const resultData = resultDoc.data();
          const questions = quizDoc.exists() ? quizDoc.data()?.selectedQuestions || [] : [];
          const answers = resultData.answers || {};
          for (const q of questions.slice(0, 10)) {
            if (!q.id) continue;
            attempted++;
            const userAns = answers[q.id];
            const correctAns = q.correctAnswer;
            if ((userAns?.trim().toLowerCase() || '') === (correctAns?.trim().toLowerCase() || '')) {
              correct++;
            }
          }
        }));
        return { 
          id: userDoc.id, 
          accuracy: attempted ? (correct / attempted) * 100 : 0,
          name: userDoc.data().fullName || 'Anonymous'
        };
      };

      // Batch leaderboard for top 10 only
      const allRanks = await Promise.all(allUsersSnap.docs.map(processUserRank));
      const sorted = allRanks.sort((a, b) => b.accuracy - a.accuracy);
      const idx = sorted.findIndex((u) => u && String(u.id) === String(uid));
      const currentRank = idx >= 0 ? idx + 1 : null;
      const top10 = sorted.slice(0, 10).map(u => ({
        name: u.name,
        accuracy: Math.round(u.accuracy),
      }));

      setRank(currentRank);
      setTopStudents(top10);

      // Save everything to cache
      saveToCache({
        studentData,
        completedQuizzes,
        quizSubjectStats: Array.from(quizMap.entries()).map(([subject, stats]) => ({
          subject, accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0, ...stats
        })),
        avgPerformance: percentCount > 0 ? Math.round(totalPercent / percentCount) : 0,
        quizStats: { attempted: quizAttempted, correct: quizCorrect },
        rank: currentRank,
        topStudents: top10,
      });

      setFilling(false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading dashboard:', err);
        toast.error('Failed to load dashboard. Try again.');
      }
      setFilling(false);
    } finally {
      isFetching.current = false;
      abortController.current = null;
    }
  }, [uid, loadFromCache, saveToCache, studentData]);

  // Debounced fetch to prevent excessive calls
  const debouncedFetch = useMemo(
    () => debounce(fetchData, 150),
    [fetchData]
  );

  useEffect(() => {
    if (uid) debouncedFetch();
  }, [uid, debouncedFetch]);

  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  // Memoized components for performance
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
            {filling ? <span className="animate-pulse bg-gray-200 rounded px-4">&nbsp;</span> : (avgPerformance != null ? `${avgPerformance}%` : '-')}
          </p>
        </CardContent>
      </Card>
    </div>
  ), [filling, completedQuizzes.length, rank, avgPerformance]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-white flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 p-4 space-y-4 sm:p-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse h-20 bg-gray-200 rounded-lg sm:h-24"></div>
          ))}
        </div>
      </div>
    );
  }

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

        {/* Stats Section */}
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
