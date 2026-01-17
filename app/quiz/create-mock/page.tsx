'use client';
import ComingSoon from '@/components/ui/coming-soon';

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
  limit,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/app/firebase';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  BookOpen,
  Layers,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Brain
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { glassmorphism, animations } from '@/lib/design-tokens';
import { UnifiedHeader } from '@/components/unified-header';
import { createMockQuiz } from '@/app/actions/create-quiz';
import { useTransition } from 'react';

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

function CreateUserQuizPageOriginal() {
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
  const [isPending, startTransition] = useTransition();
  // const [creating, setCreating] = useState(false); // Removed in favor of isPending
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
        // [OPTIMIZED] Try fetching pre-aggregated metadata first
        const metaDocRef = doc(db, 'mock-questions-metadata', 'config');
        const metaSnap = await getDoc(metaDocRef);

        if (metaSnap.exists()) {
          const data = metaSnap.data();
          if (mounted) {
            setSubjects(data.subjects || []);
            setChaptersBySubject(data.chaptersBySubject || {});
            setLoading(false);
          }
          return;
        }

        // [FALLBACK] If metadata missing, use old full-scan method
        console.warn('Metadata not found, falling back to full scan (Limited to 500 for safety).');
        const q = query(collection(db, 'mock-questions'), limit(500));
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
            // Auto-select first chapter ONLY if no chapters selected for this subject yet
            // Logic kept from original but slightly refined to avoid aggressive auto-select
            if (!chapters.filter(c => chs.includes(c)).length) {
              chapters.push(chs[0]);
            }
          }
        });
        // Filter out chapters from deselected subjects
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
      if (!user || subjects.length === 0) return;

      const analytics: Record<string, SubjectUsageDoc> = {};

      // Batch fetches? Or parallel promises.
      // Firestore batch get is getDocs(query(collection(users, uid, question-usage), where(documentId(), in, subjects)))
      // simpler to map

      await Promise.all(subjects.map(async (subject) => {
        const docRef = doc(db, 'users', user.uid, 'question-usage', subject);
        try {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            analytics[subject] = snap.data() as SubjectUsageDoc;
            if (!analytics[subject].usedQuestions) analytics[subject].usedQuestions = [];
          } else {
            // Defaults
            analytics[subject] = { usedQuestions: [], totalQuestions: 0, usedQuestionsCount: 0, unusedQuestionsCount: 0, updatedAt: null };
          }
        } catch {
          analytics[subject] = { usedQuestions: [], totalQuestions: 0, usedQuestionsCount: 0, unusedQuestionsCount: 0, updatedAt: null };
        }
      }));
      setSubjectAnalytics(analytics);
    };
    fetchAnalytics();
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
        return prev.filter((x) => x !== s);
      } else {
        return [...prev, s];
      }
    });
  };

  const handleCreate = async () => {
    setError(null);

    if (!user) {
      toast.error('You must be logged in to create a test.');
      return;
    }
    if (selectedSubjects.length === 0) {
      toast.error('Please select at least one subject.');
      return;
    }
    if (selectedChapters.length === 0) {
      toast.error('Please select at least one chapter.');
      return;
    }

    let totalSelectedQuestions = 0;
    for (const subj of selectedSubjects) {
      const count = questionsPerSubject[subj] || 0;
      if (count <= 0) {
        toast.error(`Number of sorular for ${subj} must be at least 1.`);
        return;
      }
      totalSelectedQuestions += count;
    }
    if (totalSelectedQuestions > MAX_QUESTIONS) {
      toast.error(`Total questions cannot exceed ${MAX_QUESTIONS}.`);
      return;
    }
    if (!questionsPerPage || questionsPerPage <= 0) {
      toast.error('Questions per page must be at least 1.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createMockQuiz({
          userId: user.uid,
          subjects: selectedSubjects,
          chapters: selectedChapters,
          questionsPerSubject,
          questionsPerPage,
          duration,
          title
        });

        if (result.success && result.quizId) {
          toast.success("Quiz created successfully!");
          router.push(`/quiz/start-user-quiz?id=${result.quizId}`);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err: any) {
        console.error('Error creating user quiz', err);
        toast.error(err.message || 'Failed to create test. Try again later.');
      }
    });
  };

  const totalQuestions = Object.values(questionsPerSubject).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <p className="text-muted-foreground animate-pulse">Loading your workspace...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto h-screen">
        <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8">

          {/* Header */}
          <UnifiedHeader
            title="Craft Your Perfect Test"
            subtitle="Design a personalized quiz tailored to your exact learning needs. Select subjects, chapters, and difficulty to challenge yourself."
            icon={<Brain className="w-6 h-6" />}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Configuration */}
            <div className="lg:col-span-2 space-y-6">

              {/* Basic Info */}
              <Card className={`${glassmorphism.light} border-primary/10 shadow-lg`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Test Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quiz Title</label>
                    <Input
                      placeholder="e.g. Weekend Chemistry Marathon"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="h-12 bg-background/50 border-primary/20 focus:ring-primary"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Subject Selection */}
              <Card className={`${glassmorphism.light} border-primary/10 shadow-lg overflow-visible`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Select Subjects
                  </CardTitle>
                  <CardDescription>Choose at least one subject to include in your mock.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subjects.map((s) => {
                      const isSelected = selectedSubjects.includes(s);
                      const analytics = subjectAnalytics[s];
                      return (
                        <div
                          key={s}
                          onClick={() => toggleSubject(s)}
                          className={`
                                                relative p-4 rounded-xl cursor-pointer border transition-all duration-200 group
                                                ${isSelected
                              ? 'bg-primary/5 border-primary shadow-md dark:shadow-primary/10'
                              : 'bg-background hover:bg-muted border-border hover:border-primary/50'}
                                            `}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className={`font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{s}</span>
                            {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                          </div>

                          {isSelected && (
                            <div className="mt-2 pt-2 border-t border-primary/10 animate-in fade-in slide-in-from-top-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">Questions:</span>
                                <Input
                                  type="number"
                                  min={1}
                                  className="h-7 text-xs w-20 bg-background/80"
                                  value={questionsPerSubject[s] || ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setQuestionsPerSubject(prev => ({
                                      ...prev,
                                      [s]: isNaN(val) ? 0 : val
                                    }));
                                  }}
                                />
                              </div>
                              {analytics && (
                                <div className="flex gap-2 text-[10px] text-muted-foreground">
                                  <span className="text-green-600 dark:text-green-400 font-medium">{analytics.unusedQuestionsCount || 0} New</span>
                                  <span>•</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">{analytics.usedQuestionsCount || 0} Used</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Chapter Selection */}
              {selectedSubjects.length > 0 && (
                <Card className={`${glassmorphism.light} border-primary/10 shadow-lg`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-primary" />
                      Filter Chapters
                    </CardTitle>
                    <CardDescription>Refine your test by selecting specific chapters.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-2">
                      {selectedSubjects.flatMap(subject =>
                        (chaptersBySubject[subject] || []).map(chapter => {
                          const isSelected = selectedChapters.includes(chapter);
                          return (
                            <Badge
                              key={`${subject}-${chapter}`}
                              variant={isSelected ? "default" : "outline"}
                              className={`
                                                        cursor-pointer px-3 py-1.5 text-sm transition-all
                                                        ${isSelected
                                  ? 'bg-gradient-to-r from-[#004AAD] to-[#0066FF] hover:from-[#004AAD] hover:to-[#004AAD] border-transparent'
                                  : 'hover:bg-primary/5 hover:text-primary hover:border-primary/50'}
                                                    `}
                              onClick={() => toggleChapter(chapter)}
                            >
                              {chapter}
                            </Badge>
                          )
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Summary & Actions */}
            <div className="space-y-6">
              <Card className={`${glassmorphism.medium} border-primary/20 shadow-xl sticky top-6`}>
                <CardHeader className="pb-4 border-b border-primary/10">
                  <CardTitle>Test Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-background/50 border border-primary/10 text-center">
                      <p className="text-2xl font-bold text-primary">{totalQuestions}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Questions</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/50 border border-primary/10 text-center">
                      <p className="text-2xl font-bold text-primary">{selectedSubjects.length}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Subjects</p>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          Duration (min)
                        </label>
                        <span className="text-sm font-bold text-primary">{duration}</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="180"
                        step="5"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Questions / Page
                        </label>
                        <Input
                          type="number"
                          value={questionsPerPage}
                          onChange={(e) => setQuestionsPerPage(parseInt(e.target.value))}
                          className="w-20 h-8 text-right bg-background/50"
                          min={1}
                          max={totalQuestions}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/25 bg-gradient-to-r from-[#004AAD] to-[#0066FF] hover:from-[#003380] hover:to-[#004AAD] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={handleCreate}
                    disabled={isPending || totalQuestions === 0}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating your test...
                      </>
                    ) : (
                      <>
                        Start Mock Test
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>

                  {error && (
                    <div className="flex items-center gap-2 p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900/50">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <p>{error}</p>
                    </div>
                  )}

                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CreateUserQuizPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto h-full md:pt-0">
        <ComingSoon />
      </main>
    </div>
  );
}
