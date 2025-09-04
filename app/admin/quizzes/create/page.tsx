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

export default function CreateQuiz() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState([]);
  const params = useSearchParams();
  const quizId = params.get('id');
  const isEditMode = Boolean(quizId);

  // Date filter for question creation
  const [questionDateFilter, setQuestionDateFilter] = useState('');

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
    startDate: '',published: false,
    endDate: '',
    startTime: '',
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

        // Questions
        const q = query(
          collection(db, "questions"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const questions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data()),
          usedInQuizzes: doc.data().usedInQuizzes || 0,
        }));
        setAvailableQuestions(questions);

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
  const [availableQuestions, setAvailableQuestions] = useState([]);

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
      setChapters(Array.from(allChapters));
    };
    fetchChapters();
    // eslint-disable-next-line
  }, [quizConfig.subjects, subjects]);

  // Handlers
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

  // Question selection (with bigger radios)
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

  // Auto select logic: select the latest added questions (top N recent)
  const handleAutoSelectQuestions = async () => {
    if (quizConfig.selectedQuestions.length > 0) {
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

    // Filter by date if applied
    let filtered = availableQuestions;
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
      published: quizConfig.published || false,
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

  // Helper to show counts
  const countQuestionsFor = ({ course, subject, chapter }) => {
    let filtered = availableQuestions;
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
  }, {});

  // MultiSelect component with badge count
  const MultiSelect = ({ value, onChange, options, placeholder, disabled, type }) => {
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
              <div key={option.value} className="flex items-center justify-between">
                <div className="flex items-center">
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
                    style={{ width: 22, height: 22 }} // Slightly larger for better UX
                  />
                  <span>{option.label}</span>
                </div>
                {/* Show badge with number of questions */}
                {!!type && (
                  <Badge variant="secondary" className="ml-2">
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
            <TabsTrigger value="basic" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200">Basic Info</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200">Settings</TabsTrigger>
            <TabsTrigger value="questions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200">Questions</TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg transition-all duration-200">Schedule</TabsTrigger>
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
                          <span>{quizConfig.course || 'Select course'}</span>
                          <span>▼</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full">
                        <div className="space-y-2">
                          {courses.map(course => (
                            <div
                              key={course.name}
                              className="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded justify-between"
                              onClick={() => {
                                handleInputChange('course', course.name);
                                handleMultiSelectChange('subjects', []);
                                handleMultiSelectChange('chapters', []);
                              }}
                            >
                              <span>{course.name}</span>
                              <Badge variant="secondary" className="ml-2">{countQuestionsFor({ course: course.name })}</Badge>
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
                      options={[{ value: 'all-subjects', label: 'All Subjects' }, ...subjects.filter(s => s && s.name && s.name.trim() !== '').map(s => ({ value: s.name, label: s.name }))]}
                      placeholder="Select subjects"
                      disabled={!quizConfig.course}
                      type="subject"
                    />
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="chapters" className="text-lg font-medium text-gray-700">Chapters</Label>
                    <MultiSelect
                      value={quizConfig.chapters}
                      onChange={(value) => handleMultiSelectChange('chapters', value)}
                      options={[{ value: 'all-chapters', label: 'All Chapters' }, ...chapters.filter(ch => ch && ch.trim() !== '').map(ch => ({ value: ch, label: ch }))]}
                      placeholder="Select chapters"
                      disabled={!quizConfig.subjects.length}
                      type="chapter"
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
                  {Object.entries(groupedQuestions).map(([subject, questions]) => (
                    <div key={subject} className="space-y-4">
                      <div className="border-b-2 border-blue-500 pb-2 flex items-center">
                        <h3 className="text-xl font-semibold text-gray-900">{subject}</h3>
                        <Badge variant="secondary" className="ml-3">{questions.length}</Badge>
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
                            <Checkbox
                              checked={quizConfig.selectedQuestions.some((q) => q.id === question.id)}
                              onCheckedChange={() => handleQuestionSelection(question)}
                              className="h-8 w-8 mt-1 border-gray-400" // bigger for better UX
                              style={{ minWidth: 32, minHeight: 32 }}
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
                                  <span className="text-xs text-gray-400 ml-2">
                                    Added: {question.createdAt.seconds ? new Date(question.createdAt.seconds * 1000).toLocaleDateString() : new Date(question.createdAt).toLocaleDateString()}
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
                        className="pl-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label htmlFor="startTime" className="text-lg font-medium text-gray-700">Start Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        id="startTime"
                        type="time"
                        value={quizConfig.startTime}
                        onChange={(e) => handleInputChange('startTime', e.target.value)}
                        className="pl-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="endTime" className="text-lg font-medium text-gray-700">End Time</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        id="endTime"
                        type="time"
                        value={quizConfig.endTime}
                        onChange={(e) => handleInputChange('endTime', e.target.value)}
                        className="pl-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="published"
                      checked={quizConfig.published}
                      onCheckedChange={(checked) => handleInputChange('published', checked)}
                      className="h-5 w-5 border-gray-300"
                    />
                    <Label htmlFor="published" className="text-lg font-medium text-gray-700">Publish Quiz</Label>
                  </div>
                </div>
                <div className="bg-gray-50/80 p-6 rounded-xl shadow-inner">
                  <h4 className="text-xl font-medium text-gray-900 mb-4">Quiz Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                    <div>
                      <p className="text-gray-700"><strong>Title:</strong> {quizConfig.title || 'Not set'}</p>
                      <p className="text-gray-700"><strong>Course:</strong> {quizConfig.course || 'Not selected'}</p>
                      <p className="text-gray-700"><strong>Subjects:</strong> {Array.isArray(quizConfig.subjects) ? (quizConfig.subjects.includes('all-subjects') ? 'All Subjects' : quizConfig.subjects.join(', ') || 'Not selected') : 'Not selected'}</p>
                      <p className="text-gray-700"><strong>Chapters:</strong> {Array.isArray(quizConfig.chapters) ? (quizConfig.chapters.includes('all-chapters') ? 'All Chapters' : quizConfig.chapters.join(', ') || 'None selected') : 'None selected'}</p>
                      <p className="text-gray-700"><strong>Questions:</strong> {quizConfig.selectedQuestions.length} / {quizConfig.totalQuestions}</p>
                      <p className="text-gray-700"><strong>Duration:</strong> {quizConfig.duration} minutes</p>
                      <p className="text-gray-700"><strong>Published:</strong> {quizConfig.published ? 'Yes' : 'No'}</p>
                    </div>
                    <div>
                      <p className="text-gray-700"><strong>Access:</strong> {quizConfig.accessType}</p>
                      <p className="text-gray-700"><strong>Result Visibility:</strong> {quizConfig.resultVisibility}</p>
                      <p className="text-gray-700"><strong>Max Attempts:</strong> {quizConfig.maxAttempts}</p>
                      <p className="text-gray-700"><strong>Shuffle Questions:</strong> {quizConfig.shuffleQuestions ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-4">
                  <Button
                    variant="outline"
                    className="border-gray-300 hover:bg-gray-100 transition-all duration-200"
                    onClick={() => router.back()}
                  >
                    <X className="h-5 w-5 mr-2" /> Cancel
                  </Button>
                  <Button
                    onClick={handleCreateOrUpdateQuiz}
                    className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white transition-all duration-200"
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
