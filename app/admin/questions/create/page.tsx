'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { CsvImporter } from '@/components/admin/CsvImporter';
import { AiBulkGenerateDialog } from '@/components/admin/AiBulkGenerateDialog';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, Wand2, Calculator, Download, Upload, CheckCircle2, RotateCcw, AlertCircle, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import { glassmorphism } from '@/lib/design-tokens';
import { app, auth } from '../../../firebase';

import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const db = getFirestore(app);
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from 'sonner';



const ReactQuill = dynamic(
  async () => {
    const { default: RQ, Quill } = (await import('react-quill-new')) as any;
    // const { default: ImageResize } = await import('quill-image-resize-module-react');

    if (typeof window !== 'undefined' && Quill) {
      (window as any).Quill = Quill;
      try {
        const Parchment = Quill.import('parchment');
        if (Parchment) {
          (Quill as any).Parchment = Parchment;
          (window as any).Parchment = Parchment;

          const getImp = (p: string) => { try { return Quill.import(p); } catch (e) { return null; } };

          const Attributor = Parchment.Attributor || {
            Style: getImp('attributors/style') || getImp('attributor/style') || {},
            Class: getImp('attributors/class') || getImp('attributor/class') || {},
            Attribute: getImp('attributors/attribute') || getImp('attributor/attribute') || {}
          };

          (Quill as any).Attributor = Attributor;
          (window as any).Quill.Attributor = Attributor;
        }
      } catch (e) { }
    }

    if (Quill) {
      try {
        // Quill.register('modules/imageResize', ImageResize);
      } catch (e) { }
    }

    const QuillComponent = ({ forwardedRef, ...props }: any) => <RQ ref={forwardedRef} {...props} />;
    QuillComponent.displayName = 'QuillComponent';
    return QuillComponent;
  },
  { ssr: false, loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-md" /> }
);

const EDITOR_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'font': [] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub' }, { 'script': 'super' }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean']
  ],
  // imageResize: {
  //   displaySize: true
  // }
};

const EDITOR_FORMATS = [
  'header', 'font',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'script',
  'list', 'indent',
  'align',
  'blockquote', 'code-block',
  'link', 'image'
];

// Types
interface Course {
  id: string;
  name: string;
  subjectIds?: string[];
}

interface Subject {
  id: string;
  name: string;
  chapters?: { [key: string]: boolean };
}

interface Question {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  subject: string;
  difficulty: string;
  tags: string[];
  topic: string;
  subtopic: string;
  isPublic?: boolean;
  courseId?: string;
  teacherId?: string;
  createdBy?: string;
  allOptionsCorrect?: boolean;
  teacher?: string;
}

