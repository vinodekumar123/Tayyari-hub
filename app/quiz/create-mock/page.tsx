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

interface SubjectUsageDoc {
  usedQuestions: string[];
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
  const [questionsPerSubject, setQuestionsPerSubject] = useState<Record<string, number>>({});
  const [duration, setDuration] = useState<number>(60);
  const [title, setTitle] = useState<string>('');
  const [questionsPerPage, setQuestionsPerPage] = useState<number>(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subjectAnalytics, setSubjectAnalytics] = useState<Record<string, SubjectUsageDoc>>({});

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

  // Per-subject question count state: initialize or clean up as subjects change
  useEffect(() => {
    setQuestionsPerSubject((prev) => {
      const updated: Record<string, number> = { ...prev };
      selectedSubjects.forEach(subj => {
        if (!updated[subj]) updated[subj] = 5; // default value per subject
      });
      Object.keys(updated).forEach(subj => {
        if (!selectedSubjects.includes(subj)) delete updated[subj];
      });
      return updated;
    });
  }, [selectedSubjects]);

  // Load subject usage analytics for dashboard speed (from user's question-usage subject docs)
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user) return;
      const analytics: Record<string, SubjectUsageDoc> = {};
      for (const subject of subjects) {
        const docRef = doc(db, 'users', user.uid, 'question-usage', subject);
        try {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            analytics[subject] = snap.data() as SubjectUsageDoc;
            if (!analytics[subject].usedQuestions) analytics[subject].usedQuestions = [];
          } else {
            analytics[subject] = {
              usedQuestions: [],
              totalQuestions: 0,
              usedQuestionsCount: 0,
              unusedQuestionsCount: 0,
              updatedAt: null,
            };
          }
        } catch {
          analytics[subject] = {
            usedQuestions: [],
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

    let totalSelectedQuestions = 0;
    for (const subj of selectedSubjects) {
      const count = questionsPerSubject[subj] || 0;
      if (count <= 0) {
        setError(`Number of questions for ${subj} must be at least 1.`);
        return;
      }
      totalSelectedQuestions += count;
    }
    if (totalSelectedQuestions > MAX_QUESTIONS) {
      setError(`Total questions across all subjects cannot exceed ${MAX_QUESTIONS}.`);
      return;
    }
    if (!questionsPerPage || questionsPerPage <= 0) {
      setError('Questions per page must be at least 1.');
      return;
    }
    if (questionsPerPage > totalSelectedQuestions) {
      setError('Questions per page cannot exceed total number of questions.');
      return;
    }

    setCreating(true);

    try {
      let allSelectedQuestions: MockQuestion[] = [];
      const subjectPools: Record<string, MockQuestion[]> = {};

      for (const subj of selectedSubjects) {
        const mqRef = collection(db, 'mock-questions');
        const q = query(mqRef, where('subject', '==', subj));
        const snap = await getDocs(q);
        const pool: MockQuestion[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        subjectPools[subj] = pool;
      }

      // For each subject, filter chapters and select N questions (prefer unused)
      for (const subj of selectedSubjects) {
        const pool = subjectPools[subj].filter((p) => selectedChapters.includes(p.chapter || ''));
        const numThisSubject = questionsPerSubject[subj] || 0;

        // Get user's used questions for this subject
        const usedSet = new Set(
          subjectAnalytics[subj]?.usedQuestions || []
        );

        const unused = pool.filter((q) => !usedSet.has(q.id));
        const used = pool.filter((q) => usedSet.has(q.id));
        const selected: MockQuestion[] = [];
        for (let i = 0; i < unused.length && selected.length < numThisSubject; i++) selected.push(unused[i]);
        for (let i = 0; i < used.length && selected.length < numThisSubject; i++) selected.push(used[i]);
        allSelectedQuestions = allSelectedQuestions.concat(selected);
      }

      const selectedSnapshot = allSelectedQuestions.map((q) => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || '',
        enableExplanation: !!q.enableExplanation,
        subject: q.subject || '',
        chapter: q.chapter || '',
      }));

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

      // Update user's usedQuestions per subject (and analytics) in batch
      const batch = writeBatch(db);
      const subjectToIds: Record<string, string[]> = {};
      for (const q of allSelectedQuestions) {
        const subj = q.subject || '';
        if (!subjectToIds[subj]) subjectToIds[subj] = [];
        subjectToIds[subj].push(q.id);
      }

      for (const subj of Object.keys(subjectToIds)) {
        // Get pool for this subject
        const pool = subjectPools[subj] || [];
        // Get old used set and add newly used
        const oldUsedSet = new Set(subjectAnalytics[subj]?.usedQuestions || []);
        subjectToIds[subj].forEach((id) => oldUsedSet.add(id));
        const usedArr = Array.from(oldUsedSet);
        const usedCount = pool.filter(q => oldUsedSet.has(q.id)).length;
        const total = pool.length;
        const unusedCount = total - usedCount;

        // Update question-usage doc, including analytics fields
        const usageDocRef = doc(db, 'users', user.uid, 'question-usage', subj);
        batch.set(usageDocRef, {
          usedQuestions: usedArr,
          totalQuestions: total,
          usedQuestionsCount: usedCount,
          unusedQuestionsCount: unusedCount,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      allSelectedQuestions.forEach((q) => {
        const qRef = doc(db, 'mock-questions', q.id);
        batch.update(qRef, {
          usedInQuizzes: increment(1),
        });
      });
      await batch.commit();

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
                {subjectAnalytics[s] &&
                  <span className="ml-2 text-xs text-gray-500">
                    T:{subjectAnalytics[s].totalQuestions} U:{subjectAnalytics[s].unusedQuestionsCount} Used:{subjectAnalytics[s].usedQuestionsCount}
                  </span>
                }
              </button>
            ))}
          </div>
          {/* Per-subject question count inputs */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {selectedSubjects.map(subj => (
              <div key={subj}>
                <label className="block text-xs font-medium">{subj} - No. of Questions</label>
                <input
                  type="number"
                  min={1}
                  max={subjectAnalytics[subj]?.totalQuestions || 100}
                  value={questionsPerSubject[subj] || 1}
                  onChange={e =>
                    setQuestionsPerSubject(ps => ({
                      ...ps,
                      [subj]: Math.max(1, Number(e.target.value))
                    }))
                  }
                  className="mt-1 block w-full border rounded p-2"
                />
              </div>
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
              max={Object.values(questionsPerSubject).reduce((a, b) => a + b, 0) || 1}
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
