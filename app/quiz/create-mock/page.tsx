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

const MAX_QUESTIONS = 180;
const MAX_QUESTIONS_PER_PAGE = 180;

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

export default function CreateUserQuizPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, string[]>>({});
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [numQuestions, setNumQuestions] = useState<number>(20);
  const [questionsPerPage, setQuestionsPerPage] = useState<number>(10);
  const [duration, setDuration] = useState<number>(60);
  const [title, setTitle] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle subject selection (multiple, with checkboxes)
  const handleSubjectChange = (subject: string) => {
    setSelectedSubjects((prev) => {
      if (prev.includes(subject)) {
        const filtered = prev.filter((s) => s !== subject);
        setSelectedChapters((prevChapters) =>
          prevChapters.filter(
            (chapter) => !chaptersBySubject[subject]?.includes(chapter)
          )
        );
        return filtered;
      } else {
        return [...prev, subject];
      }
    });
  };

  // Handle chapter selection (multiple, with checkboxes)
  const handleChapterChange = (chapter: string) => {
    setSelectedChapters((prev) => {
      if (prev.includes(chapter)) {
        return prev.filter((c) => c !== chapter);
      } else {
        return [...prev, chapter];
      }
    });
  };

  // Save selected subjects to "subjects" collection if not exist
  const saveSubjectsToDb = async (subjectsToSave: string[]) => {
    const subjectsCollection = collection(db, 'subjects');
    for (const subject of subjectsToSave) {
      const subjectDocRef = doc(subjectsCollection, subject);
      const docSnap = await getDoc(subjectDocRef);
      if (!docSnap.exists()) {
        await setDoc(subjectDocRef, {
          name: subject,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || null,
        });
      }
    }
  };

  // Save quiz title to "quiz-titles" collection if not exist
  const saveTitleToDb = async (quizTitle: string) => {
    if (!quizTitle.trim()) return;
    const titlesCollection = collection(db, 'quiz-titles');
    const titleDocRef = doc(titlesCollection, quizTitle.trim());
    const docSnap = await getDoc(titleDocRef);
    if (!docSnap.exists()) {
      await setDoc(titleDocRef, {
        title: quizTitle.trim(),
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
      });
    }
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
      setError('Questions per page must be greater than 0.');
      return;
    }
    if (questionsPerPage > MAX_QUESTIONS_PER_PAGE) {
      setError(`Max questions per page: ${MAX_QUESTIONS_PER_PAGE}`);
      return;
    }

    setCreating(true);

    try {
      // Save selected subjects to "subjects" collection
      await saveSubjectsToDb(selectedSubjects);

      // Save quiz title to "quiz-titles" collection
      const quizTitle =
        title?.trim() ||
        `${selectedSubjects.join(', ')} Test - ${new Date().toLocaleDateString()}`;
      await saveTitleToDb(quizTitle);

      // 1) Fetch pool matching subjects & chapters
      const mqRef = collection(db, 'mock-questions');
      let allQuestions: MockQuestion[] = [];

      for (const subject of selectedSubjects) {
        const q = query(mqRef, where('subject', '==', subject));
        const snap = await getDocs(q);
        const pool: MockQuestion[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        const filtered = pool.filter((p) => selectedChapters.includes(p.chapter || ''));
        allQuestions = [...allQuestions, ...filtered];
      }

      if (allQuestions.length === 0) {
        setError('No questions found for selected subjects/chapters.');
        setCreating(false);
        return;
      }

      // 2) Partition unused vs used
      const unused = allQuestions.filter((p) => !p.usedInQuizzes || p.usedInQuizzes === 0);
      const used = allQuestions.filter((p) => p.usedInQuizzes && p.usedInQuizzes > 0);

      // 3) Pick N questions prefer unused
      const N = Math.min(numQuestions, allQuestions.length);
      const selected: MockQuestion[] = [];
      for (let i = 0; i < unused.length && selected.length < N; i++) selected.push(unused[i]);
      for (let i = 0; i < used.length && selected.length < N; i++) selected.push(used[i]);

      // 4) Build embedded question snapshot
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

      // 5) Create user-quizzes doc (subjects/chapters as array of strings)
      const newDocRef = doc(collection(db, 'user-quizzes'));
      await setDoc(newDocRef, {
        title: quizTitle,
        createdBy: user.uid,
        subjects: selectedSubjects, // <-- now array of strings
        chapters: selectedChapters, // <-- now array of strings
        duration: duration,
        questionCount: selectedSnapshot.length,
        selectedQuestions: selectedSnapshot,
        createdAt: serverTimestamp(),
        questionsPerPage,
      });

      // 6) Update usedInQuizzes counters in batch
      const batch = writeBatch(db);
      selected.forEach((q) => {
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

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-white rounded-2xl shadow-xl">
      <h2 className="text-3xl font-bold mb-6 text-indigo-700">Create Your Own Test</h2>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-100 p-2 rounded border border-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-indigo-800 mb-1">Title (optional)</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. My Science Practice Test"
            className="mt-1 block w-full border border-indigo-200 rounded-lg p-2 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-indigo-800 mb-1">Subjects</label>
          <div className="flex flex-wrap gap-3 mt-2">
            {subjects.map((s) => (
              <label key={s} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow hover:bg-indigo-50 cursor-pointer border border-indigo-100 font-medium">
                <input
                  type="checkbox"
                  checked={selectedSubjects.includes(s)}
                  onChange={() => handleSubjectChange(s)}
                  className="form-checkbox h-4 w-4 text-indigo-600 border-indigo-300"
                />
                <span className="text-indigo-700">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-indigo-800 mb-1">Chapters</label>
          <div className="flex flex-wrap gap-3 mt-2">
            {selectedSubjects.length === 0 ? (
              <span className="text-gray-400 italic">Select subjects to see chapters</span>
            ) : (
              selectedSubjects.flatMap((subject) =>
                (chaptersBySubject[subject] || []).map((c) => (
                  <label key={`${subject}-${c}`} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white shadow hover:bg-blue-50 cursor-pointer border border-blue-100 font-medium">
                    <input
                      type="checkbox"
                      checked={selectedChapters.includes(c)}
                      onChange={() => handleChapterChange(c)}
                      className="form-checkbox h-4 w-4 text-blue-600 border-blue-300"
                    />
                    <span className="text-blue-700">{c}</span>
                  </label>
                ))
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-semibold text-indigo-800 mb-1">Number of Questions</label>
            <input
              type="number"
              min={1}
              max={MAX_QUESTIONS}
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="mt-1 block w-full border border-indigo-200 rounded-lg p-2 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <span className="text-xs text-gray-400">Max {MAX_QUESTIONS}</span>
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-800 mb-1">Questions Per Page</label>
            <input
              type="number"
              min={1}
              max={MAX_QUESTIONS_PER_PAGE}
              value={questionsPerPage}
              onChange={(e) => setQuestionsPerPage(Number(e.target.value))}
              className="mt-1 block w-full border border-indigo-200 rounded-lg p-2 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <span className="text-xs text-gray-400">Max {MAX_QUESTIONS_PER_PAGE}</span>
          </div>
          <div>
            <label className="block text-sm font-semibold text-indigo-800 mb-1">Duration (minutes)</label>
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 block w-full border border-indigo-200 rounded-lg p-2 bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={creating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold px-6 py-2 rounded-lg shadow transition-all"
          >
            {creating ? 'Creating...' : 'Create Test & Start'}
          </Button>
        </div>
      </form>
    </div>
  );
}
