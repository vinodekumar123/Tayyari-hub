'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  doc,
  getDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { app, auth as clientAuth, db as clientDb } from '@/app/firebase';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Format date helper function
const formatDate = (timestamp: any, date: Date | null) => {
  if (timestamp?.toDate) {
    const d = timestamp.toDate();
    return d.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  if (date) {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  return 'N/A';
};
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Search, BookOpen, Award, Calendar, TrendingUp, Filter, ChevronRight, BarChart3 } from 'lucide-react';

const ADMIN = 'admin';
const USER = 'user';

export default function UnifiedResultsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userCourse, setUserCourse] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const [adminResults, setAdminResults] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedChapter, setSelectedChapter] = useState('all');
  const [viewType, setViewType] = useState<typeof ADMIN | typeof USER>(ADMIN);
  const [filtered, setFiltered] = useState<any[]>([]);

  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);

  // --------- Auth + User Info -----------
  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUserId(user.uid);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const course = userDoc.data().course;
        setUserCourse(course);
      }
    });
  }, [router, auth, db]);

  // --------- Subject/Chapter Filters ----------
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!userCourse) return;
      const courseDocs = await getDocs(collection(db, 'courses'));
      const courseDoc = courseDocs.docs.find(
        (doc) => doc.data().name === userCourse
      );
      if (!courseDoc) return;

      const subjectIds = courseDoc.data().subjectIds || [];
      const tempSubjects: string[] = [];
      const map: Record<string, string> = {};

      await Promise.all(
        subjectIds.map(async (id: string) => {
          const snap = await getDoc(doc(db, 'subjects', id));
          if (snap.exists()) {
            const data = snap.data();
            tempSubjects.push(data.name);
            map[data.name] = id;
          }
        })
      );

      setSubjects(tempSubjects);
      setSubjectMap(map);
    };

    fetchSubjects();
  }, [userCourse, db]);

  useEffect(() => {
    const fetchChapters = async () => {
      if (selectedSubject === 'all' || !subjectMap[selectedSubject]) {
        setChapters([]);
        return;
      }

      const subjectId = subjectMap[selectedSubject];
      const subjectSnap = await getDoc(doc(db, 'subjects', subjectId));
      if (subjectSnap.exists()) {
        const data = subjectSnap.data();
        setChapters(data.chapters ? Object.keys(data.chapters) : []);
      }
    };

    fetchChapters();
  }, [selectedSubject, subjectMap, db]);

  // --------- Fetch Admin Quizzes (adminResults) ----------
  useEffect(() => {
    const fetchResults = async () => {
      if (!userId) return;
      setLoading(true);
      const paths = [
        { attemptPath: 'quizAttempts', quizSource: 'quizzes', isMock: false },
        { attemptPath: 'mock-quizAttempts', quizSource: 'mock-quizzes', isMock: true },
      ];

      const allResults: any[] = [];

      for (const { attemptPath, quizSource, isMock } of paths) {
        const attemptsRef = collection(db, 'users', userId, attemptPath);
        const attemptsSnap = await getDocs(attemptsRef);

        await Promise.all(
          attemptsSnap.docs.map(async (attemptDoc) => {
            const quizId = attemptDoc.id;
            const [resultSnap, quizSnap] = await Promise.all([
              getDoc(doc(db, 'users', userId, attemptPath, quizId, 'results', quizId)),
              getDoc(
                quizSource === 'mock-quizzes'
                  ? doc(db, 'users', userId, 'mock-quizzes', quizId)
                  : doc(db, 'quizzes', quizId)
              ),
            ]);

            if (resultSnap.exists() && quizSnap.exists()) {
              const resultData = resultSnap.data();
              const quizMeta = quizSnap.data();

              let subjectNames = 'N/A';
              if (quizMeta.questionFilters?.subjects?.length) {
                subjectNames = quizMeta.questionFilters.subjects.join(', ');
              } else if (quizMeta.subjects?.length) {
                subjectNames = quizMeta.subjects.map((s: any) =>
                  typeof s === 'string' ? s : s?.name || '[Invalid]'
                ).join(', ');
              } else if (quizMeta.subject?.name) {
                subjectNames = quizMeta.subject.name;
              } else if (typeof quizMeta.subject === 'string') {
                subjectNames = quizMeta.subject;
              }

              let chapterNames = 'N/A';
              if (quizMeta.questionFilters?.chapters?.length) {
                chapterNames = quizMeta.questionFilters.chapters.join(', ');
              } else if (quizMeta.chapter?.name) {
                chapterNames = quizMeta.chapter.name;
              } else if (typeof quizMeta.chapter === 'string') {
                chapterNames = quizMeta.chapter;
              }

              const courseName = quizMeta.course?.name || quizMeta.course || 'Unknown';

              const questions: any[] = quizMeta.selectedQuestions || [];
              const answers: Record<string, string> = resultData.answers || {};
              const correct = questions.filter(q => answers[q.id] === q.correctAnswer).length;
              const total = questions.length;

              allResults.push({
                id: quizId,
                answers,
                title: quizMeta.title || 'Untitled Quiz',
                subject: subjectNames,
                chapter: chapterNames,
                course: courseName,
                isMock,
                timestamp: resultData.timestamp,
                score: correct,
                total: total,
                type: ADMIN,
              });
            }
          })
        );
      }

      allResults.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setAdminResults(allResults);
      setLoading(false);
    };

    fetchResults();
  }, [userId, db]);

  // --------- Fetch User Quizzes (userResults) ----------
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    const fetchUserQuizAttempts = async () => {
      try {
        const attemptsRef = collection(clientDb, 'users', userId, 'user-quizattempts');
        const q = query(attemptsRef, orderBy('submittedAt', 'desc'));
        const snap = await getDocs(q);

        const attempts: any[] = [];
        const metaFetches: Promise<void>[] = [];
        const quizMetas: Record<string, any> = {};
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.completed) return;
          attempts.push({
            ...data,
            id: docSnap.id,
            quizId: docSnap.id,
            type: USER,
          });
          metaFetches.push(
            getDoc(doc(clientDb, 'user-quizzes', docSnap.id)).then(metaSnap => {
              if (metaSnap.exists()) {
                const metaData = metaSnap.data();
                // --- Subject logic correction here ---
                let subjectNames = 'N/A';
                if (metaData.subjects && Array.isArray(metaData.subjects) && metaData.subjects.length) {
                  subjectNames = metaData.subjects.join(', ');
                } else if (typeof metaData.subject === 'string') {
                  subjectNames = metaData.subject;
                }
                quizMetas[docSnap.id] = {
                  name: metaData.name || metaData.title,
                  subject: subjectNames,
                };
              }
            })
          );
        });
        await Promise.all(metaFetches);

        const shaped = attempts.map(attempt => {
          const meta = quizMetas[attempt.quizId] || {};
          const date = attempt.submittedAt
            ? new Date(attempt.submittedAt.seconds * 1000)
            : null;
          return {
            id: attempt.id,
            title: meta.name || 'Quiz',
            subject: meta.subject || 'N/A',
            chapter: 'N/A',
            course: 'N/A',
            isMock: false,
            timestamp: attempt.submittedAt,
            score: attempt.score,
            total: attempt.total,
            type: USER,
            quizId: attempt.quizId,
            date: date,
          };
        });
        shaped.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        setUserResults(shaped);
      } catch (err) {
        // fail silently
      }
      setLoading(false);
    };
    fetchUserQuizAttempts();
  }, [userId]);

  // --------- Filtering (Unified) ----------
  useEffect(() => {
    const timeout = setTimeout(() => {
      let list = viewType === ADMIN ? adminResults : userResults;
      const lower = search.toLowerCase();

      if (selectedSubject !== 'all') {
        list = list.filter((r) =>
          (r.subject || '').toLowerCase().includes(selectedSubject.toLowerCase())
        );
      }

      if (viewType === ADMIN && selectedChapter !== 'all') {
        list = list.filter((r) =>
          (r.chapter || '').toLowerCase().includes(selectedChapter.toLowerCase())
        );
      }

      list = list.filter(
        (r) =>
          (r.title || '').toLowerCase().includes(lower) ||
          (r.course || '').toLowerCase().includes(lower) ||
          (r.subject || '').toLowerCase().includes(lower)
      );

      setFiltered(list);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, selectedSubject, selectedChapter, viewType, adminResults, userResults]);

  // Calculate stats
  const stats = {
    total: filtered.length,
    avgScore: filtered.length > 0
      ? (filtered.reduce((acc, r) => acc + (r.score / r.total * 100), 0) / filtered.length).toFixed(1)
      : '0',
    completed: filtered.filter(r => r.score === r.total).length,
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-green-600 bg-green-50';
    if (percentage >= 60) return 'text-blue-600 bg-blue-50';
    if (percentage >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreBadge = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return { label: 'Excellent', color: 'bg-green-500' };
    if (percentage >= 60) return { label: 'Good', color: 'bg-blue-500' };
    if (percentage >= 40) return { label: 'Fair', color: 'bg-yellow-500' };
    return { label: 'Needs Work', color: 'bg-red-500' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Quiz Results Dashboard
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-14">Track your progress and review your performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Quizzes</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Average Score</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avgScore}%</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Perfect Scores</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Award className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Type Toggle */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-2 shadow-sm border border-gray-100 dark:border-slate-800 mb-6 inline-flex">
          <button
            onClick={() => setViewType(ADMIN)}
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${viewType === ADMIN
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            Admin Quizzes
          </button>
          <button
            onClick={() => setViewType(USER)}
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${viewType === USER
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
              : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
          >
            User Quizzes
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-800 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by title, subject or course..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-12 border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800 dark:text-white"
              />
            </div>

            <Select
              value={selectedSubject}
              onValueChange={(val) => {
                setSelectedSubject(val);
                setSelectedChapter('all');
              }}
            >
              <SelectTrigger className="h-12 border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white">
                <SelectValue placeholder="Filter by Subject" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all" className="dark:text-white dark:focus:bg-slate-700">All Subjects</SelectItem>
                {subjects.map((subj, idx) => (
                  <SelectItem key={idx} value={subj} className="dark:text-white dark:focus:bg-slate-700">{subj}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedChapter}
              onValueChange={setSelectedChapter}
              disabled={viewType === USER || chapters.length === 0}
            >
              <SelectTrigger className="h-12 border-gray-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 dark:text-white">
                <SelectValue placeholder="Filter by Chapter" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all" className="dark:text-white dark:focus:bg-slate-700">All Chapters</SelectItem>
                {chapters.map((ch, idx) => (
                  <SelectItem key={idx} value={ch} className="dark:text-white dark:focus:bg-slate-700">{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="rounded-2xl border-gray-100 dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="pb-4">
                  <Skeleton className="h-6 w-3/4 mb-2 dark:bg-slate-800" />
                  <Skeleton className="h-4 w-1/2 dark:bg-slate-800" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full dark:bg-slate-800" />
                  <Skeleton className="h-4 w-2/3 dark:bg-slate-800" />
                  <Skeleton className="h-10 w-full mt-4 dark:bg-slate-800" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center shadow-sm border border-gray-100 dark:border-slate-800">
            <div className="inline-flex p-4 bg-gray-100 dark:bg-slate-800 rounded-full mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">No results found</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((result) => {
              const badge = getScoreBadge(result.score, result.total);
              const percentage = ((result.score / result.total) * 100).toFixed(0);

              return (
                <Card
                  key={result.id}
                  className="group hover:shadow-xl transition-all duration-300 border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900"
                >
                  <div className="relative">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
                            {result.title}
                          </h3>
                          <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white font-medium">
                            {result.type === USER ? 'User Quiz' : (result.isMock ? 'By Own' : 'By Admin')}
                          </span>
                        </div>
                      </div>

                      {/* Score Circle */}
                      <div className="flex items-center gap-4">
                        <div className="relative w-20 h-20">
                          <svg className="w-20 h-20 transform -rotate-90">
                            <circle
                              cx="40"
                              cy="40"
                              r="32"
                              stroke="rgba(255,255,255,0.2)"
                              strokeWidth="6"
                              fill="none"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r="32"
                              stroke="white"
                              strokeWidth="6"
                              fill="none"
                              strokeDasharray={`${(result.score / result.total) * 201} 201`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">{percentage}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-white/90 text-sm">Score</p>
                          <p className="text-white font-bold text-2xl">{result.score}/{result.total}</p>
                          <span className={`inline-block mt-1 px-2 py-0.5 ${badge.color} rounded-full text-xs text-white font-medium`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Subject</p>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{result.subject}</p>
                      </div>
                    </div>

                    {result.chapter !== 'N/A' && (
                      <div className="flex items-start gap-2 text-sm">
                        <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">Chapter</p>
                          <p className="text-gray-900 dark:text-gray-100 font-medium">{result.chapter}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">Completed</p>
                        <p className="text-gray-900 dark:text-gray-100 font-medium">
                          {formatDate(result.timestamp, result.date)}
                        </p>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl h-12 group/btn"
                      onClick={() => {
                        if (result.type === ADMIN) {
                          router.push(`/admin/students/responses?id=${result.id}&mock=${result.isMock}&studentId=${userId}`);
                        } else {
                          router.push(`/admin/students/user-responses?id=${result.quizId || result.id}`);
                        }
                      }}
                    >
                      View Responses
                      <ChevronRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
