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
import { Sidebar } from '@/components/ui/sidebar';

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

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
  }, []);

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
  }, [selectedSubjects, chaptersBySubject]);

  useEffect(() => {
    setQuestionsPerSubject((prev) => {
      const updated: Record<string, number> = { ...prev };
      selectedSubjects.forEach(subj => {
        if (!updated[subj]) updated[subj] = 5;
      });
      Object.keys(updated).forEach(subj => {
        if (!selectedSubjects.includes(subj)) delete updated[subj];
      });
      return updated;
    });
  }, [selectedSubjects]);

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

      for (const subj of selectedSubjects) {
        const pool = subjectPools[subj].filter((p) => selectedChapters.includes(p.chapter || ''));
        const numThisSubject = questionsPerSubject[subj] || 0;

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

      const batch = writeBatch(db);
      const subjectToIds: Record<string, string[]> = {};
      for (const q of allSelectedQuestions) {
        const subj = q.subject || '';
        if (!subjectToIds[subj]) subjectToIds[subj] = [];
        subjectToIds[subj].push(q.id);
      }

      for (const subj of Object.keys(subjectToIds)) {
        const pool = subjectPools[subj] || [];
        const oldUsedSet = new Set(subjectAnalytics[subj]?.usedQuestions || []);
        subjectToIds[subj].forEach((id) => oldUsedSet.add(id));
        const usedArr = Array.from(oldUsedSet);
        const usedCount = pool.filter(q => oldUsedSet.has(q.id)).length;
        const total = pool.length;
        const unusedCount = total - usedCount;

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

  const totalQuestions = Object.values(questionsPerSubject).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700 text-lg font-medium">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <div className="flex-1 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .card-light {
            background: white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: all 0.3s ease;
          }
          .card-light:hover {
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            transform: translateY(-2px);
          }
          .btn-primary {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            transition: all 0.3s ease;
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(79, 70, 229, 0.4);
          }
          .chip {
            transition: all 0.3s ease;
          }
          .chip:hover {
            transform: scale(1.05);
          }
          .animate-fade-in {
            animation: fadeIn 0.5s ease-out forwards;
          }
        `}</style>

        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Craft Your Test
            </h1>
            <p className="text-gray-600 text-lg">Design a personalized quiz tailored to your learning goals</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-8 bg-red-50 border-2 border-red-200 rounded-2xl p-4 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 text-sm font-bold">!</span>
                </div>
                <p className="text-red-700 flex-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-8">
            {/* Title Input */}
            <div className="card-light rounded-3xl p-8 animate-fade-in">
              <label className="block text-gray-700 text-sm font-semibold mb-3 uppercase tracking-wider">Test Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Chemistry Practice Test"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl px-6 py-4 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Subjects Selection */}
            <div className="card-light rounded-3xl p-8 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <label className="text-gray-700 text-sm font-semibold uppercase tracking-wider">Select Subjects</label>
                <span className="text-indigo-600 text-sm font-medium">{selectedSubjects.length} selected</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {subjects.map((s) => {
                  const analytics = subjectAnalytics[s];
                  const isSelected = selectedSubjects.includes(s);
                  return (
                    <button
                      type="button"
                      key={s}
                      onClick={() => toggleSubject(s)}
                      className={`chip rounded-2xl p-4 text-left transition-all ${
                        isSelected
                          ? 'bg-gradient-to-br from-indigo-100 to-purple-100 border-2 border-indigo-400'
                          : 'bg-gray-50 border-2 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-800 font-semibold">{s}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                        }`}>
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </div>
                      </div>
                      {analytics && (
                        <div className="flex gap-3 text-xs">
                          <span className="text-gray-600">Total: {analytics.totalQuestions}</span>
                          <span className="text-green-600">Fresh: {analytics.unusedQuestionsCount}</span>
                          <span className="text-amber-600">Used: {analytics.usedQuestionsCount}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Questions per subject */}
              {selectedSubjects.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedSubjects.map(subj => (
                    <div key={subj} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                      <label className="block text-gray-600 text-xs mb-2 uppercase tracking-wider font-medium">{subj}</label>
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
                        className="w-full bg-white border-2 border-gray-200 rounded-lg px-4 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chapters Selection */}
            {selectedSubjects.length > 0 && (
              <div className="card-light rounded-3xl p-8 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <label className="text-gray-700 text-sm font-semibold uppercase tracking-wider">Select Chapters</label>
                  <span className="text-indigo-600 text-sm font-medium">{selectedChapters.length} selected</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {selectedSubjects.flatMap((subject) =>
                    (chaptersBySubject[subject] || []).map((c) => {
                      const isSelected = selectedChapters.includes(c);
                      return (
                        <button
                          type="button"
                          key={subject + '::' + c}
                          onClick={() => toggleChapter(c)}
                          className={`chip px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-700 border-2 border-gray-200'
                          }`}
                        >
                          {c} <span className="text-xs opacity-70">({subject})</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className="card-light rounded-3xl p-6">
                <label className="block text-gray-700 text-sm font-semibold mb-3 uppercase tracking-wider">Duration</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <span className="text-gray-600 text-sm font-medium">min</span>
                </div>
              </div>

              <div className="card-light rounded-3xl p-6">
                <label className="block text-gray-700 text-sm font-semibold mb-3 uppercase tracking-wider">Per Page</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={totalQuestions || 1}
                    value={questionsPerPage}
                    onChange={(e) => setQuestionsPerPage(Number(e.target.value))}
                    className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <span className="text-gray-600 text-sm font-medium">Q's</span>
                </div>
              </div>

              <div className="card-light rounded-3xl p-6 flex flex-col justify-between">
                <label className="block text-gray-700 text-sm font-semibold mb-3 uppercase tracking-wider">Total Questions</label>
                <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                  {totalQuestions}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-6 animate-fade-in">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary px-12 py-5 rounded-2xl text-white font-semibold text-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                {creating ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Your Test...
                  </>
                ) : (
                  <>
                    <span>Create Test & Launch</span>
                    <span className="text-2xl">→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
