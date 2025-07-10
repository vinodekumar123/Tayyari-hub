'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../firebase"; // Adjust your path if different
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect } from 'react';
import { addDoc, Timestamp } from "firebase/firestore";

import { 
  BookOpen, 
  Settings, 
  Plus, 
  Minus, 
  Calendar, 
  Clock, 
  Users, 
  Eye,
  Search,
  Filter,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateQuiz() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [courses, setCourses] = useState<any[]>([]);
const [subjects, setSubjects] = useState<string[]>([]);
const [chapters, setChapters] = useState<string[]>([]);

  const [quizConfig, setQuizConfig] = useState({
    title: '',
    description: '',
    course: '',
    subject: '',
    chapter: '',
    totalQuestions: 20,
    duration: 60,
    maxAttempts: 1,
    shuffleQuestions: true,
    shuffleOptions: true,
    showExplanation: true,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    accessType: 'free',
    resultVisibility: 'immediate',
    selectedQuestions: [] as any[],
questionFilters: {
  subject: '',
  chapter: '',
  difficulty: '',
  searchTerm: '',
  topic: '' // ✅ Add this line
}

  });

  useEffect(() => {
  const fetchCourses = async () => {
    const snapshot = await getDocs(collection(db, "courses"));
    const courseList: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      courseList.push({
        id: doc.id,
        name: data.name,
        description: data.description,
        subjects: data.subjects || [],
        chapters: data.chapters || {}
      });
    });
    setCourses(courseList);
  };

  fetchCourses();
}, []);
const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);

type Question = {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  course?: string;
  subject?: string;
  chapter?: string;
  difficulty?: string;
  topic?: string;
  usedInQuizzes?: number;
};

useEffect(() => {
  const fetchQuestions = async () => {
    const snapshot = await getDocs(collection(db, "questions"));
    const questions: Question[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Question, 'id'>),
    }));
    setAvailableQuestions(questions);
  };

  fetchQuestions();
}, []);

useEffect(() => {
  const selected = courses.find(c => c.name === quizConfig.course);
  if (selected) {
    setSubjects(selected.subjects || []);
  } else {
    setSubjects([]);
  }
}, [quizConfig.course, courses]);

useEffect(() => {
  const selected = courses.find(c => c.name === quizConfig.course);

  let subjectChapters: string[] = [];

  if (selected?.chapters && typeof selected.chapters === 'object') {
    const chapterObj = selected.chapters[quizConfig.subject];
    if (chapterObj && typeof chapterObj === 'object') {
      subjectChapters = Object.keys(chapterObj);
    }
  }

  setChapters(subjectChapters);
}, [quizConfig.subject, quizConfig.course, courses]);



