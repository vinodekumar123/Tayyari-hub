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
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

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
  }, [router]);

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
  }, [userCourse]);

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
  }, [selectedSubject, subjectMap]);

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
            // get result and quiz meta in parallel
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

              // Subject
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

              // Chapter
              let chapterNames = 'N/A';
              if (quizMeta.questionFilters?.chapters?.length) {
                chapterNames = quizMeta.questionFilters.chapters.join(', ');
              } else if (quizMeta.chapter?.name) {
                chapterNames = quizMeta.chapter.name;
              } else if (typeof quizMeta.chapter === 'string') {
                chapterNames = quizMeta.chapter;
              }

              // Course
              const courseName = quizMeta.course?.name || quizMeta.course || 'Unknown';

              // ========== LIVE SCORE CALCULATION ==========
              // Use selectedQuestions and answers to calculate score live
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
  }, [userId]);

  // --------- Fetch User Quizzes (userResults) ----------
  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    // Use same Firestore instance as 'student-results-page.jsx'
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
          // Prefetch quiz meta
          metaFetches.push(
            getDoc(doc(clientDb, 'user-quizzes', docSnap.id)).then(metaSnap => {
              if (metaSnap.exists()) {
                quizMetas[docSnap.id] = {
                  name: metaSnap.data().name,
                  subject: metaSnap.data().subject,
                };
              }
            })
          );
        });
        await Promise.all(metaFetches);

        // Shape to match adminResults structure
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
            // so we can route to the correct response page
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

      // Subject filter
      if (selectedSubject !== 'all') {
        list = list.filter((r) =>
          (r.subject || '').toLowerCase().includes(selectedSubject.toLowerCase())
        );
      }

      // Chapter filter (admin results only)
      if (viewType === ADMIN && selectedChapter !== 'all') {
        list = list.filter((r) =>
          (r.chapter || '').toLowerCase().includes(selectedChapter.toLowerCase())
        );
      }

      // Search filter
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

  // --------- UI ----------
  return (
    <div className="mx-auto py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-blue-50 min-h-screen">
      <h1 className="text-4xl font-extrabold text-gray-800 mb-10 text-left">📋 Quiz Results</h1>

      {/* Quiz Type Filter */}
      <div className="flex gap-4 mb-8">
        <Button
          variant={viewType === ADMIN ? 'default' : 'outline'}
          className={`font-semibold ${viewType === ADMIN ? 'bg-blue-600 text-white' : 'text-blue-700 border-blue-500'}`}
          onClick={() => setViewType(ADMIN)}
        >
          Admin Quizzes
        </Button>
        <Button
          variant={viewType === USER ? 'default' : 'outline'}
          className={`font-semibold ${viewType === USER ? 'bg-blue-600 text-white' : 'text-blue-700 border-blue-500'}`}
          onClick={() => setViewType(USER)}
        >
          User Quizzes
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid md:grid-cols-3 gap-4">
        <Input
          placeholder="🔍 Search by title, subject or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-6 border border-gray-300 rounded-xl shadow-sm text-base"
        />

        <Select
          value={selectedSubject}
          onValueChange={(val) => {
            setSelectedSubject(val);
            setSelectedChapter('all');
          }}
        >
          <SelectTrigger><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((subj, idx) => (
              <SelectItem key={idx} value={subj}>{subj}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Only enable chapter filter for admin view */}
        <Select
          value={selectedChapter}
          onValueChange={setSelectedChapter}
          disabled={viewType === USER || chapters.length === 0}
        >
          <SelectTrigger><SelectValue placeholder="Filter by Chapter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Chapters</SelectItem>
            {chapters.map((ch, idx) => (
              <SelectItem key={idx} value={ch}>{ch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 w-full rounded-xl shadow-md">
              <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-center text-base">No results found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map((result) => (
            <Card
              key={result.id}
              className="hover:shadow-xl transition-all border w-full rounded-xl border-gray-200 bg-white"
            >
              <CardHeader className="bg-blue-600 text-white rounded-t-xl p-4">
                <CardTitle className="text-xl font-bold">{result.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 space-y-3 px-6 py-5">
                <p><strong>📘 Course:</strong> {result.course}</p>
                <p><strong>📚 Subject:</strong> {result.subject}</p>
                <p><strong>📖 Chapter:</strong> {result.chapter}</p>
                <p><strong>📊 Score:</strong> {result.score} / {result.total}</p>
                <p><strong>🧾 Type:</strong> {result.type === USER ? 'User Quiz' : (result.isMock ? 'By Own' : 'By Admin')}</p>
                <p><strong>📅 Date:</strong> {result.timestamp?.toDate
                  ? format(result.timestamp.toDate(), 'dd MMM yyyy, hh:mm a')
                  : (result.date
                    ? format(result.date, 'dd MMM yyyy, hh:mm a')
                    : 'N/A')
                }</p>
                <Button
                  variant="outline"
                  className="w-full text-sm font-semibold border-blue-500 text-blue-700 hover:bg-blue-50 mt-4"
                  onClick={() => {
                    if (result.type === ADMIN) {
                      router.push(`/admin/students/responses?id=${result.id}&mock=${result.isMock}&studentId=${userId}`);
                    } else {
                      router.push(`/admin/students/user-responses?id=${result.quizId || result.id}`);
                    }
                  }}
                >
                  🔎 View Responses
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
