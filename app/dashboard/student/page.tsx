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
  orderBy,
  where,
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
import { toast } from 'react-hot-toast';

const PIE_COLORS = ['#4CAF50', '#FF9800', '#F44336'];
const CACHE_KEY = 'student_dashboard_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 10; // Process results in smaller batches
const MAX_CONCURRENT = 5; // Limit concurrent Firebase calls

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Throttled batch processor
const processBatch = async (items, processor, batchSize = BATCH_SIZE, maxConcurrent = MAX_CONCURRENT) => {
  const results = [];
  const batches = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  for (let i = 0; i < batches.length; i += maxConcurrent) {
    const currentBatches = batches.slice(i, i + maxConcurrent);
    const batchPromises = currentBatches.map(batch => 
      Promise.all(batch.map(item => processor(item).catch(err => {
        console.warn('Batch item failed:', err);
        return null;
      })))
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
  }
  
  return results.filter(Boolean);
};

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
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start false for instant UI
  const [filling, setFilling] = useState(true);

  const isFetching = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const dataCache = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

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

  // Enhanced cache with memory fallback
  const loadFromCache = useCallback(() => {
    try {
      // Try memory cache first (fastest)
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

      // Fallback to localStorage
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
          
          // Also store in memory cache for next time
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

  const saveToCache = useCallback((data: any) => {
    try {
      const timestamp = Date.now();
      const cacheData = { data, timestamp };
      
      // Save to both memory and localStorage
      dataCache.current.set(uid || '', cacheData);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache save failed:', error);
    }
  }, [uid]);

  // Optimized data fetcher with progressive loading and smart batching
  const fetchData = useCallback(async () => {
    if (!uid || isFetching.current) return;
    
    // Cancel any existing fetch
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();
    
    isFetching.current = true;
    setFilling(true);
    
    try {
      // 1. Instant fill from cache if available
      if (loadFromCache()) {
        // Still continue with fresh data fetch in background
      }

      // 2. Priority data fetch - core user info first (fastest queries)
      const [userSnap, quizSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDocs(query(collection(db, 'users', uid, 'quizAttempts'))),
      ]);

      // Immediate UI updates
      const studentData = userSnap.exists() ? userSnap.data() : null;
      setStudentData(studentData);

      const completedQuizzes = quizSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCompletedQuizzes(completedQuizzes);

      // 3. Smart result processing with progressive updates
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

      // Process in batches for better performance and progressive updates
      const quizResults = await processBatch(completedQuizzes, processQuizResult);

      const allResults = quizResults.filter(Boolean);

      // 4. Ultra-fast stats calculation with memoization
      const calculateStats = () => {
        let totalPercent = 0, percentCount = 0;
        let quizAttempted = 0, quizCorrect = 0;
        const quizMap = new Map();

        for (const result of allResults) {
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

        return {
          quizSubjectStats: formatStats(quizMap),
          avgPerformance: userAvg,
          quizStats: { attempted: quizAttempted, correct: quizCorrect },
        };
      };

      const stats = calculateStats();
      
      // Update UI progressively
      setQuizSubjectStats(stats.quizSubjectStats);
      setAvgPerformance(stats.avgPerformance);
      setQuizStats(stats.quizStats);

      // 5. Optimized leaderboard - only fetch top 10 efficiently
      const fetchLeaderboard = async () => {
        try {
          // Get all users (could be optimized further if necessary)
          const allUsersSnap = await getDocs(query(collection(db, 'users')));
          
          const processUserRank = async (userDoc) => {
            const attempts = await getDocs(query(
              collection(db, 'users', userDoc.id, 'quizAttempts'),
              limit(20) // Limit attempts per user
            ));
            
            let correct = 0, attempted = 0;
            
            const attemptResults = await processBatch(
              attempts.docs,
              async (attemptDoc) => {
                const [resultDoc, quizDoc] = await Promise.all([
                  getDoc(doc(db, 'users', userDoc.id, 'quizAttempts', attemptDoc.id, 'results', attemptDoc.id)),
                  getDoc(doc(db, 'quizzes', attemptDoc.id)),
                ]);
                
                if (!resultDoc.exists()) return null;
                
                const resultData = resultDoc.data();
                const questions = quizDoc.exists() ? quizDoc.data()?.selectedQuestions || [] : [];
                const answers = resultData.answers || {};
                
                let userCorrect = 0, userAttempted = 0;
                for (const q of questions.slice(0, 10)) { // Limit questions processed per quiz
                  if (!q.id) continue;
                  userAttempted++;
                  const userAns = answers[q.id];
                  const correctAns = q.correctAnswer;
                  if ((userAns?.trim().toLowerCase() || '') === (correctAns?.trim().toLowerCase() || '')) {
                    userCorrect++;
                  }
                }
                
                return { correct: userCorrect, attempted: userAttempted };
              }
            );
            
            attemptResults.forEach(result => {
              if (result) {
                correct += result.correct;
                attempted += result.attempted;
              }
            });
            
            return { 
              id: userDoc.id, 
              accuracy: attempted ? (correct / attempted) * 100 : 0,
              name: userDoc.data().fullName || 'Anonymous'
            };
          };

          const allRanks = await processBatch(allUsersSnap.docs, processUserRank, 5, 3); // Smaller batches for leaderboard
          
          const sorted = allRanks.sort((a, b) => b.accuracy - a.accuracy);
          const idx = sorted.findIndex((u) => u && String(u.id) === String(uid));
          const currentRank = idx >= 0 ? idx + 1 : null;
          const top10 = sorted.slice(0, 10).map(u => ({
            name: u.name,
            accuracy: Math.round(u.accuracy),
          }));

          // Set state reliably
          setRank(currentRank);
          setTopStudents(top10);

          return { rank: currentRank, topStudents: top10 };
        } catch (error) {
          console.warn('Leaderboard fetch failed:', error);
          // Ensure state cleared on failure
          setRank(null);
          setTopStudents([]);
          return { rank: null, topStudents: [] };
        }
      };

      // Await leaderboard so rank is available before we clear the filler state
      const leaderboardData = await fetchLeaderboard();

      // Cache everything including leaderboard
      saveToCache({
        studentData,
        completedQuizzes,
        ...stats,
        ...leaderboardData,
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
  }, [uid, loadFromCache, saveToCache]);

  // Debounced fetch to prevent excessive calls
  const debouncedFetch = useMemo(
    () => debounce(fetchData, 300),
    [fetchData]
  );

  useEffect(() => {
    if (uid) debouncedFetch();
  }, [uid, debouncedFetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

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