const handleInputChange = (field: string, value: any) => {
    setQuizConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

const handleQuestionSelection = (question: Question) => {
    setQuizConfig(prev => ({
      ...prev,
      selectedQuestions: prev.selectedQuestions.some(q => q.id === question.id)
        ? prev.selectedQuestions.filter(q => q.id !== question.id)
        : [...prev.selectedQuestions, question]
    }));
  };

  const handleAutoSelectQuestions = () => {
    const filteredQuestions = availableQuestions.filter(q => {
      const matchesSubject = !quizConfig.questionFilters.subject || q.subject === quizConfig.questionFilters.subject;
      const matchesChapter = !quizConfig.questionFilters.chapter || q.chapter === quizConfig.questionFilters.chapter;
      const matchesDifficulty = !quizConfig.questionFilters.difficulty || q.difficulty === quizConfig.questionFilters.difficulty;
      const matchesSearch =
  !quizConfig.questionFilters.searchTerm ||
  (q.questionText?.toLowerCase().includes(quizConfig.questionFilters.searchTerm.toLowerCase()) ?? false);

      
      return matchesSubject && matchesChapter && matchesDifficulty && matchesSearch;
    });

    const selectedQuestions = filteredQuestions.slice(0, quizConfig.totalQuestions);
    setQuizConfig(prev => ({
      ...prev,
      selectedQuestions
    }));
  };

 const handleCreateQuiz = async () => {
  if (!quizConfig.title || !quizConfig.course || quizConfig.selectedQuestions.length === 0) {
    alert("Please fill in all required fields and select questions");
    return;
  }

  const quizPayload = {
    ...quizConfig,
    createdAt: Timestamp.now()
  };

  try {
    await addDoc(collection(db, "quizzes"), quizPayload);
    alert("Quiz created successfully!");
    router.push("/dashboard/admin");
  } catch (error) {
    console.error("Failed to create quiz:", error);
    alert("Error creating quiz.");
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

 const filteredQuestions = availableQuestions.filter((q) => {
  const { subject, chapter, difficulty, topic, searchTerm } = quizConfig.questionFilters;

  const matchesSubject =
    !subject || subject === "__all-subjects__" || q.subject === subject;

  const matchesChapter =
    !chapter || chapter === "__all-chapters__" || q.chapter === chapter;

  const matchesDifficulty =
    !difficulty || difficulty === "__all-difficulties__" || q.difficulty === difficulty;

  const matchesTopic =
    !topic || topic === "__all-topics__" || q.topic === topic;

  const matchesSearch =
    !searchTerm || (q.questionText || "").toLowerCase().includes(searchTerm.toLowerCase());

  return (
    matchesSubject &&
    matchesChapter &&
    matchesDifficulty &&
    matchesTopic &&
    matchesSearch
  );
});


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Create Quiz</span>
              </div>
            </div>
            
            <Button variant="outline" onClick={() => router.back()}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Quiz Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter quiz title"
                    value={quizConfig.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Enter quiz description"
                    value={quizConfig.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
               <Label htmlFor="course">Course *</Label>
<Select 
  value={quizConfig.course} 
  onValueChange={(value) => handleInputChange('course', value)}
>
  <SelectTrigger>
    <SelectValue placeholder="Select course" />
  </SelectTrigger>
  <SelectContent>
    {courses.map(course => (
      <SelectItem key={course.name} value={course.name}>
        {course.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
<Select 
  value={quizConfig.subject} 
  onValueChange={(value) => handleInputChange('subject', value)}
  disabled={!quizConfig.course}
>
  <SelectTrigger>
    <SelectValue placeholder="Select subject" />
  </SelectTrigger>
  <SelectContent>
    {subjects.map(subject => (
      <SelectItem key={subject} value={subject}>
        {subject}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chapter">Chapter</Label>
<Select 
  value={quizConfig.chapter} 
  onValueChange={(value) => handleInputChange('chapter', value)}
  disabled={!quizConfig.subject}
>
  <SelectTrigger>
    <SelectValue placeholder="Select chapter" />
  </SelectTrigger>
<SelectContent>
  {Array.isArray(chapters) && chapters.map((chap) => (
    <SelectItem key={chap} value={chap}>
      {chap}
    </SelectItem>
  ))}
</SelectContent>

</Select>

                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quiz Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="totalQuestions">Total Questions</Label>
                    <Input
                      id="totalQuestions"
                      type="number"
                      min="1"
                      max="100"
                      value={quizConfig.totalQuestions}
                      onChange={(e) => handleInputChange('totalQuestions', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="5"
                      max="300"
                      value={quizConfig.duration}
                      onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxAttempts">Max Attempts</Label>
                    <Input
                      id="maxAttempts"
                      type="number"
                      min="1"
                      max="10"
                      value={quizConfig.maxAttempts}
                      onChange={(e) => handleInputChange('maxAttempts', parseInt(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shuffleQuestions"
                      checked={quizConfig.shuffleQuestions}
                      onCheckedChange={(checked) => handleInputChange('shuffleQuestions', checked)}
                    />
                    <Label htmlFor="shuffleQuestions">Shuffle Questions</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="shuffleOptions"
                      checked={quizConfig.shuffleOptions}
                      onCheckedChange={(checked) => handleInputChange('shuffleOptions', checked)}
                    />
                    <Label htmlFor="shuffleOptions">Shuffle Answer Options</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showExplanation"
                      checked={quizConfig.showExplanation}
                      onCheckedChange={(checked) => handleInputChange('showExplanation', checked)}
                    />
                    <Label htmlFor="showExplanation">Show Explanations</Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="accessType">Access Type</Label>
                    <Select 
                      value={quizConfig.accessType} 
                      onValueChange={(value) => handleInputChange('accessType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resultVisibility">Result Visibility</Label>
                    <Select 
                      value={quizConfig.resultVisibility} 
                      onValueChange={(value) => handleInputChange('resultVisibility', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="manual">Manual Publishing</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
<TabsContent value="questions" className="space-y-6">
  <Card>
    <CardHeader>
      <div className="flex justify-between items-center">
        <CardTitle>Question Selection</CardTitle>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleAutoSelectQuestions}>
            Auto Select ({quizConfig.totalQuestions})
          </Button>
          <Badge variant="secondary">
            {quizConfig.selectedQuestions.length} / {quizConfig.totalQuestions} Selected
          </Badge>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {/* Question Filters */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Select
              value={quizConfig.questionFilters.subject}
              onValueChange={(value) =>
                setQuizConfig((prev) => ({
                  ...prev,
                  questionFilters: {
                    ...prev.questionFilters,
                    subject: value,
                  },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all-subjects__">All subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chapter</Label>
            <Select
              value={quizConfig.questionFilters.chapter}
              onValueChange={(value) =>
                setQuizConfig((prev) => ({
                  ...prev,
                  questionFilters: {
                    ...prev.questionFilters,
                    chapter: value,
                  },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All chapters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all-chapters__">All chapters</SelectItem>
                {Array.isArray(chapters) &&
                  chapters.map((chap) => (
                    <SelectItem key={chap} value={chap}>
                      {chap}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Difficulty</Label>
            <Select
              value={quizConfig.questionFilters.difficulty}
              onValueChange={(value) =>
                setQuizConfig((prev) => ({
                  ...prev,
                  questionFilters: {
                    ...prev.questionFilters,
                    difficulty: value,
                  },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All difficulties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all-difficulties__">All difficulties</SelectItem>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
  <Label>Topic</Label>
  <Select
    value={quizConfig.questionFilters.topic}
    onValueChange={(value) =>
      setQuizConfig((prev) => ({
        ...prev,
        questionFilters: {
          ...prev.questionFilters,
          topic: value,
        },
      }))
    }
  >
    <SelectTrigger>
      <SelectValue placeholder="All topics" />
    </SelectTrigger>
    <SelectContent>
  <SelectItem value="__all-topics__">All topics</SelectItem>
  {Array.from(
    new Set(
      availableQuestions
        .map((q) => q.topic)
        .filter((topic): topic is string => typeof topic === 'string')
    )
  ).map((topic) => (
    <SelectItem key={topic} value={topic}>
      {topic}
    </SelectItem>
  ))}
</SelectContent>

  </Select>
</div>

        </div>
      </div>

      {/* Question List */}
      <div className="space-y-4">
        {filteredQuestions.map((question) => (
          <Card
            key={question.id}
            className={`cursor-pointer transition-all ${
              quizConfig.selectedQuestions.some((q) => q.id === question.id)
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:shadow-md'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-4">
                <Checkbox
                  checked={quizConfig.selectedQuestions.some((q) => q.id === question.id)}
                  onCheckedChange={() => handleQuestionSelection(question)}
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
<p className="font-medium text-gray-900">
  {question.questionText || 'Untitled Question'}
</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Add preview toggle logic here
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{question.subject}</Badge>
                    <Badge variant="outline">{question.chapter}</Badge>
                  <Badge className={getDifficultyColor(question.difficulty ?? 'Easy')}>
  {question.difficulty ?? 'Easy'}
</Badge>

                    <span className="text-sm text-gray-500">
                      Used in {question.usedInQuizzes || 0} quizzes
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </CardContent>
  </Card>
</TabsContent>


          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Schedule Quiz</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={quizConfig.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={quizConfig.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={quizConfig.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={quizConfig.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Quiz Summary</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Title:</strong> {quizConfig.title || 'Not set'}</p>
                      <p><strong>Course:</strong> {quizConfig.course || 'Not selected'}</p>
                      <p><strong>Questions:</strong> {quizConfig.selectedQuestions.length} / {quizConfig.totalQuestions}</p>
                      <p><strong>Duration:</strong> {quizConfig.duration} minutes</p>
                    </div>
                    <div>
                      <p><strong>Access:</strong> {quizConfig.accessType}</p>
                      <p><strong>Result Visibility:</strong> {quizConfig.resultVisibility}</p>
                      <p><strong>Max Attempts:</strong> {quizConfig.maxAttempts}</p>
                      <p><strong>Shuffle Questions:</strong> {quizConfig.shuffleQuestions ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateQuiz} className="bg-blue-600 hover:bg-blue-700">
                    Create Quiz
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
