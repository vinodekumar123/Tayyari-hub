'use client';

import { useState } from 'react';
import { db } from '../../../firebase'; // adjust path if needed
import {
  collection,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { useEffect } from 'react';
import { useSearchParams } from "next/navigation";
import { getDoc, doc } from "firebase/firestore";
import { updateDoc } from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  Plus, 
  Minus, 
  Save, 
  Upload,
  Download,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CreateQuestion() {
  const router = useRouter();
const [firestoreCourses, setFirestoreCourses] = useState<any[]>([]);
const searchParams = useSearchParams();
const id = searchParams.get("id");
const [isSaving, setIsSaving] = useState(false);

  const [questionData, setQuestionData] = useState({
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
    enableExplanation: true
  });

  const [previewMode, setPreviewMode] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const courses = [
    { id: 'mdcat', name: 'MDCAT' },
    { id: 'ecat', name: 'ECAT' },
    { id: 'lat', name: 'LAT' }
  ];

  const subjects = {
    mdcat: ['Biology', 'Chemistry', 'Physics'],
    ecat: ['Mathematics', 'Physics', 'Chemistry'],
    lat: ['English', 'General Knowledge', 'Current Affairs']
  };

  const chapters = {
    'Biology': ['Cell Structure', 'Genetics', 'Evolution', 'Ecology', 'Human Biology'],
    'Chemistry': ['Atomic Structure', 'Chemical Bonding', 'Organic Chemistry', 'Inorganic Chemistry'],
    'Physics': ['Mechanics', 'Thermodynamics', 'Electromagnetism', 'Modern Physics'],
    'Mathematics': ['Algebra', 'Calculus', 'Trigonometry', 'Statistics', 'Geometry']
  };
useEffect(() => {
  const fetchCourses = async () => {
    const snapshot = await getDocs(collection(db, 'courses'));
    const courseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    setFirestoreCourses(courseList);
  };

  fetchCourses();
}, []);
useEffect(() => {
  const fetchQuestion = async () => {
    if (!id) return;
    try {
      const snapshot = await getDoc(doc(db, "questions", id));
      if (snapshot.exists()) {
        const data = snapshot.data();
        setQuestionData({
          ...questionData,
          ...data
        });
      }
    } catch (err) {
      console.error("Failed to load question:", err);
    }
  };

  fetchQuestion();
}, [id]);
const handleSave = async () => {
  if (!validateForm()) return;
  setIsSaving(true);

  try {
    if (id) {
      await updateDoc(doc(db, "questions", id), questionData);
    } else {
      await addDoc(collection(db, "questions"), {
        ...questionData,
        createdAt: new Date()
      });
    }
    router.push("/admin/questions/questionbank");
  } catch (err) {
    console.error("Failed to save question:", err);
  } finally {
    setIsSaving(false);
  }
};


  const difficulties = ['Easy', 'Medium', 'Hard'];
  const years = Array.from({ length: 10 }, (_, i) => (new Date().getFullYear() - i).toString());
const selectedFirestoreCourse = firestoreCourses.find(c => c.name === questionData.course);

const availableSubjects = selectedFirestoreCourse?.subjects || [];

const availableChapters = selectedFirestoreCourse?.chapters?.[questionData.subject] 
  ? Object.keys(selectedFirestoreCourse.chapters[questionData.subject])
  : [];

const selectedChapter = selectedFirestoreCourse?.chapters?.[questionData.subject]?.[questionData.chapter];
const availableTopics = Array.isArray(selectedChapter) ? selectedChapter : [];



  const handleInputChange = (field: string, value: any) => {
    setQuestionData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionData.options];
    newOptions[index] = value;
    setQuestionData(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const addOption = () => {
    if (questionData.options.length < 6) {
      setQuestionData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index: number) => {
    if (questionData.options.length > 2) {
      const newOptions = questionData.options.filter((_, i) => i !== index);
      setQuestionData(prev => ({
        ...prev,
        options: newOptions,
        correctAnswer: prev.correctAnswer === prev.options[index] ? '' : prev.correctAnswer
      }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};

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



  const handleBulkImport = () => {
    // Bulk import logic
    console.log('Bulk import triggered');
  };

  const selectedCourse = courses.find(c => c.id === questionData.course);
 

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
<span className="text-xl font-bold text-gray-900">
  {id ? "Edit Question" : "Create Question"}
</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
             
              <Button variant="outline" onClick={handleBulkImport}>
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </Button>
             
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {previewMode ? (
          /* Preview Mode */
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Question Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {questionData.questionText || 'Question text will appear here...'}
                    </h3>
                    <div className="space-y-3">
                      {questionData.options.map((option, index) => (
                        <div key={index} className="flex items-center space-x-3">
                          <input
                            type="radio"
                            name="preview-answer"
                            id={`preview-option-${index}`}
                            className="h-4 w-4 text-blue-600"
                            disabled
                          />
                          <label htmlFor={`preview-option-${index}`} className="flex-1 p-3 border rounded-lg">
                            <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                            {option || `Option ${index + 1}`}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ml-6">
                    <div className="space-y-2">
                      {questionData.course && <Badge variant="secondary">{questionData.course}</Badge>}
                      {questionData.subject && <Badge variant="outline">{questionData.subject}</Badge>}
                      {questionData.difficulty && (
                        <Badge variant={
                          questionData.difficulty === 'Easy' ? 'secondary' :
                          questionData.difficulty === 'Medium' ? 'default' : 'destructive'
                        }>
                          {questionData.difficulty}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {questionData.enableExplanation && questionData.explanation && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">Explanation</h4>
                    <p className="text-blue-700">{questionData.explanation}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Edit Mode */
          <div className="space-y-8">
            {/* Question Content */}
            <Card>
              <CardHeader>
                <CardTitle>Question Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="questionText">Question Text *</Label>
                  <Textarea
                    id="questionText"
                    placeholder="Enter your question here..."
                    value={questionData.questionText}
                    onChange={(e) => handleInputChange('questionText', e.target.value)}
                    rows={3}
                    className={errors.questionText ? 'border-red-500' : ''}
                  />
                  {errors.questionText && (
                    <p className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.questionText}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Answer Options *</Label>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addOption}
                        disabled={questionData.options.length >= 6}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Option
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {questionData.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <span className="font-medium text-gray-600 w-8">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="flex-1"
                        />
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={questionData.correctAnswer === option}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handleInputChange('correctAnswer', option);
                              }
                            }}
                          />
                          <span className="text-sm text-gray-600">Correct</span>
                          {questionData.options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOption(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {errors.options && (
                    <p className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.options}
                    </p>
                  )}
                  
                  {errors.correctAnswer && (
                    <p className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {errors.correctAnswer}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enableExplanation"
                      checked={questionData.enableExplanation}
                      onCheckedChange={(checked) => handleInputChange('enableExplanation', checked)}
                    />
                    <Label htmlFor="enableExplanation">Enable Explanation</Label>
                  </div>
                  
                  {questionData.enableExplanation && (
                    <div className="space-y-2">
                      <Label htmlFor="explanation">Explanation</Label>
                      <Textarea
                        id="explanation"
                        placeholder="Provide an explanation for the correct answer..."
                        value={questionData.explanation}
                        onChange={(e) => handleInputChange('explanation', e.target.value)}
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Question Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Question Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="course">Course *</Label>
                    <Select 
                      value={questionData.course} 
                      onValueChange={(value) => handleInputChange('course', value)}
                    >
                      <SelectTrigger className={errors.course ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                    {firestoreCourses.map(course => (
  <SelectItem key={course.id} value={course.name}>
    {course.name}
  </SelectItem>
))}

                      </SelectContent>
                    </Select>
                    {errors.course && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.course}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Select 
                      value={questionData.subject} 
                      onValueChange={(value) => handleInputChange('subject', value)}
                      disabled={!questionData.course}
                    >
                      <SelectTrigger className={errors.subject ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                  <SelectContent>
  {availableSubjects.map(subject => (
    <SelectItem key={subject} value={subject}>
      {subject}
    </SelectItem>
  ))}
</SelectContent>

                    </Select>
                    {errors.subject && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.subject}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="chapter">Chapter</Label>
                    <Select 
                      value={questionData.chapter} 
                      onValueChange={(value) => handleInputChange('chapter', value)}
                      disabled={!questionData.subject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select chapter" />
                      </SelectTrigger>
<SelectContent>
  {availableChapters.map((chapter) => (
    <SelectItem key={chapter} value={chapter}>
      {chapter}
    </SelectItem>
  ))}
</SelectContent>


                    </Select>
                  </div>

 <div className="space-y-2">
  <Label htmlFor="topic">Topic</Label>
  <Select
    value={questionData.topic}
    onValueChange={(value) => handleInputChange('topic', value)}
    disabled={availableTopics.length === 0}
  >
    <SelectTrigger>
      <SelectValue placeholder="Select topic" />
    </SelectTrigger>
    <SelectContent>
      {availableTopics.map((topic) => (
        <SelectItem key={topic} value={topic}>
          {topic}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>



                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">Difficulty *</Label>
                    <Select 
                      value={questionData.difficulty} 
                      onValueChange={(value) => handleInputChange('difficulty', value)}
                    >
                      <SelectTrigger className={errors.difficulty ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        {difficulties.map(difficulty => (
                          <SelectItem key={difficulty} value={difficulty}>
                            {difficulty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.difficulty && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.difficulty}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Select 
                      value={questionData.year} 
                      onValueChange={(value) => handleInputChange('year', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(year => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="book">Book/Reference</Label>
                    <Input
                      id="book"
                      placeholder="Enter book name"
                      value={questionData.book}
                      onChange={(e) => handleInputChange('book', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher">Teacher/Source</Label>
                  <Input
                    id="teacher"
                    placeholder="Enter teacher or source name"
                    value={questionData.teacher}
                    onChange={(e) => handleInputChange('teacher', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex justify-end space-x-4">
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
           <Button
  disabled={isSaving}
  onClick={handleSave}
  className="bg-blue-600 hover:bg-blue-700"
>
  {isSaving ? (
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      <span>Saving...</span>
    </div>
  ) : (
    <>
      <Save className="h-4 w-4 mr-2" />
      Save Question
    </>
  )}
</Button>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}