const CreateQuestionPageContent = () => {
  const searchParams = useSearchParams();
  const questionId = searchParams.get('id');
  const isEditMode = !!questionId;

  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  // Button Loading States
  const [isAiBulkLoading, setIsAiBulkLoading] = useState(false);
  const [isCsvLoading, setIsCsvLoading] = useState(false);

  // AI State
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<Partial<Question>[]>([]);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);

  // CSV State
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [importInitialData, setImportInitialData] = useState<any[] | undefined>(undefined);

  // AI Bulk State
  const [isAiBulkOpen, setIsAiBulkOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']); // Default 4 options
  const [correctAnswer, setCorrectAnswer] = useState(''); // Store the OPTION TEXT, not index
  const [explanation, setExplanation] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [topic, setTopic] = useState('');
  const [subtopic, setSubtopic] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState('');
  // const [positiveMarks, setPositiveMarks] = useState(4); // Removed
  // const [isGrace, setIsGrace] = useState(false); // Removed
  const [allOptionsCorrect, setAllOptionsCorrect] = useState(false);
  const [chapter, setChapter] = useState('');
  const [year, setYear] = useState('');
  const [book, setBook] = useState('');

  // RBAC State
  const [userRole, setUserRole] = useState<'admin' | 'teacher' | 'student' | null>(null);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [userName, setUserName] = useState<string>('');

  // Fetch Role & Subjects
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user: any) => {
      if (user) {
        const d = await getDoc(doc(db, 'users', user.uid));
        if (d.exists()) {
          const uData = d.data();
          const r = uData.role || (uData.admin ? 'admin' : 'student');
          setUserRole(r);
          setUserName(uData.name || uData.displayName || 'Unknown'); // Capture Name
          if (r === 'teacher') {
            setAssignedSubjects(uData.subjects || []);
            // Auto-select first subject
            if (uData.subjects && uData.subjects.length > 0) {
              setSubject(uData.subjects[0]);
            }
          }
          // Consume Metadata Defaults
          if (uData.metadata) {
            const m = uData.metadata;
            if (m.courseId) setSelectedCourse(m.courseId);
            if (m.subject) setSubject(m.subject);
            if (m.difficulty) setDifficulty(m.difficulty);
            if (m.chapter) setChapter(m.chapter);
            if (m.year) setYear(m.year);
            if (m.book) setBook(m.book);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  // Fetch courses on mount
  // Fetch courses and subjects on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Courses
        const courseSnap = await getDocs(collection(db, 'courses'));
        const coursesData: Course[] = [];
        courseSnap.forEach((doc) => {
          coursesData.push({
            id: doc.id,
            name: doc.data().name,
            subjectIds: doc.data().subjectIds
          });
        });
        setCourses(coursesData);

        // Fetch Subjects
        const subjectSnap = await getDocs(collection(db, 'subjects'));
        const subjectsData: Subject[] = [];
        subjectSnap.forEach((doc) => {
          subjectsData.push({
            id: doc.id,
            ...doc.data()
          } as Subject);
        });
        setAllSubjects(subjectsData);

      } catch (error) {
        console.error("Error fetching data: ", error);
        toast.error("Failed to fetch prerequisite data");
      }
    };
    fetchData();
  }, []);

  // Fetch Question if Edit Mode
  useEffect(() => {
    if (!questionId) return;
    const fetchQuestion = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'questions', questionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const q = docSnap.data() as Question; // Cast simpler

          // SECURITY: Teacher Ownership Check
          if (userRole === 'teacher') {
            const currentUid = auth.currentUser?.uid;
            // Check teacherId or createdBy. Legacy questions might not have teacherId.
            // If neither matches, deny access.
            if (q.teacherId !== currentUid && q.createdBy !== currentUid) {
              toast.error("You do not have permission to edit this question.");
              // Optional: Redirect or clear state
              setLoading(false);
              return;
            }
          }

          // Populate Form
          setQuestionText(q.questionText || '');
          setOptions(q.options || ['', '', '', '']);
          setCorrectAnswer(q.correctAnswer || '');
          setExplanation(q.explanation || '');
          setSubject(q.subject || '');
          setDifficulty(q.difficulty || 'Medium');
          setTopic(q.topic || '');
          setSubtopic(q.subtopic || '');
          setIsPublic(q.isPublic ?? true);
          if (q.courseId) setSelectedCourse(q.courseId);
          setAllOptionsCorrect(q.allOptionsCorrect || false);
          setChapter((q as any).chapter || '');
          setYear((q as any).year || '');
          setBook((q as any).book || '');
        } else {
          toast.error("Question not found");
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load question");
      } finally {
        setLoading(false);
      }
    };
    if (userRole !== null) { // Only fetch when role is known to avoid premature security fail
      fetchQuestion();
    }
  }, [questionId, userRole]);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiGenerating(true);
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate questions');
      }

      const data = await response.json();
      setAiGeneratedQuestions(data.questions || []);
      toast.success(`Generated ${data.questions?.length || 0} questions!`);
    } catch (error: any) {
      console.error('AI Generation Error:', error);
      toast.error(error.message || 'AI Generation failed');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const applyAiQuestion = (q: Partial<Question>) => {
    if (q.questionText) setQuestionText(q.questionText);
    if (q.options) setOptions(q.options);
    if (q.correctAnswer) setCorrectAnswer(q.correctAnswer);
    if (q.explanation) setExplanation(q.explanation);
    setIsAiSheetOpen(false);
    toast.success("Question applied to form!");
  };

  const handleSubmit = async () => {
    // Validation
    if (!questionText || !correctAnswer || options.some(o => !o) || !subject || !selectedCourse) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        questionText,
        options,
        correctAnswer, // Saving the text value
        explanation,
        subject,
        difficulty,
        topic,
        subtopic,
        isPublic,
        courseId: selectedCourse,
        allOptionsCorrect,
        chapter,
        year,
        book,
        teacher: userName || 'Admin', // Save current user NAME
        teacherId: auth.currentUser?.uid, // Essential for RBAC
        createdBy: auth.currentUser?.uid, // Standard Audit Field
        type: 'multiple-choice', // Default type
        updatedAt: serverTimestamp()
      };

      if (isEditMode && questionId) {
        // Update
        await updateDoc(doc(db, 'questions', questionId), payload);
        toast.success("Question updated successfully!");
        // Don't clear form on edit, maybe redirect or stay
      } else {
        // Create
        await addDoc(collection(db, 'questions'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Question created successfully!");
        // Reset form
        setQuestionText('');
        setOptions(['', '', '', '']);
        setCorrectAnswer('');
        setExplanation('');
      }

    } catch (error) {
      console.error("Error saving question: ", error);
      toast.error("Failed to save question");
    } finally {
      setLoading(false);
    }
  };


  const handleAiBulkSuccess = (data: any[]) => {
    setImportInitialData(data);
    setIsCsvDialogOpen(true); // Open CSV/Preview Dialog directly
  };

  const handleSmartImport = async (importedData: any[]) => {
    setIsSaving(true);
    let successCount = 0;
    console.log("Starting Smart Import with", importedData.length, "rows");
    try {
      if (!db) throw new Error("Firestore DB not initialized");
      const batch = writeBatch(db);

      importedData.forEach((row) => {
        // Image Handling from raw CSV row, if CsvImporter passes it
        let questionText = row.questionText;
        if (row.imageUrl || row.image) {
          questionText += `<br/><img src="${row.imageUrl || row.image}" alt="Imported Image" />`;
        }

        console.log("Saving Question Row:", {
          row,
          globalState: { selectedCourse, subject, chapter, difficulty }
        });

        // Use Global Metadata + Row Data
        const data = {
          questionText,
          options: [row.option1, row.option2, row.option3, row.option4].filter(Boolean),
          correctAnswer: row.correctAnswer,
          explanation: row.explanation || '',
          topic: row.topic || topic, // Allow row topic to override global topic if present

          // Global Metadata
          difficulty: row.difficulty || difficulty, // Allow row difficulty to override global
          subject,
          subtopic,
          isPublic,
          courseId: selectedCourse,
          course: courses.find(c => c.id === selectedCourse)?.name || 'Unknown',
          isDeleted: false,
          // positiveMarks: Number(positiveMarks), // Removed

          // isGrace, // Removed
          allOptionsCorrect, // Default to global state for imported (unless we add col later)
          chapter,
          year,
          book,
          teacher: userName || 'Admin', // Save current user NAME
          teacherId: auth.currentUser?.uid, // Save current user ID for filtering
          createdBy: auth.currentUser?.uid, // Standard Audit Field

          status: 'published',
          type: 'multiple-choice',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const newDocRef = doc(collection(db, 'questions'));
        batch.set(newDocRef, data);
        successCount++;
      });

      await batch.commit();
      toast.success(`Successfully imported ${successCount} questions!`);
      // No need to close dialog here, CsvImporter handles its own closing/resetting or we close it via prop
      setIsCsvDialogOpen(false);

    } catch (err) {
      console.error(err);
      toast.error("Failed to save imported questions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-8">
      {/* Header */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
        <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2">
                {isEditMode ? 'Edit Question' : 'Create Question'}
              </h1>
              <p className="text-muted-foreground font-semibold flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]" />
                {isEditMode ? 'Modify existing question details' : 'Add new questions to the question bank'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={isAiBulkLoading || isCsvLoading}
                onClick={() => {
                  if (!selectedCourse || !subject) {
                    toast.error("Please configure Course and Subject first.");
                    return;
                  }
                  setIsAiBulkLoading(true);
                  // Simulate loading delay for better UX
                  setTimeout(() => {
                    setIsAiBulkOpen(true);
                    setIsAiBulkLoading(false);
                  }, 800);
                }}
                className="bg-white dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 mr-2"
              >
                {isAiBulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-500" />}
                AI Bulk Import
              </Button>

              <Button
                variant="outline"
                disabled={isAiBulkLoading || isCsvLoading}
                onClick={() => {
                  setImportInitialData(undefined); // Reset for file upload
                  if (!selectedCourse || !subject) {
                    toast.error("Please select a Course and Subject from the settings panel first.");
                    return;
                  }
                  setIsCsvLoading(true);
                  // Simulate loading delay for better UX
                  setTimeout(() => {
                    setIsCsvDialogOpen(true);
                    setIsCsvLoading(false);
                  }, 800);
                }}
                className="bg-white dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                {isCsvLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import CSV
              </Button>
              <Sheet open={isAiSheetOpen} onOpenChange={setIsAiSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="bg-gradient-to-r from-[#004AAD] to-[#0066FF] hover:shadow-lg hover:shadow-blue-500/25 transition-all text-white border-none">
                    <Wand2 className="w-4 h-4 mr-2" /> AI Generate
                  </Button>
                </SheetTrigger>

                <SheetContent className="sm:max-w-[80vw] w-[80vw] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Generate Questions with AI</SheetTitle>
                    <SheetDescription>
                      Describe the topic, difficulty, and type of questions you want.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6 space-y-4">
                    <div className="space-y-2">
                      <Label>Prompt</Label>
                      <Textarea
                        placeholder="E.g., Create 5 hard physics questions about thermodynamics for JEE Advanced..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <Button onClick={handleAiGenerate} disabled={isAiGenerating} className="w-full">
                      {isAiGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                      Generate
                    </Button>

                    <div className="space-y-4 mt-8">
                      {aiGeneratedQuestions.map((q, i) => (
                        <Card key={i} className="bg-muted/50">
                          <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                              <CardTitle className="text-base line-clamp-2" dangerouslySetInnerHTML={{ __html: q.questionText || '' }} />
                              <Button size="sm" onClick={() => applyAiQuestion(q)}>Apply</Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <ul className="text-sm list-disc pl-4 space-y-1">
                              {q.options?.map((opt, idx) => (
                                <li key={idx} className={opt === q.correctAnswer ? "text-green-600 font-medium" : ""}>{opt}</li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Form Area */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Question Text</Label>
                <div className="min-h-[200px]">
                  <ReactQuill
                    theme="snow"
                    value={questionText}
                    onChange={setQuestionText}
                    modules={EDITOR_MODULES}
                    formats={EDITOR_FORMATS}
                    className="h-[150px]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label>Options</Label>
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="mt-3">
                      <Checkbox
                        checked={correctAnswer === option && option !== ''}
                        onCheckedChange={(checked) => {
                          if (checked) setCorrectAnswer(option);
                          else if (correctAnswer === option) setCorrectAnswer('');
                        }}
                        disabled={!option}
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => {
                          handleOptionChange(index, e.target.value);
                          // If this option was selected as correct, update the correct answer state too
                          if (correctAnswer === options[index]) {
                            setCorrectAnswer(e.target.value);
                          }
                        }}
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeOption(index)} disabled={options.length <= 2}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption} className="mt-2">
                  <Plus className="w-4 h-4 mr-2" /> Add Option
                </Button>

                {correctAnswer && (
                  <div className="text-sm text-green-600 font-medium mt-2">
                    Correct Answer: {correctAnswer} (Selected)
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Explanation</Label>
                <div className="min-h-[150px]">
                  <ReactQuill
                    theme="snow"
                    value={explanation}
                    onChange={setExplanation}
                    modules={EDITOR_MODULES}
                    formats={EDITOR_FORMATS}
                    className="h-[100px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(course => (
                      <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={subject} onValueChange={(val) => {
                  setSubject(val);
                  setChapter(''); // Reset chapter when subject changes
                }}>
                  <SelectTrigger disabled={!selectedCourse}>
                    <SelectValue placeholder={selectedCourse ? "Select Subject" : "Select Course First"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allSubjects
                      .filter(s => {
                        // Must be in the selected course
                        const course = courses.find(c => c.id === selectedCourse);
                        if (!course?.subjectIds?.includes(s.id)) return false;

                        // If teacher, must be in assigned subjects
                        // Note: assignedSubjects stores strings (Names), s.name checks that.
                        if (userRole === 'teacher') {
                          return assignedSubjects.includes(s.name);
                        }

                        return true;
                      })
                      .map(s => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Chapter</Label>
                <Select value={chapter} onValueChange={setChapter}>
                  <SelectTrigger disabled={!subject}>
                    <SelectValue placeholder={subject ? "Select Chapter" : "Select Subject First"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const selectedSubjectObj = allSubjects.find(s => s.name === subject);
                      const chapters = selectedSubjectObj?.chapters ? Object.keys(selectedSubjectObj.chapters) : [];
                      if (chapters.length === 0) return <SelectItem value="none" disabled>No chapters found</SelectItem>;
                      return chapters.map(ch => (
                        <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Topic</Label>
                <Input placeholder="e.g. Thermodynamics" value={topic} onChange={(e) => setTopic(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between pt-4">
                  <div className="space-y-0.5">
                    <Label>All Options Correct</Label>
                    <div className="text-xs text-muted-foreground">Mark as correct for everyone (e.g. error in question)</div>
                  </div>
                  <Switch checked={allOptionsCorrect} onCheckedChange={setAllOptionsCorrect} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label>Public Question</Label>
                  <div className="text-xs text-muted-foreground">Visible to all students</div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

            </CardContent>
          </Card>

          <Button size="lg" className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditMode ? 'Update Question' : 'Create Question'}
          </Button>
        </div>
      </div>

      <CsvImporter
        isOpen={isCsvDialogOpen}
        onClose={() => {
          setIsCsvDialogOpen(false);
          setImportInitialData(undefined);
        }}
        onImport={handleSmartImport}
        initialData={importInitialData}
        defaultMetadata={{
          Course: courses.find(c => c.id === selectedCourse)?.name || 'Unknown',
          Subject: subject,
          Topic: topic || 'General',
          Difficulty: difficulty,
          // Marks: `${positiveMarks} ${isGrace ? '(Grace Enabled)' : ''}` // Removed
          Status: allOptionsCorrect ? 'All Correct' : 'Normal'
        }}
      />

      <AiBulkGenerateDialog
        isOpen={isAiBulkOpen}
        onClose={() => setIsAiBulkOpen(false)}
        onGenerate={handleAiBulkSuccess}
        defaultMetadata={{
          courseId: selectedCourse,
          subject,
          chapter,
          difficulty
        }}
      />
    </div>
  );
};

const CreateQuestionPage = () => {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading editor...</div>}>
      <CreateQuestionPageContent />
    </Suspense>
  );
};

export default CreateQuestionPage;
