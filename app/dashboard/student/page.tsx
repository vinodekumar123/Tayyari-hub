'use client';

import { useEffect, useState } from 'react';
import { db } from '@/app/firebase';
import {
  collection,
  getDoc,
  getDocs,
  doc,
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
  PlusCircle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const PIE_COLORS = ['#4CAF50', '#FF9800', '#F44336'];

export default function EnhancedStudentDashboard() {
  const [greeting, setGreeting] = useState('');
  const [uid, setUid] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [completedQuizzes, setCompletedQuizzes] = useState([]);
  const [completedMocks, setCompletedMocks] = useState([]);
  const [quizSubjectStats, setQuizSubjectStats] = useState([]);
  const [mockSubjectStats, setMockSubjectStats] = useState([]);
  const [avgPerformance, setAvgPerformance] = useState(0);
  const [quizStats, setQuizStats] = useState({ attempted: 0, correct: 0 });
  const [mockStats, setMockStats] = useState({ attempted: 0, correct: 0 });
  const [rank, setRank] = useState(null);
  const [topStudents, setTopStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('🌅 Good Morning');
    else if (hour < 17) setGreeting('🌤️ Good Afternoon');
    else setGreeting('🌙 Good Evening');
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUid(user.uid);
    });
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) setStudentData(userSnap.data());

      const [quizSnap, mockSnap, quizSnapUpcoming, allUsersSnap] = await Promise.all([
        getDocs(collection(db, 'users', uid, 'quizAttempts')),
        getDocs(collection(db, 'users', uid, 'mock-quizAttempts')),
        getDocs(collection(db, 'quizzes')),
        getDocs(collection(db, 'users')),
      ]);

      const completed = quizSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const mocks = mockSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCompletedQuizzes(completed);
      setCompletedMocks(mocks);

      const now = new Date();
      const upcoming = quizSnapUpcoming.docs
        .map((d) => d.data())
        .filter((q) => new Date(`${q?.startDate}T${q?.startTime}`) > now);

      const allResults = await Promise.all([
        ...completed.map(async (q) => {
          const resultRef = doc(db, 'users', uid, 'quizAttempts', q.id, 'results', q.id);
          const resultSnap = await getDoc(resultRef);
          if (!resultSnap.exists()) return null;

          const resultData = resultSnap.data();
          const quizRef = doc(db, 'quizzes', q.id);
          const quizSnap = await getDoc(quizRef);
          const selectedQuestions = quizSnap.data()?.selectedQuestions || [];

          return { ...resultData, selectedQuestions, isMock: false };
        }),

        ...mocks.map(async (m) => {
          const resultRef = doc(db, 'users', uid, 'mock-quizAttempts', m.id, 'results', m.id);
          const resultSnap = await getDoc(resultRef);
          if (!resultSnap.exists()) return null;

          const resultData = resultSnap.data();
          const answers = resultData.answers || {};
          const total = resultData.total || 0;
          const score = resultData.score || 0;

          const quizRef = doc(db, 'users', uid, 'mock-quizzes', m.id);
          const quizSnap = await getDoc(quizRef);
          const selectedQuestions = quizSnap.exists() ? quizSnap.data()?.selectedQuestions || [] : [];

          return {
            isMock: true,
            attempted: total,
            correct: score,
            selectedQuestions,
            answers,
          };
        })
      ]);

      let totalPercent = 0;
      let percentCount = 0;
      let quizAttempted = 0, quizCorrect = 0;
      let mockAttempted = 0, mockCorrect = 0;
      const quizMap = {};
      const mockMap = {};

      for (const result of allResults.filter(Boolean)) {
        if (result.isMock) {
          mockAttempted += result.attempted;
          mockCorrect += result.correct;

          for (const q of result.selectedQuestions || []) {
            const subject = typeof q.subject === 'string' ? q.subject : q.subject?.name || 'N/A';
            const userAnswer = result.answers[q.id];
            const isCorrect = (userAnswer?.trim().toLowerCase() || '') === (q.correctAnswer?.trim().toLowerCase() || '');

            if (!mockMap[subject]) mockMap[subject] = { attempted: 0, correct: 0, wrong: 0 };
            mockMap[subject].attempted++;
            if (isCorrect) mockMap[subject].correct++;
            else if (userAnswer) mockMap[subject].wrong++;
          }
        } else {
          const answers = result.answers || {};
          let correct = 0;
          let attempted = 0;

          for (const q of result.selectedQuestions || []) {
            if (!q.id) continue;
            const subject = typeof q.subject === 'string' ? q.subject : q.subject?.name || 'N/A';
            const userAnswer = answers[q.id];
            const isCorrect = (userAnswer?.trim().toLowerCase() || '') === (q.correctAnswer?.trim().toLowerCase() || '');

            attempted++;
            if (isCorrect) correct++;

            if (!quizMap[subject]) quizMap[subject] = { attempted: 0, correct: 0, wrong: 0 };
            quizMap[subject].attempted++;
            if (isCorrect) quizMap[subject].correct++;
            else if (userAnswer) quizMap[subject].wrong++;
          }

          quizAttempted += attempted;
          quizCorrect += correct;

          if (attempted > 0) {
            totalPercent += Math.round((correct / attempted) * 100);
            percentCount++;
          }
        }
      }

      const userAvg = percentCount > 0 ? Math.round(totalPercent / percentCount) : 0;
      setAvgPerformance(userAvg);
      setQuizStats({ attempted: quizAttempted, correct: quizCorrect });
      setMockStats({ attempted: mockAttempted, correct: mockCorrect });

      const formatStats = (map) => Object.entries(map).map(([subject, stats]) => ({
        subject,
        accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0,
        ...stats,
      }));

      setQuizSubjectStats(formatStats(quizMap));
      setMockSubjectStats(formatStats(mockMap));

      const allRanks = await Promise.all(allUsersSnap.docs.map(async (u) => {
        const attempts = await getDocs(collection(db, 'users', u.id, 'quizAttempts'));
        let correct = 0, attempted = 0;

        for (const a of attempts.docs) {
          const r = await getDoc(doc(db, 'users', u.id, 'quizAttempts', a.id, 'results', a.id));
          if (!r.exists()) continue;
          const data = r.data();
          const qRef = await getDoc(doc(db, 'quizzes', a.id));
          const questions = qRef.exists() ? qRef.data()?.selectedQuestions || [] : [];
          const answers = data.answers || {};

          for (const q of questions) {
            if (!q.id) continue;
            attempted++;
            const userAns = answers[q.id];
            const correctAns = q.correctAnswer;
            if ((userAns?.trim().toLowerCase() || '') === (correctAns?.trim().toLowerCase() || '')) correct++;
          }
        }

        return {
          id: u.id,
          accuracy: attempted ? (correct / attempted) * 100 : 0,
        };
      }));

      const sorted = allRanks.sort((a, b) => b.accuracy - a.accuracy);
      const currentRank = sorted.findIndex((u) => u.id === uid) + 1;
      setRank(currentRank);

      const top10 = sorted.slice(0, 10);
      const top10WithNames = await Promise.all(top10.map(async (u) => {
        const userDoc = await getDoc(doc(db, 'users', u.id));
        return {
          name: userDoc.exists() ? userDoc.data().fullName || 'Anonymous' : 'Unknown',
          accuracy: Math.round(u.accuracy),
        };
      }));
      setTopStudents(top10WithNames);

    } catch (err) {
      console.error('Error loading dashboard:', err);
      toast.error('Failed to load dashboard. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uid) fetchData();
  }, [uid]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-white flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 p-4 space-y-4 sm:p-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse h-20 bg-gray-200 rounded-lg sm:h-24"></div>
          ))}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse h-40 bg-gray-200 rounded-lg sm:h-48"></div>
            ))}
          </div>
          <div className="animate-pulse h-60 bg-gray-200 rounded-lg sm:h-80"></div>
          <div className="animate-pulse h-60 bg-gray-200 rounded-lg sm:h-80"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-tr from-white to-slate-100 flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 md:space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">{greeting}, {studentData?.fullName || 'Student'}! 🌟</h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">Stay focused and keep learning.</p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <button onClick={fetchData} className="flex items-center gap-1 bg-gray-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-gray-200"><RefreshCw className="w-4 h-4" /> Refresh</button>
            <a href="/admin/students/results" className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-blue-700">
              <Activity className="w-4 h-4" /> Results
            </a>
            <a href="/admin/mockquize/create" className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg shadow text-xs sm:text-sm font-medium hover:bg-green-700">
              <PlusCircle className="w-4 h-4" /> Create Practice Test
            </a>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse h-24 bg-gray-200 rounded-lg" />
            ))
          ) : (
            <>
              <Card><CardContent className="p-3 sm:p-4 text-center"><Trophy className="mx-auto text-purple-500 w-6 h-6 sm:w-8 sm:h-8" /><p className="font-semibold mt-2 text-sm sm:text-base">Quizzes Completed</p><p className="text-xl sm:text-2xl">{completedQuizzes.length}</p></CardContent></Card>
              <Card><CardContent className="p-3 sm:p-4 text-center"><Medal className="mx-auto text-green-500 w-6 h-6 sm:w-8 sm:h-8" /><p className="font-semibold mt-2 text-sm sm:text-base">Your Created Tests Completed</p><p className="text-xl sm:text-2xl">{completedMocks.length}</p></CardContent></Card>
              <Card><CardContent className="p-3 sm:p-4 text-center"><CalendarDays className="mx-auto text-yellow-500 w-6 h-6 sm:w-8 sm:h-8" /><p className="font-semibold mt-2 text-sm sm:text-base">Your Rank</p><p className="text-xl sm:text-2xl">#{rank}</p></CardContent></Card>
              <Card><CardContent className="p-3 sm:p-4 text-center"><Activity className="mx-auto text-indigo-600 w-6 h-6 sm:w-8 sm:h-8" /><p className="font-semibold mt-2 text-sm sm:text-base">Overall Accuracy</p><p className="text-xl sm:text-2xl text-indigo-600 font-bold">{avgPerformance}%</p></CardContent></Card>
            </>
          )}
        </div>

        {/* Top 10 Leaderboard */}
        {loading ? (
          <div className="animate-pulse h-60 bg-gray-200 rounded-lg sm:h-64" />
        ) : (
          <Card>
            <CardContent className="p-3 sm:p-4">
              <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">🏆 Top 10 Students</h2>
              <div className="max-h-60 sm:max-h-64 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 pr-2">
                {topStudents.length === 0 ? (
                  <p className="text-gray-500 text-center text-sm sm:text-base">No student data available.</p>
                ) : (
                  topStudents.map((student, index) => (
                    <div key={index} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-md shadow-sm">
                      <span className="font-medium text-sm sm:text-base">{index + 1}. {student.name}</span>
                      <span className="text-green-600 font-semibold text-sm sm:text-base">{student.accuracy}%</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <Card><CardContent className="p-3 sm:p-4 text-center"><p className="font-semibold text-sm sm:text-base">📝 Quiz Questions Attempted</p><p className="text-xl sm:text-2xl">{quizStats.attempted}</p><p className="text-green-600 font-bold text-sm sm:text-base">{quizStats.correct} Correct</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4 text-center"><p className="font-semibold text-sm sm:text-base">🧪 Practice Questions Attempted</p><p className="text-xl sm:text-2xl">{mockStats.attempted}</p><p className="text-green-600 font-bold text-sm sm:text-base">{mockStats.correct} Correct</p></CardContent></Card>
        </div>

        {/* Quiz Subject Stats Table */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📝 Quiz Subject Statistics</h2>
            {quizSubjectStats.length === 0 ? (
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

        {/* Mock Subject Stats Table */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">🧪 Practice Subject Statistics</h2>
            {mockSubjectStats.length === 0 ? (
              <p className="text-gray-500 text-center text-sm sm:text-base">No practice quiz data available.</p>
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
                    {mockSubjectStats.map((stat, index) => (
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

        <div className="rounded-lg p-4 sm:p-6 bg-white shadow">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📈 Quiz Subject Accuracy</h2>
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
        </div>

        <div className="rounded-lg p-4 sm:p-6 bg-white shadow">
          <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-800">📊 Practice Subject Accuracy</h2>
          <ResponsiveContainer width="100%" height={250} minHeight={200}>
            <PieChart>
              <Pie data={mockSubjectStats} dataKey="accuracy" nameKey="subject" outerRadius={80} label={{ fontSize: 12 }}>
                {mockSubjectStats.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}