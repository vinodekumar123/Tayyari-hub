'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../../firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BookOpen,
  Plus,
  X,
  Save,
  Upload,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import Papa from 'papaparse';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

type Course = {
  id: string;
  name: string;
  subjectIds: string[];
};

type Subject = {
  id: string;
  name: string;
  chapters: { [key: string]: string[] };
};

type Question = {
  id?: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
  year: string;
  book: string;
  teacher: string;
  course: string;
  enableExplanation: boolean;
  createdAt?: Date;
};

export default function CreateQuestion() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [firestoreCourses, setFirestoreCourses] = useState<Course[]>([]);
  const [firestoreSubjects, setFirestoreSubjects] = useState<Subject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [questionData, setQuestionData] = useState<Question>({
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: '',
    explanation: '',
    subject: '',
    chapter: '',
    topic: '',
    difficulty: '',
    year: '',
    book: '',
    teacher: '',
    course: '',
    enableExplanation: true,
  });

  // Fetch courses from Firestore
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'courses'));
        const courses = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string,
          subjectIds: doc.data().subjectIds as string[] || [],
        })) as Course[];
        setFirestoreCourses(courses);
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  // Fetch subjects from Firestore
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'subjects'));
        const subjects = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name as string,
          chapters: doc.data().chapters as { [key: string]: string[] } || {},
        })) as Subject[];
        setFirestoreSubjects(subjects);
      } catch (err) {
        console.error("Failed to load subjects:", err);
      }
    };

    fetchSubjects();
  }, []);

  // Fetch question if editing
  useEffect(() => {
    const fetchQuestion = async () => {
      if (!id) return;
      try {
        const snapshot = await getDoc(doc(db, "mock-questions", id));
        if (snapshot.exists()) {
          setQuestionData({ ...questionData, ...snapshot.data() } as Question);
        }
      } catch (err) {
        console.error("Failed to load question:", err);
      }
    };

    fetchQuestion();
  }, [id]);

  // Fetch teacher profile metadata only on new question
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !id) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const metadata = userData.metadata || {};
            setQuestionData(prev => ({
              ...prev,
              course: metadata.course || '',
              subject: metadata.subject || '',
              chapter: metadata.chapter || '',
              topic: metadata.topic || '',
              difficulty: metadata.difficulty || '',
              year: metadata.year?.toString() || '',
              book: metadata.book || '',
              teacher: userData.fullName || '',
            }));
          }
        } catch (err) {
          console.error("Failed to load user metadata:", err);
        }
      }
    });

    return () => unsubscribe();
  }, [id]);

  const handleInputChange = (field: keyof Question, value: string | boolean) => {
    setQuestionData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionData.options];
    newOptions[index] = value;
    setQuestionData(prev => ({
      ...prev,
      options: newOptions,
    }));
  };

  const addOption = () => {
    if (questionData.options.length < 6) {
      setQuestionData(prev => ({
        ...prev,
        options: [...prev.options, ''],
      }));
    }
  };

  const removeOption = (index: number) => {
    if (questionData.options.length > 2) {
      const newOptions = questionData.options.filter((_, i) => i !== index);
      setQuestionData(prev => ({
        ...prev,
        options: newOptions,
        correctAnswer: prev.correctAnswer === prev.options[index] ? '' : prev.correctAnswer,
      }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!questionData.questionText.trim()) {
      newErrors.questionText = 'Question text is required';
    }

    if (questionData.options.some(option => !option.trim())) {
      newErrors.options = 'All options must be filled';
    }

    if (!questionData.correctAnswer) {
      newErrors.correctAnswer = 'Please select the correct answer';
    }

    if (!questionData.course) {
      newErrors.course = 'Course is required';
    }

    if (!questionData.subject) {
      newErrors.subject = 'Subject is required';
    }

    if (!questionData.difficulty) {
      newErrors.difficulty = 'Difficulty level is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCsvQuestion = (row: any, index: number) => {
    const errors: string[] = [];
    const requiredFields = ['questionText', 'options', 'correctAnswer', 'course', 'subject', 'difficulty'];
    
    requiredFields.forEach(field => {
      if (!row[field] || (typeof row[field] === 'string' && !row[field].trim())) {
        errors.push(`Row ${index + 1}: ${field} is required`);
      }
    });

    if (row.options) {
      const options = row.options.split('|').map((opt: string) => opt.trim());
      if (options.length < 2) {
        errors.push(`Row ${index + 1}: At least 2 options are required`);
      }
      if (options.some((opt: string) => !opt)) {
        errors.push(`Row ${index + 1}: All options must be non-empty`);
      }
      if (!options.includes(row.correctAnswer)) {
        errors.push(`Row ${index + 1}: Correct answer must match one of the options`);
      }
    }

    if (row.course && !firestoreCourses.some(c => c.name === row.course)) {
      errors.push(`Row ${index + 1}: Invalid course name`);
    }

    if (row.subject && !firestoreSubjects.some(s => s.name === row.subject)) {
      errors.push(`Row ${index + 1}: Invalid subject name`);
    }

    if (row.difficulty && !['Easy', 'Medium', 'Hard'].includes(row.difficulty)) {
      errors.push(`Row ${index + 1}: Invalid difficulty level`);
    }

    return errors;
  };

  const handleCsvUpload = async () => {
    if (!csvFile) {
      setCsvErrors(['No file selected']);
      return;
    }

    setIsSaving(true);
    setCsvErrors([]);

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const questions = result.data as any[];
        const errors: string[] = [];
        const validQuestions: Question[] = [];

        questions.forEach((row, index) => {
          const rowErrors = validateCsvQuestion(row, index);
          if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            return;
          }

          validQuestions.push({
            questionText: row.questionText,
            options: row.options.split('|').map((opt: string) => opt.trim()),
            correctAnswer: row.correctAnswer,
            explanation: row.explanation || '',
            subject: row.subject,
            chapter: row.chapter || '',
            topic: row.topic || '',
            difficulty: row.difficulty,
            year: row.year || '',
            book: row.book || '',
            teacher: row.teacher || questionData.teacher,
            course: row.course,
            enableExplanation: row.enableExplanation ? row.enableExplanation.toLowerCase() === 'true' : true,
            createdAt: new Date(),
          });
        });

        if (errors.length > 0) {
          setCsvErrors(errors);
          setIsSaving(false);
          return;
        }

        try {
          for (const question of validQuestions) {
            await addDoc(collection(db, 'mock-questions'), question);
          }
          setIsCsvDialogOpen(false);
          setCsvFile(null);
          router.push('/admin/mockquestions/questionbank');
        } catch (err) {
          console.error('Failed to import questions:', err);
          setCsvErrors(['Failed to import questions']);
        } finally {
          setIsSaving(false);
        }
      },
      error: (err) => {
        console.error('CSV parsing error:', err);
        setCsvErrors(['Error parsing CSV file']);
        setIsSaving(false);
      },
    });
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);

    try {
      if (id) {
        await updateDoc(doc(db, 'mock-questions', id), questionData);
      } else {
        await addDoc(collection(db, 'mock-questions'), {
          ...questionData,
          createdAt: new Date(),
        });
      }
      router.push('/admin/mockquestions/questionbank');
    } catch (err) {
      console.error('Failed to save question:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCourse = firestoreCourses.find(c => c.name === questionData.course);
  const availableSubjects = firestoreSubjects
    .filter(s => selectedCourse?.subjectIds.includes(s.id))
    .map(s => s.name);
  const selectedSubject = firestoreSubjects.find(s => s.name === questionData.subject);
  const availableChapters = selectedSubject ? Object.keys(selectedSubject.chapters) : [];
  const availableTopics = selectedSubject?.chapters?.[questionData.chapter] || [];
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const years = Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => (2000 + i).toString());

  // ReactQuill toolbar configuration
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
  };

  // Skeleton Loader Component
  const SkeletonCard = () => (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 rounded"></div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-20 w-full bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-10 w-full bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-white rounded-xl">
      <header className="bg-white shadow-sm border-b">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <BookOpen className="text-white h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {id ? 'Edit Mock Question' : 'Create Mock Question'}
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            <Dialog open={isCsvDialogOpen} onOpenChange={setIsCsvDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  <Upload className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">Import Questions from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-gray-600">
                    Upload a CSV file with the following columns: questionText, options (pipe-separated), correctAnswer, course, subject, difficulty, explanation (optional), chapter (optional), topic (optional), year (optional), book (optional), teacher (optional), enableExplanation (true/false).
                  </p>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="border-gray-300"
                  />
                  {csvErrors.length > 0 && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      <ul className="list-disc pl-5">
                        {csvErrors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCsvDialogOpen(false);
                      setCsvFile(null);
                      setCsvErrors([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCsvUpload}
                    disabled={isSaving || !csvFile}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSaving ? 'Importing...' : 'Import'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="space-y-8">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Error Alert */}
            {(errors.questionText || errors.options || errors.correctAnswer || errors.course || errors.subject || errors.difficulty) && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <ul className="list-disc pl-5">
                    {errors.questionText && <li>{errors.questionText}</li>}
                    {errors.options && <li>{errors.options}</li>}
                    {errors.correctAnswer && <li>{errors.correctAnswer}</li>}
                    {errors.course && <li>{errors.course}</li>}
                    {errors.subject && <li>{errors.subject}</li>}
                    {errors.difficulty && <li>{errors.difficulty}</li>}
                  </ul>
                </div>
              </div>
            )}

            {/* Question Content */}
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Question Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="questionText" className="text-sm font-medium text-gray-700">
                    Question Text *
                  </Label>
                  <ReactQuill
                    theme="snow"
                    value={questionData.questionText}
                    onChange={(value) => handleInputChange('questionText', value)}
                    modules={quillModules}
                    className={`bg-white ${errors.questionText ? 'border-red-500 border-2 rounded' : ''}`}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium text-gray-700">Answer Options *</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      disabled={questionData.options.length >= 6}
                      className="border-gray-300 hover:bg-gray-100"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {questionData.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <span className="font-medium text-gray-600 w-8">{String.fromCharCode(65 + index)}.</span>
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="flex-1"
                        />
                        <Checkbox
                          checked={questionData.correctAnswer === option}
                          onCheckedChange={(checked) => {
                            if (checked) handleInputChange('correctAnswer', option);
                          }}
                          className="h-5 w-5"
                        />
                        {questionData.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOption(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={questionData.enableExplanation}
                      onCheckedChange={(checked) => handleInputChange('enableExplanation', checked)}
                      className="h-5 w-5"
                    />
                    <Label className="text-sm font-medium text-gray-700">Enable Explanation</Label>
                  </div>
                  {questionData.enableExplanation && (
                    <Textarea
                      placeholder="Provide explanation..."
                      value={questionData.explanation}
                      onChange={(e) => handleInputChange('explanation', e.target.value)}
                      rows={3}
                      className="mt-1"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Question Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Course *</Label>
                    <Select value={questionData.course} onValueChange={(val) => handleInputChange('course', val)}>
                      <SelectTrigger className={`mt-1 ${errors.course ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {firestoreCourses.map(course => (
                          <SelectItem key={course.id} value={course.name}>{course.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Subject *</Label>
                    <Select
                      value={questionData.subject}
                      onValueChange={(val) => handleInputChange('subject', val)}
                      disabled={!questionData.course}
                    >
                      <SelectTrigger className={`mt-1 ${errors.subject ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSubjects.map(sub => (
                          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Chapter</Label>
                    <Select
                      value={questionData.chapter}
                      onValueChange={(val) => handleInputChange('chapter', val)}
                      disabled={!questionData.subject}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select chapter" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableChapters.map(ch => (
                          <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Topic</Label>
                    <Select
                      value={questionData.topic}
                      onValueChange={(val) => handleInputChange('topic', val)}
                      disabled={availableTopics.length === 0}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select topic" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTopics.map(topic => (
                          <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Difficulty *</Label>
                    <Select
                      value={questionData.difficulty}
                      onValueChange={(val) => handleInputChange('difficulty', val)}
                    >
                      <SelectTrigger className={`mt-1 ${errors.difficulty ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        {difficulties.map(diff => (
                          <SelectItem key={diff} value={diff}>{diff}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Year</Label>
                    <Select value={questionData.year} onValueChange={(val) => handleInputChange('year', val)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700">Book</Label>
                    <Input
                      value={questionData.book}
                      onChange={(e) => handleInputChange('book', e.target.value)}
                      placeholder="Reference book"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Teacher</Label>
                  <Input
                    value={questionData.teacher}
                    onChange={(e) => handleInputChange('teacher', e.target.value)}
                    placeholder="Your name"
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end space-x-4">
              <Button
                variant="outline"
                className="border-gray-300 hover:bg-gray-100 transition-colors"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                disabled={isSaving}
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                {isSaving ? 'Saving...' : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Question
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}