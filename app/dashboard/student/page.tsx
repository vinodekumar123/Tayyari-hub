'use client';

import { useEffect, useState, useCallback } from 'react';
import { db, auth } from '@/app/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Utility: debounce for refresh button
const debounce = (func, delay = 250) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), delay);
  };
};

export default function UserQuizAdvancedDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshFlag, setRefreshFlag] = useState(0);

  // Quiz stats
  const [userCreatedQuizzes, setUserCreatedQuizzes] = useState([]);
  const [completedUserQuizzes, setCompletedUserQuizzes] = useState([]);
  const [accuracy, setAccuracy] = useState(null);
  const [subjectStats, setSubjectStats] = useState([]);
  const [chapterStats, setChapterStats] = useState([]);

  // Question bank stats
  const [questionBank, setQuestionBank] = useState([]);
  const [questionBankStats, setQuestionBankStats] = useState([]);
  const [subjectWiseQBank, setSubjectWiseQBank] = useState([]);

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Good Morning';
    else if (hour < 17) return '🌤️ Good Afternoon';
    else return '🌙 Good Evening';
  };

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Main fetch
  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // 1. Fetch user-created quizzes
    const quizSnap = await getDocs(query(collection(db, 'user-quizzes'), where('createdBy', '==', user.uid)));
    const quizzes = quizSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setUserCreatedQuizzes(quizzes);

    // 2. Fetch attempts (and completions) for these quizzes
    const attemptsSnap = await getDocs(collection(db, 'users', user.uid, 'user-quizattempts'));
    // Only completed attempts (submitted)
    const completed = attemptsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.completed);
    setCompletedUserQuizzes(completed);

    // 3. Calculate accuracy & subject/chapter stats
    let totalQuestions = 0, correctQuestions = 0, percentSum = 0, percentCount = 0;
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
        // Subject stats
        const subj = subjMap.get(subject) || { attempted: 0, correct: 0, wrong: 0 };
        subj.attempted++;
        if (d.isCorrect) subj.correct++;
        else if (d.selected) subj.wrong++;
        subjMap.set(subject, subj);
        // Chapter stats
        const chapKey = `${subject}::${chapter}`;
        const chap = chapMap.get(chapKey) || { subject, chapter, attempted: 0, correct: 0, wrong: 0 };
        chap.attempted++;
        if (d.isCorrect) chap.correct++;
        else if (d.selected) chap.wrong++;
        chapMap.set(chapKey, chap);
      }
      totalQuestions += localAttempted;
      correctQuestions += localCorrect;
      if (localAttempted > 0) {
        percentSum += Math.round((localCorrect / localAttempted) * 100);
        percentCount++;
      }
    }
    setAccuracy(percentCount > 0 ? Math.round(percentSum / percentCount) : null);
    setSubjectStats(Array.from(subjMap.entries()).map(([subject, stats]) => ({
      subject,
      accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0,
      ...stats,
    })));
    setChapterStats(Array.from(chapMap.values()).map(stats => ({
      ...stats,
      accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0,
    })));

    // 4. Fetch user's own question bank (questions authored)
    const qSnap = await getDocs(query(collection(db, 'mock-questions'), where('createdBy', '==', user.uid)));
    const questions = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setQuestionBank(questions);

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
    setQuestionBankStats([
      { label: 'Total', value: questions.length },
      { label: 'Used', value: used },
      { label: 'Unused', value: unused }
    ]);
    setSubjectWiseQBank(Array.from(subjQMap.values()));

    setLoading(false);
  }, [user]);

  // Initial and refreshable fetch
  useEffect(() => { if (user) fetchDashboard(); }, [user, fetchDashboard, refreshFlag]);

  // Debounced refresh click
  const handleRefresh = debounce(() => setRefreshFlag(f => f + 1), 500);

  // UI
  if (loading) return (
    <div className="p-8 flex flex-col items-center">
      <div className="animate-spin h-10 w-10 mr-3 border-4 border-blue-300 rounded-full border-t-transparent" />
      <span className="mt-4 text-lg text-gray-600">Loading dashboard...</span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-extrabold">{getGreeting()}{user?.displayName ? `, ${user.displayName}` : ''}!</h1>
          <div className="text-gray-500 text-sm">Your advanced analytics for user-created quizzes</div>
        </div>
        <button
          onClick={handleRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 font-semibold text-sm shadow"
        >Refresh</button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-semibold">Quizzes Created</div>
            <div className="text-2xl">{userCreatedQuizzes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-semibold">Quizzes Completed</div>
            <div className="text-2xl">{completedUserQuizzes.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-semibold">Overall Accuracy</div>
            <div className="text-2xl">{accuracy != null ? `${accuracy}%` : '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-semibold">Questions in Bank</div>
            <div className="text-xl">{questionBank.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Stats Table */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xl font-bold mb-2">Quiz Subject Statistics</div>
          {subjectStats.length === 0 ? (
            <div className="text-gray-500 text-center py-3">No stats yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                  {subjectStats.map((stat, i) => (
                    <tr key={i} className="border-b">
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

      {/* Chapter Stats Table */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xl font-bold mb-2">Chapter Statistics</div>
          {chapterStats.length === 0 ? (
            <div className="text-gray-500 text-center py-3">No stats yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
                  {chapterStats.map((stat, i) => (
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

      {/* Chart for subject accuracy */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xl font-bold mb-2">Subject Accuracy Chart</div>
          {subjectStats.length === 0 ? (
            <div className="text-gray-500 text-center py-6">No data to display.</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={subjectStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="accuracy" stroke="#3b82f6" name="Accuracy (%)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Question Bank Section */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xl font-bold mb-2">Your Question Bank (User-Created Questions)</div>
          <div className="flex flex-wrap gap-4 mb-4">
            {questionBankStats.map(stat => (
              <div key={stat.label} className="bg-gray-100 p-4 rounded-lg min-w-[120px] text-center">
                <div className="text-lg font-semibold">{stat.label}</div>
                <div className="text-2xl">{stat.value}</div>
              </div>
            ))}
          </div>
          <div className="text-lg font-semibold mb-2">Subject-wise Question Stats</div>
          {subjectWiseQBank.length === 0 ? (
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
                  {subjectWiseQBank.map((stat, i) => (
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
  );
}
