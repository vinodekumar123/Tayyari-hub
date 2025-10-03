'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  doc,
  serverTimestamp,
  writeBatch,
  increment,
  getDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from 'app/firebase';
import { Button } from '@/components/ui/button';

const MAX_QUESTIONS = 100;

interface MockQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  enableExplanation?: boolean;
  subject?: string;
  chapter?: string;
  usedInQuizzes?: number;
}

interface AnalyticsDoc {
  totalQuestions: number;
  usedQuestionsCount: number;
  unusedQuestionsCount: number;
  updatedAt: any;
}

export default function CreateUserQuizPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, string[]>>({});
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState<number>(20);
  const [duration, setDuration] = useState<number>(60);
  const [title, setTitle] = useState<string>('');
  const [questionsPerPage, setQuestionsPerPage] = useState<number>(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For analytics
  const [subjectAnalytics, setSubjectAnalytics] = useState<Record<string, AnalyticsDoc>>({});

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  // Load subjects & chapters once
  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'mock-questions'));
        const snap = await getDocs(q);

        const sSet = new Set<string>();
        const chaptersMap: Record<string, Set<string>> = {};

        snap.docs.forEach((d) => {
          const data = d.data();
          const subject = (data.subject || 'Uncategorized').toString();
          const chapter = (data.chapter || 'Uncategorized').toString();

          sSet.add(subject);
          if (!chaptersMap[subject]) chaptersMap[subject] = new Set();
          chaptersMap[subject].add(chapter);
        });

        if (!mounted) return;

        const sArr = Array.from(sSet).sort();
        const chaptersObj: Record<string, string[]> = {};
        Object.entries(chaptersMap).forEach(([k, v]) => {
          chaptersObj[k] = Array.from(v).sort();
        });

        setSubjects(sArr);
        setChaptersBySubject(chaptersObj);

        if (sArr.length > 0 && selectedSubjects.length === 0) {
          setSelectedSubjects([sArr[0]]);
          setSelectedChapters(chaptersObj[sArr[0]]?.slice(0, 1) || []);
        }
      } catch (err) {
        console.error('Failed to load mock-questions meta', err);
        setError('Failed to load subjects/chapters. Try again later.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadMeta();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update selected chapters when selectedSubjects changes
  useEffect(() => {
    if (selectedSubjects.length > 0) {
      setSelectedChapters((prev) => {
        let chapters = [...prev];
        selectedSubjects.forEach((s) => {
          const chs = chaptersBySubject[s] || [];
          if (chs.length > 0 && !chapters.some((c) => chs.includes(c))) {
            chapters.push(chs[0]);
          }
        });
        chapters = chapters.filter((c) =>
          selectedSubjects.some((s) => (chaptersBySubject[s] || []).includes(c))
        );
        return chapters;
      });
    } else {
      setSelectedChapters([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjects, chaptersBySubject]);

  // Load precomputed analytics for dashboard speed
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;
      const analytics: Record<string, AnalyticsDoc> = {};
      for (const subject of subjects) {
        const analyticsDocRef = doc(db, 'users', user.uid, 'dashboard-analytics', subject);
        try {
          const snap = await getDoc(analyticsDocRef);
          if (snap.exists()) {
            analytics[subject] = snap.data() as AnalyticsDoc;
          } else {
            analytics[subject] = {
              totalQuestions: 0,
              usedQuestionsCount: 0,
              unusedQuestionsCount: 0,
              updatedAt: null,
            };
          }
        } catch {
          analytics[subject] = {
            totalQuestions: 0,
            usedQuestionsCount: 0,
            unusedQuestionsCount: 0,
            updatedAt: null,
          };
        }
      }
      setSubjectAnalytics(analytics);
    };
    if (subjects.length > 0 && user) fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, user]);

  const toggleChapter = (c: string) => {
    setSelectedChapters((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      return [...prev, c];
    });
  };

  const toggleSubject = (s: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(s)) {
        setSelectedChapters((chs) =>
          chs.filter((ch) => !(chaptersBySubject[s] || []).includes(ch))
        );
        return prev.filter((x) => x !== s);
      } else {
        const chs = chaptersBySubject[s] || [];
        setSelectedChapters((prevChs) => {
          if (chs.length > 0 && !prevChs.some((c) => chs.includes(c))) {
            return [...prevChs, chs[0]];
          }
          return prevChs;
        });
        return [...prev, s];
      }
    });
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be logged in to create a test.');
      return;
    }
    if (selectedSubjects.length === 0) {
      setError('Please select at least one subject.');
      return;
    }
    if (selectedChapters.length === 0) {
      setError('Please select at least one chapter.');
      return;
    }
    if (!numQuestions || numQuestions <= 0) {
      setError('Number of questions must be greater than 0.');
      return;
    }
    if (numQuestions > MAX_QUESTIONS) {
      setError(`Max questions allowed: ${MAX_QUESTIONS}`);
      return;
    }
    if (!questionsPerPage || questionsPerPage <= 0) {
      setError('Questions per page must be at least 1.');
      return;
    }
    if (questionsPerPage > numQuestions) {
      setError('Questions per page cannot exceed total number of questions.');
      return;
    }

    setCreating(true);

    try {
      // 1) Gather all relevant questions for selected subjects/chapters
      let allQuestions: MockQuestion[] = [];
      const subjectPools: Record<string, MockQuestion[]> = {};

      for (const subj of selectedSubjects) {
        const mqRef = collection(db, 'mock-questions');
        const q = query(mqRef, where('subject', '==', subj));
        const snap = await getDocs(q);
        const pool: MockQuestion[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        subjectPools[subj] = pool;
        allQuestions = allQuestions.concat(pool);
      }

      // filter by selected chapters
      const filtered = allQuestions.filter((p) => selectedChapters.includes(p.chapter || ''));
      if (filtered.length === 0) {
        setError('No questions found for selected subjects/chapters.');
        setCreating(false);
        return;
      }

      // 2) For each selected subject, fetch user's used questions for that subject
      const userUsedBySubject: Record<string, Set<string>> = {};
      for (const subj of selectedSubjects) {
        const usageDocRef = doc(db, 'users', user.uid, 'question-usage', subj);
        let usedArr: string[] = [];
        try {
          const usageSnap = await getDoc(usageDocRef);
          if (usageSnap.exists()) {
            usedArr = usageSnap.data().usedQuestions || [];
          }
        } catch (e) { /* ignore */ }
        userUsedBySubject[subj] = new Set(usedArr);
      }

      // 3) Partition filtered pool into unused and used for this user
      const unused: MockQuestion[] = [];
      const used: MockQuestion[] = [];
      for (const q of filtered) {
        const subj = q.subject || '';
        if (userUsedBySubject[subj]?.has(q.id)) {
          used.push(q);
        } else {
          unused.push(q);
        }
      }

      // 4) Pick N questions, prefer unused
      const N = Math.min(numQuestions, filtered.length);
      const selected: MockQuestion[] = [];
      for (let i = 0; i < unused.length && selected.length < N; i++) selected.push(unused[i]);
      for (let i = 0; i < used.length && selected.length < N; i++) selected.push(used[i]);

      // 5) Build embedded question snapshot
      const selectedSnapshot = selected.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || '',
        enableExplanation: !!q.enableExplanation,
        subject: q.subject || '',
        chapter: q.chapter || '',
      }));

      // 6) Create user-quizzes doc
      const newDocRef = doc(collection(db, 'user-quizzes'));
      const quizTitle =
        title?.trim() ||
        `${selectedSubjects.join(', ')} Test - ${new Date().toLocaleDateString()}`;

      await setDoc(newDocRef, {
        title: quizTitle,
        createdBy: user.uid,
        subjects: selectedSubjects,
        chapters: selectedChapters,
        duration: duration,
        questionCount: selectedSnapshot.length,
        questionsPerPage,
        selectedQuestions: selectedSnapshot,
        createdAt: serverTimestamp(),
      });

      // 7) Update user's usedQuestions per subject in batch and update dashboard analytics
      const batch = writeBatch(db);
      const subjectToIds: Record<string, string[]> = {};
      for (const q of selected) {
        const subj = q.subject || '';
        if (!subjectToIds[subj]) subjectToIds[subj] = [];
        subjectToIds[subj].push(q.id);
      }

      for (const subj of Object.keys(subjectToIds)) {
        // Update used questions doc
        const usageDocRef = doc(db, 'users', user.uid, 'question-usage', subj);
        batch.set(usageDocRef, { usedQuestions: [] }, { merge: true });
        batch.update(usageDocRef, {
          usedQuestions: arrayUnion(...subjectToIds[subj])
        });

        // RECALCULATE ANALYTICS FOR THIS SUBJECT
        // Get total questions for subject
        const pool = subjectPools[subj] || [];
        // Get old used set and add newly used
        const usedSet = userUsedBySubject[subj] || new Set();
        subjectToIds[subj].forEach((id) => usedSet.add(id));
        const usedCount = pool.filter(q => usedSet.has(q.id)).length;
        const total = pool.length;
        const unusedCount = total - usedCount;
        // Update dashboard analytics doc
        const analyticsDocRef = doc(db, 'users', user.uid, 'dashboard-analytics', subj);
        batch.set(analyticsDocRef, {
          totalQuestions: total,
          usedQuestionsCount: usedCount,
          unusedQuestionsCount: unusedCount,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // Optionally, update usedInQuizzes counters in mock-questions too
      selected.forEach((q) => {
        const qRef = doc(db, 'mock-questions', q.id);
        batch.update(qRef, {
          usedInQuizzes: increment(1),
        });
      });
      await batch.commit();

      // 8) Redirect to start page for user quizzes
      router.push(`/quiz/start-user-quiz?id=${newDocRef.id}`);
    } catch (err) {
      console.error('Error creating user quiz', err);
      setError('Failed to create test. Try again later.');
      setCreating(false);
      return;
    }
  };

  if (loading)
    return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Create Your Own Test</h2>

      {error && <div className="mb-4 text-sm text-red-700 bg-red-100 p-2 rounded">{error}</div>}

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Chemistry Practice Test"
            className="mt-1 block w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Subjects (select one or more)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {subjects.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggleSubject(s)}
                className={`px-3 py-1 rounded border ${
                  selectedSubjects.includes(s)
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700'
                }`}
              >
                {s}
                {/* Analytics: show total/used/unused if loaded */}
                {subjectAnalytics[s] &&
                  <span className="ml-2 text-xs text-gray-500">
                    T:{subjectAnalytics[s].totalQuestions} U:{subjectAnalytics[s].unusedQuestionsCount} Used:{subjectAnalytics[s].usedQuestionsCount}
                  </span>
                }
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Chapters (select one or more)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedSubjects.flatMap((subject) =>
              (chaptersBySubject[subject] || []).map((c) => (
                <button
                  type="button"
                  key={subject + '::' + c}
                  onClick={() => toggleChapter(c)}
                  className={`px-3 py-1 rounded border ${
                    selectedChapters.includes(c)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700'
                  }`}
                >
                  {c} <span className="text-xs text-gray-400">({subject})</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">Number of Questions</label>
            <input
              type="number"
              min={1}
              max={MAX_QUESTIONS}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Questions per Page</label>
            <input
              type="number"
              min={1}
              max={numQuestions}
              value={questionsPerPage}
              onChange={(e) => setQuestionsPerPage(Number(e.target.value))}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={creating} className="bg-blue-600 text-white">
            {creating ? 'Creating...' : 'Create Test & Start'}
          </Button>
        </div>
      </form>
    </div>
  );
}
