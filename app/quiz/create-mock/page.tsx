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
  getCountFromServer,
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
import { collectionGroup } from 'firebase/firestore';
import Link from 'next/link';
import { Lock, Info } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_QUESTIONS = 180;
const MAX_DURATION = 180;

function CreateQuizSkeleton() {
  return (
    <div className="flex min-h-screen bg-background text-foreground animate-in fade-in duration-500">
      <Sidebar />
      <main className="flex-1 overflow-auto h-screen">
        <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-primary/10">
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-12 w-full" /></CardContent>
              </Card>
              <Card className="border-primary/10">
                <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-6">
              <Card className="border-primary/10">
                <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-14 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

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
  chapterStats?: Record<string, number>; // New: Chapter Usage
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
  const [chapterTotals, setChapterTotals] = useState<Record<string, Record<string, number>>>({}); // New: Cache for chapter totals
  const [questionStats, setQuestionStats] = useState({ total: 0, used: 0 });
  const [authChecked, setAuthChecked] = useState(false);
  const [accessStatus, setAccessStatus] = useState<'loading' | 'allowed' | 'denied' | 'limit_reached'>('loading');
  const [accessMessage, setAccessMessage] = useState('');
  const [usageInfo, setUsageInfo] = useState({ count: 0, limit: 0, frequency: '' });
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', description: '', type: 'enroll' });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      console.log("[Auth] State changed:", u?.uid || "Logged Out");
      setUser(u);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  // 1. Access Control Check
  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      if (!authChecked) return;
      if (!user) {
        console.log("[AccessCheck] No user, access denied");
        setAccessStatus('denied');
        setAccessMessage("Please log in to design your own test.");
        return;
      }
      console.log("[AccessCheck] Starting for user:", user.uid);
      setAccessStatus('loading');
      try {
        const rulesSnap = await getDocs(query(collection(db, 'mock-test-access-rules'), where('isActive', '==', true)));
        const rules = rulesSnap.docs.map(d => d.data());
        if (rules.length === 0) {
          if (mounted) setAccessStatus('allowed');
          return;
        }
        const enrollSnap = await getDocs(query(
          collection(db, 'enrollments'),
          where('studentId', '==', user.uid),
          where('status', 'in', ['active', 'paid', 'enrolled'])
        ));
        const enrolledSeriesIds = enrollSnap.docs.map(d => d.data().seriesId);
        const matchingRules = rules.filter(r => enrolledSeriesIds.includes(r.seriesId));
        if (matchingRules.length === 0) {
          if (mounted) {
            setAccessStatus('denied');
            setAccessMessage("You need to enroll in a Test Series (e.g. MDCAT/NUMS) to access this feature.");
          }
          return;
        }
        const rule = matchingRules[0];
        if (mounted) setUsageInfo(prev => ({ ...prev, limit: rule.limitCount, frequency: rule.limitFrequency }));

        // Compute Period Key (Must match backend logic)
        const now = new Date();
        const year = now.getFullYear();
        let periodKey = 'lifetime';

        if (rule.limitFrequency === 'daily') {
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          periodKey = `daily-${year}-${m}-${d}`;
        } else if (rule.limitFrequency === 'weekly') {
          // ISO Week number logic
          const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
          date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
          const weekNo = Math.ceil((((date.getTime() - new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).getTime()) / 86400000) + 1) / 7);
          periodKey = `weekly-${year}-W${weekNo}`;
        } else if (rule.limitFrequency === 'monthly') {
          const m = String(now.getMonth() + 1).padStart(2, '0');
          periodKey = `monthly-${year}-${m}`;
        }

        // Read User usage from profile
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        const qUsage = userDocSnap.data()?.quizUsage || {};

        const usageCount = (qUsage.periodKey === periodKey) ? (qUsage.count || 0) : 0;

        if (mounted) setUsageInfo(prev => ({ ...prev, count: usageCount }));

        if (usageCount >= rule.limitCount) {
          if (mounted) {
            setAccessStatus('limit_reached');
            setAccessMessage(`You have reached your limit of ${rule.limitCount} tests per ${rule.limitFrequency}.`);
          }
        } else {
          console.log("[AccessCheck] Allowed. Usage:", usageCount, "/", rule.limitCount);
          if (mounted) setAccessStatus('allowed');
        }
      } catch (e) {
        console.error("[AccessCheck] Failed", e);
        if (mounted) {
          setAccessStatus('denied'); // Default to denied if check fails or no enrollment found
          setAccessMessage("Unable to verify enrollment. Only enrolled students can start tests.");
        }
      }
    };
    checkAccess();
    return () => { mounted = false; };
  }, [user, authChecked]);

  // 2. Meta Loading
  useEffect(() => {
    let mounted = true;
    const loadMeta = async () => {
      if (!authChecked) return;
      if (!user) {
        console.log("[LoadMeta] No user, stopping loading");
        setLoading(false);
        return;
      }
      console.log("[LoadMeta] Starting...");
      setLoading(true);
      try {
        let subjectsArr: string[] = [];
        let chaptersObj: Record<string, string[]> = {};
        let initialTotals: Record<string, number> = {};

        const metaDocRef = doc(db, 'mock-questions-metadata', 'config');
        const metaSnap = await getDoc(metaDocRef);

        if (metaSnap.exists()) {
          const data = metaSnap.data();
          subjectsArr = data.subjects || [];
          chaptersObj = data.chaptersBySubject || {};
          initialTotals = data.totalQuestionsBySubject || {};
        } else {
          console.warn('Metadata not found, falling back to full scan.');
          const q = query(collection(db, 'mock-questions'), limit(2000));
          const snap = await getDocs(q);
          const sSet = new Set<string>();
          const chMap: Record<string, Set<string>> = {};
          snap.docs.forEach((d) => {
            const data = d.data();
            const subject = (data.subject || 'Uncategorized').toString();
            const chapter = (data.chapter || 'Uncategorized').toString();
            sSet.add(subject);
            if (!chMap[subject]) chMap[subject] = new Set();
            chMap[subject].add(chapter);
          });
          subjectsArr = Array.from(sSet).sort();
          Object.entries(chMap).forEach(([k, v]) => {
            chaptersObj[k] = Array.from(v).sort();
          });
        }

        if (mounted) {
          setSubjects(subjectsArr);
          setChaptersBySubject(chaptersObj);

          // Initial distribution of subject analytics state
          setSubjectAnalytics(prev => {
            const next = { ...prev };
            subjectsArr.forEach(s => {
              if (!next[s]) {
                next[s] = { usedQuestions: [], totalQuestions: initialTotals[s] || 0, usedQuestionsCount: 0, unusedQuestionsCount: initialTotals[s] || 0, updatedAt: null };
              } else {
                next[s].totalQuestions = initialTotals[s] || next[s].totalQuestions || 0;
              }
            });
            return next;
          });

          // Fetch Accurate Totals (even if config exists, ensures freshness)
          const countsPromises = subjectsArr.map(async (s) => {
            try {
              const q = query(collection(db, 'mock-questions'), where('subject', '==', s), where('isDeleted', '!=', true));
              const snap = await getCountFromServer(q);
              return { subject: s, count: snap.data().count };
            } catch (e) {
              console.error(`Failed count for ${s}`, e);
              return { subject: s, count: initialTotals[s] || 0 };
            }
          });

          const results = await Promise.all(countsPromises);
          if (mounted) {
            setSubjectAnalytics(prev => {
              const next = { ...prev };
              results.forEach(({ subject, count }) => {
                if (!next[subject]) {
                  next[subject] = { usedQuestions: [], totalQuestions: 0, usedQuestionsCount: 0, unusedQuestionsCount: 0, updatedAt: null };
                }
                next[subject].totalQuestions = count;
                next[subject].unusedQuestionsCount = count - (next[subject].usedQuestionsCount || 0);
              });
              return next;
            });
          }
        }

        // Sync Global Stats
        if (user && mounted) {
          try {
            const totalSnap = await getCountFromServer(query(collection(db, 'mock-questions'), where('isDeleted', '!=', true)));
            const total = totalSnap.data().count;
            const userDocRef = doc(db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            const usedCount = userDocSnap.exists() ? (userDocSnap.data().usedMockQuestionIds?.length || 0) : 0;
            setQuestionStats({ total, used: usedCount });
          } catch (err) {
            console.error("Failed to load global question stats", err);
          }
        }
      } catch (err) {
        console.error('Failed to load mock-questions meta', err);
        setError('Failed to load subjects/chapters.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadMeta();
    return () => { mounted = false; };
  }, [user, authChecked]);

  useEffect(() => {
    if (selectedSubjects.length > 0) {
      setSelectedChapters((prev) => {
        let chapters = [...prev];
        selectedSubjects.forEach((s) => {
          const chs = chaptersBySubject[s] || [];
          if (chs.length > 0 && !chapters.some((c) => chs.includes(c))) {
            // Auto-select ALL chapters if no chapters selected for this subject yet
            if (!chapters.filter(c => chs.includes(c)).length) {
              chapters.push(...chs);
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
            const data = snap.data() as SubjectUsageDoc;
            setSubjectAnalytics(prev => {
              const current = prev[subject] || { totalQuestions: 0 };
              const usedCount = data.usedQuestionsCount || data.usedQuestions?.length || 0;
              return {
                ...prev,
                [subject]: {
                  ...data,
                  totalQuestions: current.totalQuestions || 0,
                  usedQuestionsCount: usedCount,
                  unusedQuestionsCount: (current.totalQuestions || 0) - usedCount
                }
              };
            });
          } else {
            setSubjectAnalytics(prev => ({
              ...prev,
              [subject]: { usedQuestions: [], totalQuestions: prev[subject]?.totalQuestions || 0, usedQuestionsCount: 0, unusedQuestionsCount: prev[subject]?.totalQuestions || 0, updatedAt: null }
            }));
          }
        } catch {
          setSubjectAnalytics(prev => ({
            ...prev,
            [subject]: { usedQuestions: [], totalQuestions: prev[subject]?.totalQuestions || 0, usedQuestionsCount: 0, unusedQuestionsCount: prev[subject]?.totalQuestions || 0, updatedAt: null }
          }));
        }
      }));
    };
    fetchAnalytics();
    fetchAnalytics();
  }, [subjects, user]);

  // 3. Fetch Chapter Totals (Lazy Load when Subject Selected)
  useEffect(() => {
    let mounted = true;
    const fetchChapterTotals = async () => {
      if (selectedSubjects.length === 0) return;

      // Only fetch if not already in cache
      const needed = selectedSubjects.filter(s => !chapterTotals[s]);
      if (needed.length === 0) return;

      const results: Record<string, Record<string, number>> = {};

      await Promise.all(needed.map(async (subj) => {
        const chapters = chaptersBySubject[subj] || [];
        if (chapters.length === 0) return;

        results[subj] = {};
        // Fetch Total Count for each chapter
        // We can do parallel count queries. 
        // If too many chapters (e.g. > 10), we might need to batch or accept slowness.
        // Typically ~5-10 chapters.
        await Promise.all(chapters.map(async (ch) => {
          const q = query(
            collection(db, 'mock-questions'),
            where('subject', '==', subj),
            where('chapter', '==', ch),
            where('isDeleted', '!=', true)
          );
          const snap = await getCountFromServer(q);
          results[subj][ch] = snap.data().count;
        }));
      }));

      if (mounted) {
        setChapterTotals(prev => ({ ...prev, ...results }));
      }
    };
    fetchChapterTotals();
    return () => { mounted = false; };
  }, [selectedSubjects, chaptersBySubject, chapterTotals]);

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
      toast.error('Please log in to start a test.');
      return;
    }

    // Check Access Status
    if (accessStatus === 'denied') {
      setAlertConfig({
        title: "Enrollment Required",
        description: accessMessage || "You need an active test series enrollment to create your own mocks.",
        type: 'enroll'
      });
      setShowAlert(true);
      return;
    }

    if (accessStatus === 'limit_reached') {
      setAlertConfig({
        title: "Limit Reached",
        description: accessMessage,
        type: 'limit'
      });
      setShowAlert(true);
      return;
    }

    if (accessStatus === 'loading') {
      toast.error('Verifying your permissions, please wait...');
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
    return <CreateQuizSkeleton />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto h-full">
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
                  {subjects.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {subjects.map((s) => {
                        const isSelected = selectedSubjects.includes(s);
                        const analytics = subjectAnalytics[s];
                        const total = analytics?.totalQuestions || 0;
                        const used = analytics?.usedQuestionsCount || 0;
                        const pct = Math.min(100, (used / (total || 1)) * 100);

                        return (
                          <div
                            key={s}
                            onClick={() => toggleSubject(s)}
                            className={`
                                relative overflow-hidden p-5 rounded-2xl cursor-pointer border transition-all duration-300 group
                                ${isSelected
                                ? 'bg-primary/10 border-primary ring-2 ring-primary/20 shadow-xl'
                                : 'bg-card hover:bg-accent border-border/50 hover:border-primary/40'}
                              `}
                          >
                            {/* Progress Background */}
                            {isSelected && (
                              <div
                                className="absolute bottom-0 left-0 h-1 bg-primary/20 transition-all duration-1000"
                                style={{ width: `${pct}%` }}
                              />
                            )}

                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                  <BookOpen className="w-4 h-4" />
                                </div>
                                <span className={`font-bold transition-colors ${isSelected ? 'text-primary' : 'text-foreground'}`}>{s}</span>
                              </div>
                              {isSelected ? (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in-50">
                                  <CheckCircle2 className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="h-6 w-6 rounded-full border-2 border-muted group-hover:border-primary/50 transition-colors" />
                              )}
                            </div>

                            {isSelected ? (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3 bg-background/50 p-2 rounded-lg border border-primary/10">
                                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Target Qs:</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    className="h-8 text-sm w-full bg-transparent border-0 focus-visible:ring-0 p-0 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[10px] items-center">
                                    <span className="text-muted-foreground font-medium">Topic Mastery</span>
                                    <span className="font-bold">{Math.round(pct)}% Used</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary transition-all duration-1000 ease-out"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="grid grid-cols-3 gap-1 pt-1">
                                    <div className="text-center p-1 rounded bg-muted/50">
                                      <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                                      <p className="text-xs font-bold">{total}</p>
                                    </div>
                                    <div className="text-center p-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase">New</p>
                                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{total - used}</p>
                                    </div>
                                    <div className="text-center p-1 rounded bg-amber-500/10 border border-amber-500/20">
                                      <p className="text-[9px] text-amber-600 dark:text-amber-400 uppercase">Used</p>
                                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{used}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-medium">
                                  <span>{total} Total Questions</span>
                                  <span className="flex items-center gap-1 group-hover:text-primary transition-colors">Select <ChevronRight className="w-3 h-3" /></span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 pt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                  <div className="text-center p-1 rounded bg-muted/30">
                                    <p className="text-[9px] text-muted-foreground uppercase">Total</p>
                                    <p className="text-xs font-bold text-muted-foreground">{total}</p>
                                  </div>
                                  <div className="text-center p-1 rounded bg-emerald-500/5">
                                    <p className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 uppercase">New</p>
                                    <p className="text-xs font-bold text-emerald-600/70 dark:text-emerald-400/70">{total - used}</p>
                                  </div>
                                  <div className="text-center p-1 rounded bg-amber-500/5">
                                    <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 uppercase">Used</p>
                                    <p className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70">{used}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 border-2 border-dashed border-muted rounded-3xl bg-muted/5">
                      <div className="p-4 rounded-full bg-muted text-muted-foreground">
                        <BookOpen className="w-8 h-8 opacity-20" />
                      </div>
                      <div>
                        <p className="font-bold text-muted-foreground">No subjects available</p>
                        <p className="text-sm text-muted-foreground/60">We couldn't find any questions in the bank yet.</p>
                      </div>
                    </div>
                  )}
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
                    <div className="space-y-6">
                      {selectedSubjects.map(subject => {
                        const chapters = chaptersBySubject[subject] || [];
                        if (chapters.length === 0) return null;

                        return (
                          <div key={subject} className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-px w-4 bg-primary/20" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded">
                                {subject}
                              </span>
                              <div className="h-px flex-1 bg-primary/10" />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10"
                                onClick={() => {
                                  const allInSubjectSelected = chapters.every(ch => selectedChapters.includes(ch));
                                  if (allInSubjectSelected) {
                                    setSelectedChapters(prev => prev.filter(ch => !chapters.includes(ch)));
                                  } else {
                                    setSelectedChapters(prev => [...new Set([...prev, ...chapters])]);
                                  }
                                }}
                              >
                                {chapters.every(ch => selectedChapters.includes(ch)) ? 'Deselect All' : 'Select All Chapters'}
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {chapters.map(chapter => {
                                const isSelected = selectedChapters.includes(chapter);
                                const total = chapterTotals[subject]?.[chapter] || 0;
                                // Need to cast subjectAnalytics[subject] because we extended the type but maybe state initialized without it?
                                // Actually interface update handles it.
                                const used = subjectAnalytics[subject]?.chapterStats?.[chapter] || 0;
                                const unused = total - used;

                                return (
                                  <Badge
                                    key={`${subject}-${chapter}`}
                                    variant={isSelected ? "default" : "outline"}
                                    className={`
                                      cursor-pointer px-3 py-1.5 text-xs transition-all duration-200 rounded-lg flex flex-col items-start gap-1
                                      ${isSelected
                                        ? 'bg-primary hover:bg-primary/90 shadow-md scale-[1.02]'
                                        : 'hover:bg-primary/10 hover:text-primary hover:border-primary/40'}
                                    `}
                                    onClick={() => toggleChapter(chapter)}
                                  >
                                    <span className="font-bold">{chapter}</span>
                                    {total > 0 && (
                                      <span className="text-[10px] opacity-80 font-normal">
                                        {used} Used / {unused} New
                                      </span>
                                    )}
                                  </Badge>
                                )
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Summary & Actions */}
            <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
              <Card className={`${glassmorphism.medium} border-primary/20 shadow-xl overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
                <CardHeader className="pb-4 border-b border-primary/10 bg-primary/5">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Control Center</CardTitle>
                    <Badge variant="secondary" className="animate-pulse bg-primary/20 text-primary border-primary/20 text-[10px]">
                      Ready
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6 bg-gradient-to-b from-transparent to-primary/5">

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-2xl bg-background/50 border border-primary/10 text-center shadow-inner">
                      <p className="text-3xl font-black text-primary">{totalQuestions}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Questions</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-background/50 border border-primary/10 text-center shadow-inner">
                      <p className="text-3xl font-black text-primary">{selectedSubjects.length}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Subjects</p>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="space-y-5 bg-background/40 p-4 rounded-2xl border border-primary/5">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          Duration
                        </label>
                        <Badge variant="outline" className="font-bold text-primary border-primary/20">
                          {duration} Minutes
                        </Badge>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max={MAX_DURATION}
                        step="5"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="h-px bg-primary/5 mx-2" />

                    <div className="space-y-2">
                      <div className="flex justify-between items-center group/item">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" />
                          Questions / Page
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={questionsPerPage}
                            onChange={(e) => setQuestionsPerPage(parseInt(e.target.value))}
                            className="w-20 h-9 text-right bg-background border-primary/10 focus:ring-primary font-bold pr-2 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min={1}
                            max={totalQuestions}
                          />
                          <div className="absolute right-0 top-0 h-full flex items-center pr-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                            <Info className="w-3 h-3 text-primary/50" />
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground italic px-1">How many questions per screen.</p>
                    </div>
                  </div>

                  {/* Usage Indicator */}
                  {usageInfo.limit > 0 && (
                    <div className={`p-4 rounded-2xl border ${accessStatus === 'limit_reached' ? 'bg-red-500/10 border-red-500/20' : 'bg-primary/5 border-primary/10'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-primary" /> {usageInfo.frequency} Limit
                        </span>
                        <span className={`text-xs font-black ${accessStatus === 'limit_reached' ? 'text-red-600' : 'text-primary'}`}>
                          {usageInfo.count} / {usageInfo.limit} Used
                        </span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full transition-all duration-1000 ease-out ${accessStatus === 'limit_reached' ? 'bg-red-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(100, (usageInfo.count / usageInfo.limit) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2 font-medium">
                        {accessStatus === 'limit_reached'
                          ? "Upgrade to Pro for unlimited tests."
                          : `${usageInfo.limit - usageInfo.count} tests left this ${usageInfo.frequency.replace('ly', '')}.`
                        }
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="pt-2">
                    <Button
                      className={`
                          w-full h-14 text-lg font-black rounded-2xl shadow-xl transition-all duration-300
                          ${isPending
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-primary text-primary-foreground hover:shadow-primary/30 hover:-translate-y-1 active:translate-y-0'}
                        `}
                      onClick={handleCreate}
                      disabled={isPending || totalQuestions === 0}
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                          Forging Your Test...
                        </>
                      ) : (
                        <>
                          Start Mock Test
                          <ChevronRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-3 font-medium uppercase tracking-tighter">
                      Safe & Secure Learning Environment
                    </p>
                  </div>

                  {error && (
                    <div className="flex items-center gap-3 p-4 text-xs text-red-600 bg-red-500/10 rounded-2xl border border-red-500/20 animate-in shake-1">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <p className="font-bold">{error}</p>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* Question Bank Stats Card */}
              {questionStats.total > 0 && (
                <Card className={`${glassmorphism.light} border-primary/10 shadow-lg`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      Question Bank Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-3xl font-bold text-foreground">{questionStats.total.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total Available Questions</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-emerald-600">
                          {(questionStats.total - questionStats.used).toLocaleString()} Unused
                        </span>
                      </div>
                    </div>

                    {/* Usage Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase font-semibold text-muted-foreground">
                        <span>Used</span>
                        <span>{Math.round((questionStats.used / questionStats.total) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${(questionStats.used / questionStats.total) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-right text-amber-600 mt-1">
                        {questionStats.used.toLocaleString()} questions attempted
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div >
      </main >

      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <AlertDialogTitle className="text-xl">{alertConfig.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {alertConfig.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Close</AlertDialogCancel>
            {alertConfig.type === 'enroll' && (
              <AlertDialogAction
                onClick={() => router.push('/dashboard/student/how-to-register')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Enroll Now
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}

export default CreateUserQuizPageOriginal;
