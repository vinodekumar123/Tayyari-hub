'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, addDoc, Timestamp, query, updateDoc, getDoc, doc, orderBy, where, limit, startAfter, writeBatch } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  BookOpen,
  Plus,
  Calendar,
  Clock,
  Eye,
  Search,
  Save as SaveIcon,
  X
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { brandColors, animations, glassmorphism } from '@/lib/design-tokens';
import { motion } from 'framer-motion';

function CreateQuizContent() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const params = useSearchParams();
  const quizId = params.get('id');
  const isEditMode = Boolean(quizId);

  const [questionDateFilter, setQuestionDateFilter] = useState('');
  const [seriesList, setSeriesList] = useState<any[]>([]); // New Series State
  const [questionsLimit, setQuestionsLimit] = useState(20); // Pagination limit
  const [lastQuestionDoc, setLastQuestionDoc] = useState<any>(null); // For cursor pagination
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // RBAC State
  const [userRole, setUserRole] = useState<'admin' | 'teacher' | 'student' | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Fetch User Role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role || (userData.admin ? 'admin' : 'student');
          setUserRole(role);
          if (role === 'teacher') {
            setAssignedSubjects(userData.subjects || []);
            // Auto-filter subjects if standard subjects are loaded (though they might not be yet)
          }
        }
      }
    });
    return () => unsub();
  }, []);

  const [quizConfig, setQuizConfig] = useState<any>({
    title: '',
    description: '',
    course: '',
    series: [], // New series field
    subjects: [],
    chapters: [],
    totalQuestions: 20,
    duration: 60,
    questionsPerPage: 1,
    maxAttempts: 1,
    shuffleQuestions: true,
    shuffleOptions: true,
    showExplanation: true,
    startDate: '', published: false,
    endDate: '',
    startTime: '',
    endTime: '',
    accessType: 'public',
    resultVisibility: 'immediate',
    selectedQuestions: [],
    questionFilters: {
      subjects: [],
      chapters: [],
      difficulty: '',
      searchTerm: '',
      topic: '',
      createdAfter: '', // Added for filter
    },
  });

  useEffect(() => {
    // Prefetch all required data in parallel for optimization
    const fetchAllData = async () => {
      try {
        // Courses
        const coursesSnap = await getDocs(collection(db, "courses"));
        const courseList = coursesSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCourses(courseList);

        // Initial Load: Fetch Series only. Questions are fetched based on selection via useEffect.
        const seriesSnap = await getDocs(collection(db, 'series'));
        setSeriesList(seriesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // When in edit mode, fetch quiz details
        if (quizId) {
          const docRef = doc(db, 'quizzes', quizId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setQuizConfig((prev) => ({
              ...prev,
              ...data,
              course: data.course?.name || '',
              subjects: Array.isArray(data.subjects)
                ? data.subjects.map(s => s.name || s).filter(name => name)
                : data.subject?.name
                  ? [data.subject.name]
                  : [],
              series: data.series || [], // Load series
              chapters: Array.isArray(data.chapters)
                ? data.chapters.map(c => c.name || c).filter(name => name)
                : data.chapter?.name
                  ? [data.chapter.name]
                  : [],
              selectedQuestions: Array.isArray(data.selectedQuestions) ? data.selectedQuestions : [],
            }));
          } else {
            alert("Could not load quiz for editing.");
          }
        }
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
      }
    };
    fetchAllData();
    // eslint-disable-next-line
  }, [quizId]);

  // Available question state
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);

  // We need a ref to access current filters inside the async function without stale closures 
  // if we were using useCallback, but here we can just read state if we include it in deps or call explicitly.

  const fetchMoreQuestions = async (reset = false) => {
    if (loadingQuestions) return;
    setLoadingQuestions(true);
    try {
      let q;
      const constraints: any[] = [];
      const { subjects, chapters, difficulty, topic } = quizConfig.questionFilters;

      // Apply Filters
      // Subject Filter (Array)
      if (subjects.length > 0 && !subjects.includes('all-subjects')) {
        // Explicit selection
        constraints.push(where('subject', 'in', subjects.slice(0, 10)));
      } else if (userRole === 'teacher') {
        // Teacher implied filter: If "All Subjects" (or empty) is selected, restrict to assignedSubjects
        if (assignedSubjects.length > 0) {
          constraints.push(where('subject', 'in', assignedSubjects.slice(0, 10)));
        } else {
          // Teacher with no subjects? Should find nothing.
          constraints.push(where('subject', '==', '__NO_SUBJECTS__'));
        }
      }

      // Chapter Filter (Array) 
      // Note: Can't have multiple 'in' queries or 'array-contains-any' usually. 
      // If Subject is filtered, usually we filter by that. Chapter is secondary.
      // If we used 'in' for subject, we can't use 'in' for chapter.
      // Strategy: Client-filter chapters if Subject 'in' is used, OR if only 1 subject, use '=='.
      if (chapters.length > 0 && !chapters.includes('all-chapters')) {
        if (subjects.length === 1 && !subjects.includes('all-subjects')) {
          // If single subject, we can use 'in' for chapters
          constraints.push(where('chapter', 'in', chapters.slice(0, 10)));
        } else {
          // If multiple subjects or all-subjects, we might hit limits. 
          // Let's rely on client-side filtering for chapters after fetching by subject?
          // Or better: Don't filter by chapter in query if multiple subjects.
          // Wait, previous logic was pure client side.
          // Let's try to add if no other 'in' clause conflicts.
        }
      }

      if (difficulty && difficulty !== '__all-difficulties__') {
        constraints.push(where('difficulty', '==', difficulty));
      }
      if (topic && topic !== '__all-topics__') {
        constraints.push(where('topic', '==', topic));
      }

      // Ordering
      // Ensure we have index for fields involved in equality + Sort.
      // Default sort
      const sortConstraint = orderBy("createdAt", "desc");

      if (reset) {
        if (constraints.length > 0) {
          q = query(collection(db, "questions"), ...constraints, sortConstraint, limit(20));
        } else {
          q = query(collection(db, "questions"), sortConstraint, limit(20));
        }
      } else {
        if (lastQuestionDoc) {
          if (constraints.length > 0) {
            q = query(collection(db, "questions"), ...constraints, sortConstraint, startAfter(lastQuestionDoc), limit(20));
          } else {
            q = query(collection(db, "questions"), sortConstraint, startAfter(lastQuestionDoc), limit(20));
          }
        } else {
          // Should not happen if not reset, but safe fallback
          if (constraints.length > 0) {
            q = query(collection(db, "questions"), ...constraints, sortConstraint, limit(20));
          } else {
            q = query(collection(db, "questions"), sortConstraint, limit(20));
          }
        }
      }

      const snapshot = await getDocs(q);
      const newQuestions = snapshot.docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
          usedInQuizzes: data.usedInQuizzes || 0,
        };
      });

      if (reset) {
        setAvailableQuestions(newQuestions);
      } else {
        setAvailableQuestions(prev => [...prev, ...newQuestions]);
      }

      setLastQuestionDoc(snapshot.docs[snapshot.docs.length - 1]);
    } catch (error) {
      console.error("Error fetching questions:", error);
      // Fallback: If index error, maybe alert user or fallback to basic?
      // For now log it.
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Refetch questions when filters change (Server-Side Filtering Trigger)
  useEffect(() => {
    setLastQuestionDoc(null);
    fetchMoreQuestions(true);
    // eslint-disable-next-line
  }, [
    quizConfig.questionFilters.subjects,
    quizConfig.questionFilters.chapters,
    quizConfig.questionFilters.difficulty,
    quizConfig.questionFilters.topic
  ]);

  // Subjects by course
  useEffect(() => {
    const fetchSubjectsByCourse = async () => {
      const selectedCourse = courses.find(c => c.name === quizConfig.course);
      if (!selectedCourse || !selectedCourse.subjectIds) {
        setSubjects([]);
        return;
      }

      const subjectList = [];
      await Promise.all(selectedCourse.subjectIds.map(async subjectId => {
        const subjectRef = doc(db, 'subjects', subjectId);
        const subjectSnap = await getDoc(subjectRef);
        if (subjectSnap.exists()) {
          subjectList.push({ id: subjectId, name: subjectSnap.data().name });
        }
      }));
      setSubjects(subjectList);
    };

    if (quizConfig.course) fetchSubjectsByCourse();
    // eslint-disable-next-line
  }, [quizConfig.course, courses, isEditMode]);

  // Chapters by subjects
  useEffect(() => {
    const fetchChapters = async () => {
      let allChapters = new Set();
      if (quizConfig.subjects.includes('all-subjects') || quizConfig.subjects.length === 0) {
        await Promise.all(subjects.map(async (s) => {
          const subjectRef = doc(db, 'subjects', s.id);
          const subjectSnap = await getDoc(subjectRef);
          if (subjectSnap.exists()) {
            const data = subjectSnap.data();
            const chaptersList = data.chapters ? Object.keys(data.chapters).filter(ch => ch && ch.trim() !== '') : [];
            chaptersList.forEach((ch) => allChapters.add(ch));
          }
        }));
      } else {
        await Promise.all(quizConfig.subjects.map(async (subjectName) => {
          const subject = subjects.find(s => s.name === subjectName);
          if (subject) {
            const subjectRef = doc(db, 'subjects', subject.id);
            const subjectSnap = await getDoc(subjectRef);
            if (subjectSnap.exists()) {
              const data = subjectSnap.data();
              const chaptersList = data.chapters ? Object.keys(data.chapters).filter(ch => ch && ch.trim() !== '') : [];
              chaptersList.forEach((ch) => allChapters.add(ch));
            }
          }
        }));
      }
      setChapters(Array.from(allChapters) as string[]);
    };
    fetchChapters();
    // eslint-disable-next-line
  }, [quizConfig.subjects, subjects]);

  // Handlers
  const handleInputChange = (field: string, value: any) => {
    setQuizConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMultiSelectChange = (field: string, value: any) => {
    setQuizConfig(prev => ({
      ...prev,
      [field]: Array.isArray(value) ? value : [value],
      ...(field === 'subjects' ? { chapters: [] } : {}),
    }));
  };

  const handleQuestionFilterChange = (field: string, value: any) => {
    setQuizConfig(prev => ({
      ...prev,
      questionFilters: {
        ...prev.questionFilters,
        [field]: Array.isArray(value) ? value : [value],
        ...(field === 'subjects' ? { chapters: [] } : {}),
      },
    }));
  };

  // Question selection (with bigger radios)
  const handleQuestionSelection = (question: any) => {
    setQuizConfig((prev) => {
      const isSelected = prev.selectedQuestions.some(q => q.id === question.id);
      const updatedQuestions = isSelected
        ? prev.selectedQuestions.filter(q => q.id !== question.id)
        : [...prev.selectedQuestions, question];

      return {
        ...prev,
        selectedQuestions: updatedQuestions,
      };
    });
  };

  // Auto select logic: select the latest added questions (top N recent)
  const handleAutoSelectQuestions = () => {
    if (quizConfig.selectedQuestions.length > 0) {
      setQuizConfig((prev) => ({
        ...prev,
        selectedQuestions: [],
      }));
      return;
    }

    // Filter by date if applied
    let filtered: any[] = availableQuestions;
    if (quizConfig.questionFilters.createdAfter) {
      const afterDate = new Date(quizConfig.questionFilters.createdAfter).getTime();
      filtered = filtered.filter(q => {
        if (!q.createdAt) return false;
        let questionDate;
        if (q.createdAt.seconds) {
          questionDate = q.createdAt.seconds * 1000;
        } else {
          // In case createdAt is a JS Date
          questionDate = new Date(q.createdAt).getTime();
        }
        return questionDate >= afterDate;
      });
    }

    // Select top N recent (already sorted by createdAt desc)
    const selected = filtered.slice(0, Math.min(quizConfig.totalQuestions, filtered.length));
    setQuizConfig((prev) => ({
      ...prev,
      selectedQuestions: selected,
    }));
  };

  const handleCreateOrUpdateQuiz = async () => {
    // Specific Validation Checks
    if (!quizConfig.title) {
      alert("Please enter a Quiz Title.");
      return;
    }
    if (!quizConfig.course) {
      alert("Please select a Course.");
      return;
    }
    if (quizConfig.subjects.length === 0 && !quizConfig.subjects.includes('all-subjects')) {
      alert("Please select at least one Subject.");
      return;
    }
    if (quizConfig.accessType === 'series' && (!quizConfig.series || quizConfig.series.length === 0)) {
      alert("For 'Series Exclusive' access, you must select at least one Series.");
      return;
    }
    if (quizConfig.selectedQuestions.length === 0) {
      alert("Please select at least one question for the quiz.");
      return;
    }

    const selectedCourse = courses.find(c => c.name === quizConfig.course);
    const selectedSubjects = quizConfig.subjects.includes('all-subjects')
      ? subjects
      : subjects.filter(s => quizConfig.subjects.includes(s.name));

    const quizPayload = {
      ...quizConfig,
      course: {
        id: selectedCourse?.id || '',
        name: selectedCourse?.name || '',
      },
      subjects: selectedSubjects.map(s => ({
        id: s.id,
        name: s.name,
      })),
      chapters: quizConfig.chapters.includes('all-chapters')
        ? chapters.map(ch => ({ id: ch, name: ch }))
        : quizConfig.chapters.map(ch => ({ id: ch, name: ch })),
      series: quizConfig.series || [], // Save series
      updatedAt: Timestamp.now(),
      published: quizConfig.published || false,
    };

    if (!isEditMode) {
      quizPayload.createdAt = Timestamp.now();
      quizPayload.createdBy = currentUserId; // Track creator
      quizPayload.teacherId = userRole === 'teacher' ? currentUserId : null; // Track teacher ownership specifically
      quizPayload.creatorRole = userRole;
    }

    try {
      const { updateQuestionUsage } = await import('../../../lib/analytics');
      const currentIds = quizConfig.selectedQuestions.map(q => q.id);
      let previousIds = [];

      if (isEditMode) {
        const quizRef = doc(db, 'quizzes', quizId);
        const oldSnap = await getDoc(quizRef);
        if (oldSnap.exists()) {
          previousIds = (oldSnap.data().selectedQuestions || []).map(q => q.id);
        }
        await updateDoc(quizRef, quizPayload);
        alert("Quiz updated successfully!");
      } else {
        await addDoc(collection(db, "quizzes"), quizPayload);
        alert("Quiz created successfully!");
      }

      // Perform usage tracking update
      await updateQuestionUsage(currentIds, previousIds);

      router.push("/dashboard/admin");
    } catch (error) {
      console.error("Error saving quiz:", error);
      alert("Failed to save quiz.");
    }
  };

  const handleSaveToMockQuestions = async () => {
    try {
      if (quizConfig.selectedQuestions.length === 0) {
        alert("No questions selected.");
        return;
      }

      setLoadingQuestions(true); // Re-use loading state or add a new one? Re-using is fine or we can just block interaction.

      const selectedQuestions = quizConfig.selectedQuestions;
      const batchSize = 10; // Check/Save in small chunks to avoid limits
      let addedCount = 0;

      for (let i = 0; i < selectedQuestions.length; i += batchSize) {
        const chunk = selectedQuestions.slice(i, i + batchSize);
        const chunkIds = chunk.map(q => q.id);

        // Check which ones already exist in mock-questions
        // Note: We are assuming ID parity. If mock-questions generates NEW IDs, this check is invalid. 
        // But usually we preserve ID or check by some other key. The original code checked by `doc.id`.
        // Let's assume we want to preserve IDs or check if a doc with this ID exists.

        // Actually, the original code looked at `existingQuestions` and checked `existingIds.has(question.id)`.
        // This implies we expect `mock-questions` docs to have the SAME ID as `questions` docs?
        // If so, we should check `doc(db, 'mock-questions', id)`.

        // Let's optimize: Check specific Docs presence.
        const chunkChecks = await Promise.all(
          chunk.map(q => getDoc(doc(db, 'mock-questions', q.id)))
        );

        const newBatch = writeBatch(db);
        let hasUpdates = false;

        chunk.forEach((q, idx) => {
          const exists = chunkChecks[idx].exists();
          if (!exists) {
            // Use setDoc to preserve the ID, ensuring future checks work
            newBatch.set(doc(db, "mock-questions", q.id), {
              ...q,
              createdAt: Timestamp.now(),
              usedInQuizzes: 0 // Reset usage for the mock bank context
            });
            hasUpdates = true;
            addedCount++;
          }
        });

        if (hasUpdates) {
          await newBatch.commit();
        }
      }

      alert(`Process Complete. ${addedCount} new questions saved to Mock Bank.`);
    } catch (error) {
      console.error("Error saving to mock-questions:", error);
      alert("Failed to save questions to Mock Questions.");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper to show counts
  const countQuestionsFor = ({ course, subject, chapter }: { course?: string, subject?: string, chapter?: string }) => {
    let filtered: any[] = availableQuestions;
    if (course) {
      filtered = filtered.filter(q => q.course === course);
    }
    if (subject) {
      filtered = filtered.filter(q => q.subject === subject);
    }
    if (chapter) {
      filtered = filtered.filter(q => q.chapter === chapter);
    }
    if (quizConfig.questionFilters.createdAfter) {
      const afterDate = new Date(quizConfig.questionFilters.createdAfter).getTime();
      filtered = filtered.filter(q => {
        if (!q.createdAt) return false;
        let questionDate;
        if (q.createdAt.seconds) {
          questionDate = q.createdAt.seconds * 1000;
        } else {
          questionDate = new Date(q.createdAt).getTime();
        }
        return questionDate >= afterDate;
      });
    }
    return filtered.length;
  };

  // Filtered questions with date filter applied
  const filteredQuestions = availableQuestions.filter((q) => {
    const { subjects, chapters, difficulty, topic, searchTerm, createdAfter } = quizConfig.questionFilters;
    const cleanQuestionText = q.questionText ? q.questionText.replace(/<[^>]+>/g, '') : '';
    const matchesSubject = subjects.length === 0 || subjects.includes('all-subjects') || subjects.includes(q.subject);
    const matchesChapter = chapters.length === 0 || chapters.includes('all-chapters') || chapters.includes(q.chapter);
    const matchesDifficulty = !difficulty || difficulty === '__all-difficulties__' || q.difficulty === difficulty;
    const matchesTopic = !topic || topic === '__all-topics__' || q.topic === topic;
    const matchesSearch = !searchTerm || cleanQuestionText.toLowerCase().includes(searchTerm.toLowerCase());

    // Date filter
    let matchesDate = true;
    if (createdAfter) {
      const afterDate = new Date(createdAfter).getTime();
      let questionDate;
      if (q.createdAt && q.createdAt.seconds !== undefined) {
        questionDate = q.createdAt.seconds * 1000;
      } else if (q.createdAt) {
        questionDate = new Date(q.createdAt).getTime();
      } else {
        matchesDate = false;
      }
      matchesDate = questionDate >= afterDate;
    }

    return matchesSubject && matchesChapter && matchesDifficulty && matchesTopic && matchesSearch && matchesDate;
  });

  const groupedQuestions = filteredQuestions.reduce((acc, question) => {
    const subject = question.subject || 'Uncategorized';
    if (!acc[subject]) {
      acc[subject] = [];
    }
    acc[subject].push(question);
    return acc;
  }, {} as Record<string, any[]>);

  const MultiSelect = ({ value, onChange, options, placeholder, disabled, type }) => {
    const displayValue = value.includes('all-subjects') || value.includes('all-chapters')
      ? value.includes('all-subjects') ? 'All Subjects' : 'All Chapters'
      : value.length > 0
        ? `${value.length} selected`
        : placeholder;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl text-left font-normal"
            disabled={disabled}
          >
            <span className="truncate">{displayValue}</span>
            <span className="opacity-50">▼</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className={`${glassmorphism.light} w-[300px] p-2 border-white/20 dark:border-white/10 max-h-[300px] overflow-y-auto custom-scrollbar`}>
          <div className="space-y-1">
            {options.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                onClick={() => {
                  const isSelected = value.includes(option.value);
                  if (isSelected) {
                    onChange(value.filter(v => v !== option.value));
                  } else {
                    if (option.value === 'all-subjects' || option.value === 'all-chapters') {
                      onChange([option.value]);
                    } else {
                      onChange([...value.filter(v => v !== 'all-subjects' && v !== 'all-chapters'), option.value]);
                    }
                  }
                }}
              >
                <Checkbox
                  checked={value.includes(option.value)}
                  className="border-gray-400 dark:border-gray-500"
                />
                <span className="flex-1 text-sm">{option.label}</span>
                {!!type && (
                  <Badge variant="secondary" className="bg-black/5 dark:bg-white/10 text-xs text-muted-foreground">
                    {type === 'course' && countQuestionsFor({ course: option.value })}
                    {type === 'subject' && countQuestionsFor({ subject: option.value })}
                    {type === 'chapter' && countQuestionsFor({ chapter: option.value })}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background">
      <header className={`${glassmorphism.light} sticky top-0 z-50 border-b border-white/20 dark:border-white/10`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                {isEditMode ? 'Edit Quiz' : 'Create New Quiz'}
              </h1>
              <p className="text-xs text-muted-foreground font-medium">
                {isEditMode ? 'Modify existing quiz details' : 'Set up a new assessment'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
              Cancel
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="basic" className="space-y-8">
          <TabsList className={`${glassmorphism.medium} p-1 rounded-2xl border border-white/20 dark:border-white/10 w-full grid grid-cols-4 lg:w-[600px] mx-auto`}>
            <TabsTrigger value="basic" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white transition-all duration-300">Basic Info</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white transition-all duration-300">Settings</TabsTrigger>
            <TabsTrigger value="questions" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white transition-all duration-300">Questions</TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white transition-all duration-300">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-8 focus-visible:outline-none">
            <Card className={`${glassmorphism.light} border-white/20 dark:border-white/10 shadow-xl`}>
              <CardHeader className="border-b border-white/10 pb-6">
                <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                  Basic Information
                </CardTitle>
                <p className="text-sm text-muted-foreground">Define the core details of your quiz.</p>
              </CardHeader>
              <CardContent className="space-y-8 pt-8">
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="title" className="text-base font-semibold">Quiz Title <span className="text-red-500">*</span></Label>
                    <Input
                      id="title"
                      placeholder="e.g. Advanced Physics Mechanics Final"
                      value={quizConfig.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      className="h-12 text-lg bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="description" className="text-base font-semibold">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Briefly describe what this quiz covers..."
                      value={quizConfig.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={4}
                      className="resize-none bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="course" className="text-base font-semibold">Course <span className="text-red-500">*</span></Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                        >
                          <span className={!quizConfig.course ? 'text-muted-foreground' : ''}>
                            {quizConfig.course || 'Select course'}
                          </span>
                          <span className="opacity-50">▼</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-2" align="start">
                        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                          {courses.map(course => (
                            <div
                              key={course.name}
                              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${quizConfig.course === course.name
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                : 'hover:bg-accent'
                                }`}
                              onClick={() => {
                                handleInputChange('course', course.name);
                                handleMultiSelectChange('subjects', []);
                                handleMultiSelectChange('chapters', []);
                              }}
                            >
                              <span className="font-medium">{course.name}</span>
                              <Badge variant="secondary" className="bg-white/50 dark:bg-black/20 ml-2">
                                {countQuestionsFor({ course: course.name })}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="subjects" className="text-base font-semibold">Subjects <span className="text-red-500">*</span></Label>
                    <MultiSelect
                      value={quizConfig.subjects}
                      onChange={(value) => handleMultiSelectChange('subjects', value)}
                      options={[
                        { value: 'all-subjects', label: 'All Subjects' },
                        ...subjects
                          .filter(s => s && s.name && s.name.trim() !== '')
                          // TEACHER FILTER: Only show assigned subjects
                          .filter(s => userRole !== 'teacher' || assignedSubjects.includes(s.name))
                          .map(s => ({ value: s.name, label: s.name }))
                      ]}
                      placeholder="Select subjects"
                      disabled={!quizConfig.course}
                      type="subject"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="chapters" className="text-base font-semibold">Chapters</Label>
                    <MultiSelect
                      value={quizConfig.chapters}
                      onChange={(value) => handleMultiSelectChange('chapters', value)}
                      options={[{ value: 'all-chapters', label: 'All Chapters' }, ...chapters.filter(ch => ch && ch.trim() !== '').map(ch => ({ value: ch, label: ch }))]}
                      placeholder="Select chapters"
                      disabled={!quizConfig.subjects.length}
                      type="chapter"
                    />
                  </div>

                  {/* Series moved to Settings based on Access Type */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-8 focus-visible:outline-none">
            <Card className={`${glassmorphism.light} border-white/20 dark:border-white/10 shadow-xl`}>
              <CardHeader className="border-b border-white/10 pb-6">
                <CardTitle className="text-2xl font-bold">Quiz Configuration</CardTitle>
                <p className="text-sm text-muted-foreground">Customize how the quiz behaves.</p>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="totalQuestions" className="text-base font-semibold">Total Questions</Label>
                    <Input
                      id="totalQuestions"
                      type="number"
                      min="1"
                      max="200"
                      value={quizConfig.totalQuestions}
                      onChange={(e) => handleInputChange('totalQuestions', parseInt(e.target.value))}
                      className="bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="questionsPerPage" className="text-base font-semibold">Questions / Page</Label>
                    <Input
                      id="questionsPerPage"
                      type="number"
                      min="1"
                      max={quizConfig.totalQuestions}
                      value={quizConfig.questionsPerPage}
                      onChange={(e) => handleInputChange('questionsPerPage', parseInt(e.target.value))}
                      className="bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="duration" className="text-base font-semibold">Duration (min)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="5"
                      max="300"
                      value={quizConfig.duration}
                      onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                      className="bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="maxAttempts" className="text-base font-semibold">Max Attempts</Label>
                    <Input
                      id="maxAttempts"
                      type="number"
                      min="1"
                      max="10"
                      value={quizConfig.maxAttempts}
                      onChange={(e) => handleInputChange('maxAttempts', parseInt(e.target.value))}
                      className="bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-white/30 dark:bg-black/20 rounded-xl border border-white/10">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="shuffleQuestions"
                      checked={quizConfig.shuffleQuestions}
                      onCheckedChange={(checked) => handleInputChange('shuffleQuestions', checked)}
                      className="h-5 w-5 data-[state=checked]:bg-blue-600 border-gray-400 dark:border-gray-500"
                    />
                    <Label htmlFor="shuffleQuestions" className="text-base cursor-pointer">Shuffle Questions</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="shuffleOptions"
                      checked={quizConfig.shuffleOptions}
                      onCheckedChange={(checked) => handleInputChange('shuffleOptions', checked)}
                      className="h-5 w-5 data-[state=checked]:bg-blue-600 border-gray-400 dark:border-gray-500"
                    />
                    <Label htmlFor="shuffleOptions" className="text-base cursor-pointer">Shuffle Options</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="showExplanation"
                      checked={quizConfig.showExplanation}
                      onCheckedChange={(checked) => handleInputChange('showExplanation', checked)}
                      className="h-5 w-5 data-[state=checked]:bg-blue-600 border-gray-400 dark:border-gray-500"
                    />
                    <Label htmlFor="showExplanation" className="text-base cursor-pointer">Show Explanations</Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="accessType" className="text-base font-semibold">Access Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {['public', 'series'].map(type => (
                        <div
                          key={type}
                          onClick={() => handleInputChange('accessType', type)}
                          className={`cursor-pointer text-center py-3 px-4 rounded-xl border transition-all ${quizConfig.accessType === type
                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                            : 'bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 hover:bg-white/70'
                            }`}
                        >
                          {type === 'public' ? 'Public' : 'Series Exclusive'}
                        </div>
                      ))}
                    </div>
                  </div>

                  {quizConfig.accessType === 'series' && (
                    <div className="space-y-3 md:col-span-2">
                      <Label htmlFor="series" className="text-base font-semibold">Select Series <span className="text-red-500">*</span></Label>
                      <MultiSelect
                        value={quizConfig.series || []}
                        onChange={(value) => handleMultiSelectChange('series', value)}
                        options={seriesList.map(s => ({ value: s.id, label: s.name }))}
                        placeholder="Select Series (Required)"
                        disabled={false}
                        type=""
                      />
                    </div>
                  )}
                  <div className="space-y-3">
                    <Label htmlFor="resultVisibility" className="text-base font-semibold">Result Visibility</Label>
                    <Select value={quizConfig.resultVisibility} onValueChange={(v) => handleInputChange('resultVisibility', v)}>
                      <SelectTrigger className="w-full h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="manual">Manual Release</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-8 focus-visible:outline-none">
            <Card className={`${glassmorphism.light} border-white/20 dark:border-white/10 shadow-xl`}>
              <CardHeader className="border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-2xl font-semibold text-gray-900">Question Selection</CardTitle>
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      className="border-gray-300 hover:bg-gray-100 transition-all duration-200"
                      onClick={handleAutoSelectQuestions}
                    >
                      <Plus className="h-5 w-5 mr-2" /> Auto Select ({quizConfig.totalQuestions})
                    </Button>
                    <Badge
                      variant="secondary"
                      className="bg-gray-200 hover:bg-gray-300 transition-all duration-200 cursor-pointer"
                      onClick={handleAutoSelectQuestions}
                    >
                      {quizConfig.selectedQuestions.length > 0 ? 'Clear Selection' : `Auto (${quizConfig.totalQuestions})`}
                    </Badge>
                    <Button
                      variant="secondary"
                      className="bg-green-600 hover:bg-green-700 text-white transition-all duration-200"
                      onClick={handleSaveToMockQuestions}
                    >
                      <SaveIcon className="h-5 w-5 mr-2" /> Save to Mock Questions
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="space-y-2">
                      <Label className="text-lg font-medium text-gray-700">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="Search questions..."
                          value={quizConfig.questionFilters.searchTerm}
                          onChange={(e) =>
                            setQuizConfig((prev) => ({
                              ...prev,
                              questionFilters: {
                                ...prev.questionFilters,
                                searchTerm: e.target.value,
                              },
                            }))
                          }
                          className="pl-12 pr-4 py-2 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg font-medium text-gray-700">Subjects</Label>
                      <MultiSelect
                        value={quizConfig.questionFilters.subjects}
                        onChange={(value) => handleQuestionFilterChange('subjects', value)}
                        options={[{ value: 'all-subjects', label: 'All Subjects' }, ...subjects.map(s => ({ value: s.name, label: s.name }))]}
                        placeholder="All subjects"
                        type="subject"
                        disabled={false}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg font-medium text-gray-700">Chapters</Label>
                      <MultiSelect
                        value={quizConfig.questionFilters.chapters}
                        onChange={(value) => handleQuestionFilterChange('chapters', value)}
                        options={[{ value: 'all-chapters', label: 'All Chapters' }, ...chapters.map(ch => ({ value: ch, label: ch }))]}
                        placeholder="All chapters"
                        type="chapter"
                        disabled={false}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg font-medium text-gray-700">Difficulty</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between border-gray-300 focus:border-blue-500 rounded-xl"
                          >
                            <span>{quizConfig.questionFilters.difficulty || 'All difficulties'}</span>
                            <span>▼</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full">
                          <div className="space-y-2">
                            {['__all-difficulties__', 'Easy', 'Medium', 'Hard'].map(difficulty => (
                              <div
                                key={difficulty}
                                className="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded"
                                onClick={() => setQuizConfig(prev => ({
                                  ...prev,
                                  questionFilters: {
                                    ...prev.questionFilters,
                                    difficulty,
                                  },
                                }))}
                              >
                                {difficulty === '__all-difficulties__' ? 'All difficulties' : difficulty}
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg font-medium text-gray-700">Topic</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between border-gray-300 focus:border-blue-500 rounded-xl"
                          >
                            <span>{quizConfig.questionFilters.topic || 'All topics'}</span>
                            <span>▼</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full">
                          <div className="space-y-2">
                            {['__all-topics__', ...new Set(availableQuestions.map(q => q.topic).filter(t => t && t.trim() !== ''))].map(topic => (
                              <div
                                key={topic}
                                className="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded"
                                onClick={() => setQuizConfig(prev => ({
                                  ...prev,
                                  questionFilters: {
                                    ...prev.questionFilters,
                                    topic,
                                  },
                                }))}
                              >
                                {topic === '__all-topics__' ? 'All topics' : topic}
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg font-medium text-gray-700">Created After</Label>
                      <Input
                        type="date"
                        value={quizConfig.questionFilters.createdAfter}
                        onChange={(e) => setQuizConfig((prev) => ({
                          ...prev,
                          questionFilters: {
                            ...prev.questionFilters,
                            createdAfter: e.target.value
                          }
                        }))}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                      <div className="text-xs text-gray-500">
                        {filteredQuestions.length} questions found
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-8">
                  {Object.entries(groupedQuestions).map(([subject, rawQuestions]) => {
                    const questions = rawQuestions as any[];
                    return (
                      <div key={subject} className="space-y-4">
                        <div className="border-b border-white/10 pb-2 flex items-center">
                          <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{subject}</h3>
                          <Badge variant="secondary" className="ml-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{questions.length}</Badge>
                        </div>
                        {questions.map((question) => {
                          const isSelected = quizConfig.selectedQuestions.some((q) => q.id === question.id);
                          return (
                            <div
                              key={question.id}
                              className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer ${isSelected
                                ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                                : 'bg-white/40 dark:bg-black/20 border-white/10 hover:border-blue-500/30 hover:bg-white/60 dark:hover:bg-white/5'
                                }`}
                              onClick={() => handleQuestionSelection(question)}
                            >
                              <div className="flex items-start gap-4">
                                <Checkbox
                                  checked={isSelected}
                                  className={`mt-1 h-5 w-5 rounded-md border-2 ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-400 dark:border-gray-500'}`}
                                />
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-start justify-between gap-4">
                                    <div
                                      className="font-medium text-foreground text-base line-clamp-2"
                                      dangerouslySetInnerHTML={{ __html: question.questionText || 'Untitled Question' }}
                                    />
                                    <div className="flex flex-col gap-2 shrink-0">
                                      {question.accessType === 'paid' ? (
                                        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0">Premium</Badge>
                                      ) : question.seriesId ? (
                                        <Badge variant="outline" className="border-purple-500 text-purple-600 dark:text-purple-400">Series</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Free</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center flex-wrap gap-2 text-sm">
                                    <Badge variant="outline" className="bg-white/30 dark:bg-black/20 border-white/20">
                                      {question.chapter || 'No Chapter'}
                                    </Badge>
                                    <Badge className={getDifficultyColor(question.difficulty ?? 'Easy')}>
                                      {question.difficulty ?? 'Easy'}
                                    </Badge>
                                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                                      <Eye className="w-3 h-3" />
                                      Used in {question.usedInQuizzes || 0} quizzes
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* Load More Button */}
                  <div className="flex justify-center pt-8">
                    <Button
                      variant="outline"
                      onClick={() => fetchMoreQuestions()}
                      className="w-full md:w-auto min-w-[200px] h-12 bg-white/10 dark:bg-white/5 hover:bg-white/20 border-white/10 backdrop-blur-md"
                      disabled={loadingQuestions}
                    >
                      {loadingQuestions ? (
                        <span className="flex items-center"><span className="animate-spin mr-2">⏳</span> Loading...</span>
                      ) : 'Load More Questions'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-8 focus-visible:outline-none">
            <Card className={`${glassmorphism.light} border-white/20 dark:border-white/10 shadow-xl`}>
              <CardHeader className="border-b border-white/10 pb-6">
                <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                  Schedule Quiz
                </CardTitle>
                <p className="text-sm text-muted-foreground">Set timing and publication status.</p>
              </CardHeader>
              <CardContent className="space-y-6 pt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="startDate" className="text-base font-semibold">Start Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="startDate"
                        type="date"
                        value={quizConfig.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="pl-12 h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="endDate" className="text-base font-semibold">End Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="endDate"
                        type="date"
                        value={quizConfig.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className="pl-12 h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="startTime" className="text-base font-semibold">Start Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="startTime"
                        type="time"
                        value={quizConfig.startTime}
                        onChange={(e) => handleInputChange('startTime', e.target.value)}
                        className="pl-12 h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="endTime" className="text-base font-semibold">End Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="endTime"
                        type="time"
                        value={quizConfig.endTime}
                        onChange={(e) => handleInputChange('endTime', e.target.value)}
                        className="pl-12 h-12 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 pt-4">
                    <Checkbox
                      id="published"
                      checked={quizConfig.published}
                      onCheckedChange={(checked) => handleInputChange('published', checked)}
                      className="h-5 w-5 data-[state=checked]:bg-blue-600 border-gray-400 dark:border-gray-500"
                    />
                    <Label htmlFor="published" className="text-base font-medium cursor-pointer">Publish Quiz</Label>
                  </div>
                </div>

                <div className="bg-white/40 dark:bg-black/40 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                  <h4 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-blue-500 rounded-full inline-block"></span>
                    Quiz Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-3">
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Title</span>
                        <span className="font-semibold text-right">{quizConfig.title || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Course</span>
                        <span className="font-semibold text-right">{quizConfig.course || 'Not selected'}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Subjects</span>
                        <span className="font-semibold text-right truncate max-w-[200px]">{Array.isArray(quizConfig.subjects) ? (quizConfig.subjects.includes('all-subjects') ? 'All Subjects' : quizConfig.subjects.join(', ') || 'Not selected') : 'Not selected'}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Series</span>
                        <span className="font-semibold text-right truncate max-w-[200px]">
                          {Array.isArray(quizConfig.series) && quizConfig.series.length > 0
                            ? `${quizConfig.series.length} series selected`
                            : 'None'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Question Count</span>
                        <span className="font-semibold text-right">{quizConfig.selectedQuestions.length} / {quizConfig.totalQuestions}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-semibold text-right">{quizConfig.duration} minutes</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Access Type</span>
                        <span className="font-semibold text-right capitalize">{quizConfig.accessType}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Result Visibility</span>
                        <span className="font-semibold text-right capitalize">{quizConfig.resultVisibility}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Shuffle</span>
                        <span className="font-semibold text-right">{quizConfig.shuffleQuestions ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={quizConfig.published ? "default" : "secondary"}>
                          {quizConfig.published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-4">
                  <Button
                    variant="outline"
                    className="h-12 px-6 border-white/20 dark:border-white/10 hover:bg-white/10 dark:hover:bg-white/5"
                    onClick={() => router.back()}
                  >
                    <X className="h-5 w-5 mr-2" /> Cancel
                  </Button>
                  <Button
                    onClick={handleCreateOrUpdateQuiz}
                    className="h-12 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
                  >
                    {isEditMode ? 'Update Quiz' : 'Create Quiz'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function CreateQuiz() {
  return (
    <React.Suspense fallback={<div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <CreateQuizContent />
    </React.Suspense>
  );
}
