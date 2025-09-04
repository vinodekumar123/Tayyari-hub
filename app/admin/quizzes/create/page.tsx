'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs, addDoc, Timestamp, query, updateDoc, getDoc, doc, orderBy, where } from "firebase/firestore";
import { db } from "../../../firebase";
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

// Utility for date formatting (to show counts by created date)
function formatDateYMD(dateOrTimestamp) {
  if (!dateOrTimestamp) return '';
  let date;
  if (dateOrTimestamp.seconds) date = new Date(dateOrTimestamp.seconds * 1000);
  else date = new Date(dateOrTimestamp);
  return date.toISOString().split('T')[0];
}

export default function CreateQuiz() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const params = useSearchParams();
  const quizId = params.get('id');
  const isEditMode = Boolean(quizId);

  // --- Date filter for questions
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });

  // --- Quiz config
  const [quizConfig, setQuizConfig] = useState({
    title: '',
    description: '',
    course: '',
    subjects: [],
    chapters: [],
    totalQuestions: 20,
    duration: 60,
    questionsPerPage: 1,
    maxAttempts: 1,
    shuffleQuestions: true,
    shuffleOptions: true,
    showExplanation: true,
    startDate: '',
    endDate: '',
    startTime: '',published: false,
    endTime: '',
    accessType: 'free',
    resultVisibility: 'immediate',
    selectedQuestions: [],
    questionFilters: {
      subjects: [],
      chapters: [],
      difficulty: '',
      searchTerm: '',
      topic: '',
    },
  });

  // --- Optimization: Memoized course/subject/chapter count maps ---
  const [questionCountByCourse, setQuestionCountByCourse] = useState({});
  const [questionCountBySubject, setQuestionCountBySubject] = useState({});
  const [questionCountByChapter, setQuestionCountByChapter] = useState({});

  // --- All available questions (filtered by date if filter is set)
  const [availableQuestions, setAvailableQuestions] = useState([]);

  // --- Track ALL QUESTIONS for count displays (not filtered by date)
  const [allQuestions, setAllQuestions] = useState([]);

  // --- Fetch quiz data for editing ---
  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) return;
      try {
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
      } catch (error) {
        console.error("Failed to fetch quiz:", error);
        alert("Could not load quiz for editing.");
      }
    };

    fetchQuiz();
  }, [quizId]);

  // --- Fetch all courses ---
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const snapshot = await getDocs(collection(db, "courses"));
        const courseList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCourses(courseList);
      } catch (error) {
        console.error("Failed to fetch courses:", error);
      }
    };

    fetchCourses();
  }, []);

  // --- Fetch all questions (for counts and for main questions view) ---
  useEffect(() => {
    const getQuestions = async () => {
      // 1. Fetch ALL questions (for count displays)
      try {
        const allSnap = await getDocs(query(collection(db, "questions")));
        const allQs = allSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          usedInQuizzes: doc.data().usedInQuizzes || 0,
        }));
        setAllQuestions(allQs);

        // --- Build count maps for course/subject/chapter ---
        // Course and subject/chapter can be missing on some questions.
        const courseMap = {};
        const subjectMap = {};
        const chapterMap = {};
        for (const q of allQs) {
          // Course
          if (q.course) {
            courseMap[q.course] = (courseMap[q.course] || 0) + 1;
          }
          // Subject
          if (q.subject) {
            subjectMap[q.subject] = (subjectMap[q.subject] || 0) + 1;
          }
          // Chapter
          if (q.chapter) {
            chapterMap[q.chapter] = (chapterMap[q.chapter] || 0) + 1;
          }
        }
        setQuestionCountByCourse(courseMap);
        setQuestionCountBySubject(subjectMap);
        setQuestionCountByChapter(chapterMap);

      } catch (error) {
        console.error("Failed to fetch all questions for counts:", error);
      }
    };
    getQuestions();
  }, []);

  // --- Fetch available questions (filtered by date if set) ---
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        let qRef = collection(db, "questions");
        let q;
        // --- Date filter logic ---
        if (dateFilter.from || dateFilter.to) {
          let constraints = [];
          if (dateFilter.from) constraints.push(where("createdAt", ">=", Timestamp.fromDate(new Date(dateFilter.from))));
          if (dateFilter.to) constraints.push(where("createdAt", "<=", Timestamp.fromDate(new Date(dateFilter.to + 'T23:59:59.999Z'))));
          q = query(qRef, ...constraints, orderBy("createdAt", "desc"));
        } else {
          q = query(qRef, orderBy("createdAt", "desc"));
        }
        const snapshot = await getDocs(q);
        const questions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data()),
          usedInQuizzes: doc.data().usedInQuizzes || 0,
        }));
        setAvailableQuestions(questions);
      } catch (error) {
        console.error("Failed to fetch questions:", error);
      }
    };
    fetchQuestions();
  }, [dateFilter]);

  // --- Fetch subjects by course ---
  useEffect(() => {
    const fetchSubjectsByCourse = async () => {
      const selectedCourse = courses.find(c => c.name === quizConfig.course);
      if (!selectedCourse || !selectedCourse.subjectIds) {
        setSubjects([]);
        return;
      }

      const subjectList = [];
      for (const subjectId of selectedCourse.subjectIds) {
        const subjectRef = doc(db, 'subjects', subjectId);
        const subjectSnap = await getDoc(subjectRef);
        if (subjectSnap.exists()) {
          subjectList.push({ id: subjectId, name: subjectSnap.data().name });
        }
      }
      setSubjects(subjectList);
    };

    if (quizConfig.course) fetchSubjectsByCourse();
    else if (isEditMode && quizConfig.course) fetchSubjectsByCourse();
  }, [quizConfig.course, courses, isEditMode]);

  // --- Fetch chapters by subject ---
  useEffect(() => {
    const fetchChapters = async () => {
      let allChapters = new Set();
      if (quizConfig.subjects.includes('all-subjects') || quizConfig.subjects.length === 0) {
        for (const s of subjects) {
          const subjectRef = doc(db, 'subjects', s.id);
          const subjectSnap = await getDoc(subjectRef);
          if (subjectSnap.exists()) {
            const data = subjectSnap.data();
            const chaptersList = data.chapters
              ? Object.keys(data.chapters).filter(ch => ch && ch.trim() !== '')
              : [];
            chaptersList.forEach((ch) => allChapters.add(ch));
          }
        }
      } else {
        for (const subjectName of quizConfig.subjects) {
          const subject = subjects.find(s => s.name === subjectName);
          if (subject) {
            const subjectRef = doc(db, 'subjects', subject.id);
            const subjectSnap = await getDoc(subjectRef);
            if (subjectSnap.exists()) {
              const data = subjectSnap.data();
              const chaptersList = data.chapters
                ? Object.keys(data.chapters).filter(ch => ch && ch.trim() !== '')
                : [];
              chaptersList.forEach((ch) => allChapters.add(ch));
            }
          }
        }
      }
      setChapters(Array.from(allChapters));
    };

    fetchChapters();
  }, [quizConfig.subjects, subjects]);

  // --- Input/Selection handlers ---
  const handleInputChange = (field, value) => {
    setQuizConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleMultiSelectChange = (field, value) => {
    setQuizConfig(prev => ({
      ...prev,
      [field]: Array.isArray(value) ? value : [value],
      ...(field === 'subjects' ? { chapters: [] } : {}),
    }));
  };

  const handleQuestionFilterChange = (field, value) => {
    setQuizConfig(prev => ({
      ...prev,
      questionFilters: {
        ...prev.questionFilters,
        [field]: Array.isArray(value) ? value : [value],
        ...(field === 'subjects' ? { chapters: [] } : {}),
      },
    }));
  };

  // --- Question selection logic (bigger radios for UX) ---
  const handleQuestionSelection = async (question) => {
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

    try {
      const questionRef = doc(db, 'questions', question.id);
      if (question.usedInQuizzes === undefined) {
        question.usedInQuizzes = 0;
      }
      await updateDoc(questionRef, {
        usedInQuizzes: question.usedInQuizzes + (quizConfig.selectedQuestions.some(q => q.id === question.id) ? -1 : 1)
      });
    } catch (error) {
      console.error("Error updating question usage:", error);
    }
  };

  // --- Optimized auto select: select most recent N questions ---
  const handleAutoSelectQuestions = async () => {
    const alreadySelected = quizConfig.selectedQuestions.length > 0;

    if (alreadySelected) {
      for (const question of quizConfig.selectedQuestions) {
        try {
          const questionRef = doc(db, 'questions', question.id);
          await updateDoc(questionRef, {
            usedInQuizzes: Math.max((question.usedInQuizzes || 1) - 1, 0),
          });
        } catch (error) {
          console.error("Error decrementing usage count:", error);
        }
      }

      setQuizConfig((prev) => ({
        ...prev,
        selectedQuestions: [],
      }));
      return;
    }
    // --- Optimized: just take the top N most recent filtered questions ---
    const selected = availableQuestions.slice(0, Math.min(quizConfig.totalQuestions, availableQuestions.length));

    setQuizConfig((prev) => ({
      ...prev,
      selectedQuestions: selected,
    }));

    for (const question of selected) {
      try {
        const questionRef = doc(db, 'questions', question.id);
        await updateDoc(questionRef, {
          usedInQuizzes: (question.usedInQuizzes || 0) + 1,
        });
      } catch (error) {
        console.error("Error incrementing usage count:", error);
      }
    }
  };

  // --- Create or update quiz handler ---
  const handleCreateOrUpdateQuiz = async () => {
    if (
      !quizConfig.title ||
      !quizConfig.course ||
      (quizConfig.subjects.length === 0 && !quizConfig.subjects.includes('all-subjects')) ||
      quizConfig.selectedQuestions.length === 0
    ) {
      alert("Please fill in all required fields, select at least one subject, and select questions");
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
      updatedAt: Timestamp.now(),
      published: quizConfig.published || false, // Ensure published flag is included
    };

    if (!isEditMode) {
      quizPayload.createdAt = Timestamp.now();
    }

    try {
      if (isEditMode) {
        const quizRef = doc(db, 'quizzes', quizId);
        await updateDoc(quizRef, quizPayload);
        alert("Quiz updated successfully!");
      } else {
        await addDoc(collection(db, "quizzes"), quizPayload);
        alert("Quiz created successfully!");
      }
      router.push("/dashboard/admin");
    } catch (error) {
      console.error("Error saving quiz:", error);
      alert("Failed to save quiz.");
    }
  };

  const handleSaveToMockQuestions = async () => {
    try {
      const selectedQuestionIds = quizConfig.selectedQuestions.map(q => q.id);
      const existingQuestions = await getDocs(collection(db, "mock-questions"));
      const existingIds = new Set(existingQuestions.docs.map(doc => doc.id));
      for (const question of quizConfig.selectedQuestions) {
        if (!existingIds.has(question.id)) {
          await addDoc(collection(db, "mock-questions"), {
            ...question,
            createdAt: Timestamp.now(),
          });
        }
      }
      alert("Selected questions saved to Mock Questions successfully!");
    } catch (error) {
      console.error("Error saving to mock-questions:", error);
      alert("Failed to save questions to Mock Questions.");
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --- Filtered Questions (with new date filter logic) ---
  const filteredQuestions = availableQuestions.filter((q) => {
    const { subjects, chapters, difficulty, topic, searchTerm } = quizConfig.questionFilters;
    const cleanQuestionText = q.questionText ? q.questionText.replace(/<[^>]+>/g, '') : '';
    const matchesSubject = subjects.length === 0 || subjects.includes('all-subjects') || subjects.includes(q.subject);
    const matchesChapter = chapters.length === 0 || chapters.includes('all-chapters') || chapters.includes(q.chapter);
    const matchesDifficulty = !difficulty || difficulty === '__all-difficulties__' || q.difficulty === difficulty;
    const matchesTopic = !topic || topic === '__all-topics__' || q.topic === topic;
    const matchesSearch = !searchTerm || cleanQuestionText.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSubject && matchesChapter && matchesDifficulty && matchesTopic && matchesSearch;
  });

  const groupedQuestions = filteredQuestions.reduce((acc, question) => {
    const subject = question.subject || 'Uncategorized';
    if (!acc[subject]) {
      acc[subject] = [];
    }
    acc[subject].push(question);
    return acc;
  }, {});

  // --- MultiSelect with counts shown ---
  const MultiSelect = ({ value, onChange, options, placeholder, disabled, countMap }) => {
    const displayValue = value.includes('all-subjects') || value.includes('all-chapters')
      ? value.includes('all-subjects') ? 'All Subjects' : 'All Chapters'
      : value.length > 0 
        ? value.join(', ') 
        : placeholder;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between border-gray-300 focus:border-blue-500 rounded-xl"
            disabled={disabled}
          >
            <span className="truncate">{displayValue}</span>
            <span>▼</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full max-h-60 overflow-y-auto">
          <div className="space-y-2">
            {options.map((option) => (
              <div key={option.value} className="flex items-center">
                <Checkbox
                  checked={value.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      if (option.value === 'all-subjects' || option.value === 'all-chapters') {
                        onChange([option.value]);
                      } else {
                        onChange([
                          ...value.filter(v => v !== 'all-subjects' && v !== 'all-chapters'),
                          option.value
                        ]);
                      }
                    } else {
                      onChange(value.filter(v => v !== option.value));
                    }
                  }}
                  className="mr-2"
                />
                <span>
                  {option.label}
                  {countMap && countMap[option.value] !== undefined && (
                    <span className="text-xs ml-2 text-gray-500">({countMap[option.value]})</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // --- Date filter logic for questions ---
  const minCreatedAt = allQuestions.reduce((min, q) => {
    if (!q.createdAt) return min;
    const d = q.createdAt.seconds ? new Date(q.createdAt.seconds * 1000) : new Date(q.createdAt);
    return !min || d < min ? d : min;
  }, null);
  const maxCreatedAt = allQuestions.reduce((max, q) => {
    if (!q.createdAt) return max;
    const d = q.createdAt.seconds ? new Date(q.createdAt.seconds * 1000) : new Date(q.createdAt);
    return !max || d > max ? d : max;
  }, null);

  // --- Optimized: Memoize question count for current date filter
  const filteredQuestionCount = availableQuestions.length;

  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white/90 shadow-lg backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {isEditMode ? 'Edit Quiz' : 'Create Quiz'}
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Tabs defaultValue="basic" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-md rounded-xl p-1 shadow-md">
            <TabsTrigger
              value="basic"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              Basic Info
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              Settings
            </TabsTrigger>
            <TabsTrigger
              value="questions"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              Questions
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              Schedule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-8">
            <Card className="bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-2xl font-semibold text-gray-900">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  <Label htmlFor="title" className="text-lg font-medium text-gray-700">Quiz Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter quiz title"
                    value={quizConfig.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                </div>
                <div className="space-y-4">
                  <Label htmlFor="description" className="text-lg font-medium text-gray-700">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter quiz description"
                    value={quizConfig.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <Label htmlFor="course" className="text-lg font-medium text-gray-700">Course *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between border-gray-300 focus:border-blue-500 rounded-xl"
                        >
                          <span>
                            {quizConfig.course || 'Select course'}
                            {quizConfig.course && questionCountByCourse[quizConfig.course] !== undefined && (
                              <span className="ml-2 text-xs text-gray-500">({questionCountByCourse[quizConfig.course]})</span>
                            )}
                          </span>
                          <span>▼</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full">
                        <div className="space-y-2">
                          {courses.map(course => (
                            <div
                              key={course.name}
                              className="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded"
                              onClick={() => {
                                handleInputChange('course', course.name);
                                handleMultiSelectChange('subjects', []);
                                handleMultiSelectChange('chapters', []);
                              }}
                            >
                              {course.name}
                              {questionCountByCourse[course.name] !== undefined && (
                                <span className="ml-2 text-xs text-gray-500">({questionCountByCourse[course.name]})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="subjects" className="text-lg font-medium text-gray-700">Subjects *</Label>
                    <MultiSelect
                      value={quizConfig.subjects}
                      onChange={(value) => handleMultiSelectChange('subjects', value)}
                      options={[
                        { value: 'all-subjects', label: 'All Subjects' },
                        ...subjects
                          .filter(s => s && s.name && s.name.trim() !== '')
                          .map(s => ({ value: s.name, label: s.name }))
                      ]}
                      placeholder="Select subjects"
                      disabled={!quizConfig.course}
                      countMap={questionCountBySubject}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="chapters" className="text-lg font-medium text-gray-700">Chapters</Label>
                    <MultiSelect
                      value={quizConfig.chapters}
                      onChange={(value) => handleMultiSelectChange('chapters', value)}
                      options={[
                        { value: 'all-chapters', label: 'All Chapters' },
                        ...chapters
                          .filter(ch => ch && ch.trim() !== '')
                          .map(ch => ({ value: ch, label: ch }))
                      ]}
                      placeholder="Select chapters"
                      disabled={!quizConfig.subjects.length}
                      countMap={questionCountByChapter}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-8">
            <Card className="bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-2xl font-semibold text-gray-900">Quiz Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="space-y-4">
                    <Label htmlFor="totalQuestions" className="text-lg font-medium text-gray-700">Total Questions</Label>
                    <Input
                      id="totalQuestions"
                      type="number"
                      min="1"
                      max="100"
                      value={quizConfig.totalQuestions}
                      onChange={(e) => handleInputChange('totalQuestions', parseInt(e.target.value))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="questionsPerPage" className="text-lg font-medium text-gray-700">Questions Per Page</Label>
                    <Input
                      id="questionsPerPage"
                      type="number"
                      min="1"
                      max={quizConfig.totalQuestions}
                      value={quizConfig.questionsPerPage}
                      onChange={(e) => handleInputChange('questionsPerPage', parseInt(e.target.value))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="duration" className="text-lg font-medium text-gray-700">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="5"
                      max="300"
                      value={quizConfig.duration}
                      onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="maxAttempts" className="text-lg font-medium text-gray-700">Max Attempts</Label>
                    <Input
                      id="maxAttempts"
                      type="number"
                      min="1"
                      max="10"
                      value={quizConfig.maxAttempts}
                      onChange={(e) => handleInputChange('maxAttempts', parseInt(e.target.value))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="shuffleQuestions"
                      checked={quizConfig.shuffleQuestions}
                      onCheckedChange={(checked) => handleInputChange('shuffleQuestions', checked)}
                      className="h-5 w-5 border-gray-300"
                    />
                    <Label htmlFor="shuffleQuestions" className="text-lg font-medium text-gray-700">Shuffle Questions</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="shuffleOptions"
                      checked={quizConfig.shuffleOptions}
                      onCheckedChange={(checked) => handleInputChange('shuffleOptions', checked)}
                      className="h-5 w-5 border-gray-300"
                    />
                    <Label htmlFor="shuffleOptions" className="text-lg font-medium text-gray-700">Shuffle Answer Options</Label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="showExplanation"
                      checked={quizConfig.showExplanation}
                      onCheckedChange={(checked) => handleInputChange('showExplanation', checked)}
                      className="h-5 w-5 border-gray-300"
                    />
                    <Label htmlFor="showExplanation" className="text-lg font-medium text-gray-700">Show Explanations</Label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label htmlFor="accessType" className="text-lg font-medium text-gray-700">Access Type</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between border-gray-300 focus:border-blue-500 rounded-xl"
                        >
                          <span>{quizConfig.accessType || 'Select access type'}</span>
                          <span>▼</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full">
                        <div className="space-y-2">
                          {['free', 'paid'].map(type => (
                            <div
                              key={type}
                              className="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded"
                              onClick={() => handleInputChange('accessType', type)}
                            >
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="resultVisibility" className="text-lg font-medium text-gray-700">Result Visibility</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between border-gray-300 focus:border-blue-500 rounded-xl"
                        >
                          <span>{quizConfig.resultVisibility || 'Select visibility'}</span>
                          <span>▼</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full">
                        <div className="space-y-2">
                          {['immediate', 'manual', 'scheduled'].map(visibility => (
                            <div
                              key={visibility}
                              className="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded"
                              onClick={() => handleInputChange('resultVisibility', visibility)}
                            >
                              {visibility.charAt(0).toUpperCase() + visibility.slice(1)}
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-8">
            <Card className="bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl">
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
                {/* --- Date Filter UI --- */}
                <div className="pt-4 flex flex-wrap gap-4 items-center">
                  <Label className="text-md font-medium text-gray-700 mr-2">Created Date:</Label>
                  <Input
                    type="date"
                    value={dateFilter.from}
                    min={minCreatedAt ? formatDateYMD(minCreatedAt) : undefined}
                    max={dateFilter.to || (maxCreatedAt ? formatDateYMD(maxCreatedAt) : undefined)}
                    onChange={e => setDateFilter(df => ({ ...df, from: e.target.value }))}
                    className="w-auto"
                  />
                  <span>to</span>
                  <Input
                    type="date"
                    value={dateFilter.to}
                    min={dateFilter.from || (minCreatedAt ? formatDateYMD(minCreatedAt) : undefined)}
                    max={maxCreatedAt ? formatDateYMD(maxCreatedAt) : undefined}
                    onChange={e => setDateFilter(df => ({ ...df, to: e.target.value }))}
                    className="w-auto"
                  />
                  <span className="ml-3 text-gray-600 text-sm">
                    Showing <b>{filteredQuestionCount}</b> question{filteredQuestionCount !== 1 ? 's' : ''} {dateFilter.from || dateFilter.to ? 'for selected date range' : ' (most recent)'}
                  </span>
                  {(dateFilter.from || dateFilter.to) && (
                    <Button
                      variant="ghost"
                      className="ml-2 text-xs"
                      onClick={() => setDateFilter({ from: '', to: '' })}
                    >
                      Clear Date Filter
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                        options={[
                          { value: 'all-subjects', label: 'All Subjects' },
                          ...subjects.map(s => ({ value: s.name, label: s.name }))
                        ]}
                        placeholder="All subjects"
                        countMap={questionCountBySubject}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-lg font-medium text-gray-700">Chapters</Label>
                      <MultiSelect
                        value={quizConfig.questionFilters.chapters}
                        onChange={(value) => handleQuestionFilterChange('chapters', value)}
                        options={[
                          { value: 'all-chapters', label: 'All Chapters' },
                          ...chapters.map(ch => ({ value: ch, label: ch }))
                        ]}
                        placeholder="All chapters"
                        countMap={questionCountByChapter}
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
                  </div>
                </div>
                <div className="space-y-8">
                  {Object.entries(groupedQuestions).map(([subject, questions]) => (
                    <div key={subject} className="space-y-4">
                      <div className="border-b-2 border-blue-500 pb-2 flex items-center">
                        <h3 className="text-xl font-semibold text-gray-900">{subject}</h3>
                        {questionCountBySubject[subject] !== undefined && (
                          <span className="ml-2 text-xs text-gray-500">({questionCountBySubject[subject]})</span>
                        )}
                      </div>
                      {questions.map((question) => (
                        <Card
                          key={question.id}
                          className={`cursor-pointer transition-all duration-200 ${
                            quizConfig.selectedQuestions.some((q) => q.id === question.id)
                              ? 'ring-2 ring-blue-500 bg-blue-50 shadow-lg'
                              : 'hover:shadow-md'
                          }`}
                        >
                          <CardContent className="p-5 flex items-start space-x-4">
                            {/* --- Make radio bigger for better UX --- */}
                            <input
                              type="checkbox"
                              checked={quizConfig.selectedQuestions.some((q) => q.id === question.id)}
                              onChange={() => handleQuestionSelection(question)}
                              className="h-7 w-7 border-2 border-blue-400 rounded-md focus:ring-2 focus:ring-blue-500 mr-3 transition-all duration-150"
                              style={{ minWidth: 28, minHeight: 28 }}
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <p className="font-medium text-gray-900 text-lg">
                                  {question.questionText ? question.questionText.replace(/<[^>]+>/g, '') : 'Untitled Question'}
                                </p>
                              </div>
                              <div className="flex items-center flex-wrap gap-2">
                                <Badge variant="outline" className="border-gray-300 text-gray-700">
                                  {question.chapter}
                                </Badge>
                                <Badge className={getDifficultyColor(question.difficulty ?? 'Easy')}>
                                  {question.difficulty ?? 'Easy'}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  Used in {question.usedInQuizzes || 0} quizzes
                                </span>
                                {question.createdAt && (
                                  <span className="text-xs text-gray-400 ml-3">
                                    {formatDateYMD(question.createdAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-8">
            <Card className="bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-xl">
              <CardHeader className="border-b border-gray-200">
                <CardTitle className="text-2xl font-semibold text-gray-900">Schedule Quiz</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label htmlFor="startDate" className="text-lg font-medium text-gray-700">Start Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        id="startDate"
                        type="date"
                        value={quizConfig.startDate}
                        onChange={(e) => handleInputChange('startDate', e.target.value)}
                        className="pl-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="endDate" className="text-lg font-medium text-gray-700">End Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        id="endDate"
                        type="date"
                        value={quizConfig.endDate}
                        onChange={(e) => handleInputChange('endDate', e.target.value)}
                        className="pl-12 border-gray-300 focus:border-blue-500 focus
