'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { db } from '@/app/firebase';
import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  where,
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
const debounce = (func, delay = 250) => {
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

  // Admin Quiz Dashboard Data State
  const [studentData, setStudentData] = useState(null);
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [quizSubjectStats, setQuizSubjectStats] = useState([]);
  const [avgPerformance, setAvgPerformance] = useState(null);
  const [quizStats, setQuizStats] = useState(null);
  const [rank, setRank] = useState(null);
  const [topStudents, setTopStudents] = useState([]);
  const [loading, setLoading] = useState(false); // Start false for instant UI
  const [filling, setFilling] = useState(true);

  // User Quiz Analytics State
  const [userCreatedQuizzes, setUserCreatedQuizzes] = useState([]);
  const [completedUserQuizzes, setCompletedUserQuizzes] = useState([]);
  const [userQuizAccuracy, setUserQuizAccuracy] = useState(null);
  const [userQuizSubjectStats, setUserQuizSubjectStats] = useState([]);
  const [userQuizChapterStats, setUserQuizChapterStats] = useState([]);
  const [userQuestionBank, setUserQuestionBank] = useState([]);
  const [userQuestionBankStats, setUserQuestionBankStats] = useState([]);
  const [subjectWiseUserQBank, setSubjectWiseUserQBank] = useState([]);

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
        // User quiz data
        setUserCreatedQuizzes(data.userCreatedQuizzes || []);
        setCompletedUserQuizzes(data.completedUserQuizzes || []);
        setUserQuizAccuracy(data.userQuizAccuracy ?? null);
        setUserQuizSubjectStats(data.userQuizSubjectStats || []);
        setUserQuizChapterStats(data.userQuizChapterStats || []);
        setUserQuestionBank(data.userQuestionBank || []);
        setUserQuestionBankStats(data.userQuestionBankStats || []);
        setSubjectWiseUserQBank(data.subjectWiseUserQBank || []);
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
          // User quiz data
          setUserCreatedQuizzes(data.userCreatedQuizzes || []);
          setCompletedUserQuizzes(data.completedUserQuizzes || []);
          setUserQuizAccuracy(data.userQuizAccuracy ?? null);
          setUserQuizSubjectStats(data.userQuizSubjectStats || []);
          setUserQuizChapterStats(data.userQuizChapterStats || []);
          setUserQuestionBank(data.userQuestionBank || []);
          setUserQuestionBankStats(data.userQuestionBankStats || []);
          setSubjectWiseUserQBank(data.subjectWiseUserQBank || []);
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

  // Fetch user-created quiz analytics and question bank
  const fetchUserQuizAnalytics = useCallback(async (uid) => {
    // 1. Fetch quizzes created by the user
    const quizSnap = await getDocs(query(collection(db, 'user-quizzes'), where('createdBy', '==', uid)));
    const quizzes = quizSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Fetch attempts/completions
    const attemptsSnap = await getDocs(collection(db, 'users', uid, 'user-quizattempts'));
    const completed = attemptsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.completed);

    // 3. Calculate accuracy & subject/chapter stats
    let percentSum = 0, percentCount = 0;
    const subjMap = new Map();
    const chapMap = new Map();

    for (const att of completed) {
      const quiz = quizzes.find(q => q.id === att.id);
      const detailed = att.detailed || [];
      let localAttempted = 0, localCorrect = 0;
      for (const d of detailed) {
        const subject = d.subject || quiz?.subjects?.[0] || 'N/A';
        const chapter = d.chapter || 'N/A';
        localAttempted++;
        if (d.isCorrect) localCorrect++;
        const subj = subjMap.get(subject) || { attempted: 0, correct: 0, wrong: 0 };
        subj.attempted++;
        if (d.isCorrect) subj.correct++;
        else if (d.selected) subj.wrong++;
        subjMap.set(subject, subj);
        // Chapter
        const chapKey = `${subject}::${chapter}`;
        const chap = chapMap.get(chapKey) || { subject, chapter, attempted: 0, correct: 0, wrong: 0 };
        chap.attempted++;
        if (d.isCorrect) chap.correct++;
        else if (d.selected) chap.wrong++;
        chapMap.set(chapKey, chap);
      }
      if (localAttempted > 0) {
        percentSum += Math.round((localCorrect / localAttempted) * 100);
        percentCount++;
      }
    }
    const userQuizAccuracy = percentCount > 0 ? Math.round(percentSum / percentCount) : null;
    const userQuizSubjectStats = Array.from(subjMap.entries()).map(([subject, stats]) => ({
      subject,
      accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0,
      ...stats,
    }));
    const userQuizChapterStats = Array.from(chapMap.values()).map(stats => ({
      ...stats,
      accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0,
    }));

    // 4. Fetch user's own question bank (questions authored)
    const qSnap = await getDocs(query(collection(db, 'mock-questions'), where('createdBy', '==', uid)));
    const questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 5. Compute question bank stats: used/unused overall and subjectwise
    let used = 0, unused = 0;
    const subjQMap = new Map();
    for (const q of questions) {
      if (q.usedInQuizzes && q.usedInQuizzes > 0) used++;
      else unused++;
      const subj = q.subject || 'Uncategorized';
      const stats = subjQMap.get(subj) || { subject: subj, total: 0, used: 0, unused: 0 };
      stats.total++;
      if (q.usedInQuizzes && q.usedInQuizzes > 0) stats.used++;
      else stats.unused++;
      subjQMap.set(subj, stats);
    }
    const userQuestionBankStats = [
      { label: 'Total', value: questions.length },
      { label: 'Used', value: used },
      { label: 'Unused', value: unused }
    ];
    const subjectWiseUserQBank = Array.from(subjQMap.values());

    return {
      userCreatedQuizzes: quizzes,
      completedUserQuizzes: completed,
      userQuizAccuracy,
      userQuizSubjectStats,
      userQuizChapterStats,
      userQuestionBank: questions,
      userQuestionBankStats,
      subjectWiseUserQBank
    };
  }, []);

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

      // 6. Fetch User Quiz Analytics (NEW)
      const userQuizAnalytics = await fetchUserQuizAnalytics(uid);
      setUserCreatedQuizzes(userQuizAnalytics.userCreatedQuizzes);
      setCompletedUserQuizzes(userQuizAnalytics.completedUserQuizzes);
      setUserQuizAccuracy(userQuizAnalytics.userQuizAccuracy);
      setUserQuizSubjectStats(userQuizAnalytics.userQuizSubjectStats);
      setUserQuizChapterStats(userQuizAnalytics.userQuizChapterStats);
      setUserQuestionBank(userQuizAnalytics.userQuestionBank);
      setUserQuestionBankStats(userQuizAnalytics.userQuestionBankStats);
      setSubjectWiseUserQBank(userQuizAnalytics.subjectWiseUserQBank);

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
        // User quiz data
        ...userQuizAnalytics,
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
  }, [uid, loadFromCache, saveToCache, studentData, fetchUserQuizAnalytics]);

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
      {/* Admin Quizzes */}
      <Card>
        <CardContent className="p-3 sm:p-4 text-center">
          <Trophy className="mx-auto text-purple-500 w-6 h-6 sm:w-8 sm:h-8" />
          <p className="font-semibold mt-2 text-sm sm:text-base">Admin Quizzes Completed</p>
          <p className="text-xl sm:text-2xl">
            {filling ? <span className="animate-pulse bg-gray-200 rounded px-4">&nbsp;</span> : completedQuizzes.length}
          </p>
        </CardContent>
      </Card>
      {/* User Quizzes */}
      <Card>
        <CardContent className="p-3 sm:p-4 text-center">
          <Medal className="mx-auto text-pink-500 w-6 h-6 sm:w-8 sm:h-8" />
          <p className="font-semibold mt-2 text-sm sm:text-base">User Quizzes Created</p>
          <p className="text-xl sm:text-2xl">
            {filling ? <span className="animate-pulse bg-gray-100 rounded px-4">&nbsp;</span> : userCreatedQuizzes.length}
          </p>
          <p className="text-xs mt-1 text-gray-600">Completed: {filling ? '-' : completedUserQuizzes.length}</p>
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
          <p className="font-semibold mt-2 text-sm sm:text-base">Admin Quiz Accuracy</p>
          <p className="text-xl sm:text-2xl">
            {filling ? <span className="animate-pulse bg-gray-200 rounded px-4">&nbsp;</span> : (avgPerformance != null ? `${avgPerformance}%` : '-')}
          </p>
          <div className="text-xs mt-1 text-gray-600">User Quiz Accuracy: {filling ? '-' : (userQuizAccuracy != null ? `${userQuizAccuracy}%` : '-')}</div>
        </CardContent>
      </Card>
    </div>
  ), [filling, completedQuizzes.length, userCreatedQuizzes.length, completedUserQuizzes.length, rank, avgPerformance, userQuizAccuracy]);

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

        {/* --- ADMIN QUIZ ANALYTICS --- */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📝 Admin Quiz Subject Statistics</h2>
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

        {/* Admin Quiz Subject Accuracy Chart */}
        <div className="rounded-lg p-4 sm:p-6 bg-white shadow">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📈 Admin Quiz Subject Accuracy</h2>
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

        {/* --- USER-CREATED QUIZ ANALYTICS --- */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📝 User-Created Quiz Subject Statistics</h2>
            {filling && userQuizSubjectStats.length === 0 ? (
              <div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse h-7 bg-gray-100 rounded mb-2"></div>
                ))}
              </div>
            ) : userQuizSubjectStats.length === 0 ? (
              <p className="text-gray-500 text-center text-sm sm:text-base">No user-created quiz data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Subject</th>
                      <th className="p-2 text-center">Attempted</th>
                      <th className="p-2 text-center">Correct</th>
                      <th className="p-2 text-center">Wrong</th>
                      <th className="p-2 text-center">Accuracy (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userQuizSubjectStats.map((stat, index) => (
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

        {/* User Quiz Subject Accuracy Chart */}
        <div className="rounded-lg p-4 sm:p-6 bg-white shadow">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📈 User Quiz Subject Accuracy</h2>
          {filling && userQuizSubjectStats.length === 0 ? (
            <div className="animate-pulse bg-gray-100 h-40 rounded"></div>
          ) : (
            <ResponsiveContainer width="100%" height={250} minHeight={200}>
              <LineChart data={userQuizSubjectStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="accuracy" stroke="#EC4899" name="Accuracy (%)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* User Quiz Chapter Statistics */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">User Quiz Chapter Statistics</h2>
            {filling && userQuizChapterStats.length === 0 ? (
              <div>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse h-7 bg-gray-100 rounded mb-2"></div>
                ))}
              </div>
            ) : userQuizChapterStats.length === 0 ? (
              <p className="text-gray-500 text-center text-sm sm:text-base">No user quiz chapter data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm sm:text-base">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Subject</th>
                      <th className="p-2 text-left">Chapter</th>
                      <th className="p-2 text-center">Attempted</th>
                      <th className="p-2 text-center">Correct</th>
                      <th className="p-2 text-center">Wrong</th>
                      <th className="p-2 text-center">Accuracy (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userQuizChapterStats.map((stat, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{stat.subject}</td>
                        <td className="p-2">{stat.chapter}</td>
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

        {/* User Question Bank Section */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">Your Question Bank (User-Created Questions)</h2>
            <div className="flex flex-wrap gap-4 mb-4">
              {userQuestionBankStats.map(stat => (
                <div key={stat.label} className="bg-gray-100 p-4 rounded-lg min-w-[120px] text-center">
                  <div className="text-lg font-semibold">{stat.label}</div>
                  <div className="text-2xl">{stat.value}</div>
                </div>
              ))}
            </div>
            <div className="text-lg font-semibold mb-2">Subject-wise Question Stats</div>
            {subjectWiseUserQBank.length === 0 ? (
              <div className="text-gray-500">No question bank data.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-2 text-left">Subject</th>
                      <th className="p-2 text-center">Total</th>
                      <th className="p-2 text-center">Used</th>
                      <th className="p-2 text-center">Unused</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectWiseUserQBank.map((stat, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{stat.subject}</td>
                        <td className="p-2 text-center">{stat.total}</td>
                        <td className="p-2 text-center text-blue-600">{stat.used}</td>
                        <td className="p-2 text-center text-gray-500">{stat.unused}</td>
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
  );
}
