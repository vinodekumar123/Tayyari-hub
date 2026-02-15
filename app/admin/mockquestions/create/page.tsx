'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import dynamic from 'next/dynamic';
import { CsvImporter } from '@/components/admin/CsvImporter';
import { SanitizedContent } from '@/components/SanitizedContent';
import 'react-quill-new/dist/quill.snow.css';
import { generateSearchTokens } from '@/lib/searchUtils';

import { db, auth, storage } from '../../../firebase';
import {
  collection,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  type QuerySnapshot,
  type DocumentData,
  writeBatch
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';


import { AiBulkGenerateDialog } from '@/components/admin/AiBulkGenerateDialog';
import {
  RotateCcw,
  CheckCircle2,
  Image as ImageIcon,
  Link as LinkIcon,
  Book as BookIcon,
  Hash,
  Sigma,
  Plus,
  X,
  ArrowLeft,
  Save,
  Upload,
  Eye,
  Wand2,
  FileText,
  AlertCircle,
  History,
  Download,
  Sparkles,
  Loader2
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    const { default: ImageResize } = await import('quill-image-resize-module-react');

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
        Quill.register('modules/imageResize', ImageResize);
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
    ['link', 'image', 'video'],
    ['clean']
  ],
  imageResize: {
    displaySize: true
  }
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
  description: string;
  subjectIds: string[];
}

interface Subject {
  id: string;
  name: string;
  chapters: { [chapter: string]: string[] | Record<string, unknown> | string };
}

interface Question {
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
  courses?: string[]; // Multi-course tagging
  enableExplanation: boolean;
  status: 'draft' | 'published';
  createdAt?: Date;
  // Reference Management
  bookName?: string;
  pageNumber?: string;
  sourceUrl?: string;
  teacherNotes?: string;
  version?: number;
  isDeleted?: boolean;
  isGrace?: boolean;
}

const INITIAL_QUESTION: Question = {
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  subject: '',
  chapter: '',
  topic: '',
  difficulty: 'Medium',
  year: '',
  book: '',
  teacher: '',
  course: '',
  courses: [],
  enableExplanation: true,
  status: 'published',
  bookName: '',
  pageNumber: '',
  sourceUrl: '',
  teacherNotes: '',
  version: 1,
  isDeleted: false,
  isGrace: false,
};

function CreateQuestionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  // State
  const [firestoreCourses, setFirestoreCourses] = useState<Course[]>([]);
  const [firestoreSubjects, setFirestoreSubjects] = useState<Subject[]>([]);
  const [questionData, setQuestionData] = useState<Question>(INITIAL_QUESTION);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState("editor");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  // CSV State - Only need dialog visibility
  const [isCsvDialogOpen, setIsCsvDialogOpen] = useState(false);
  const [importInitialData, setImportInitialData] = useState<any[] | undefined>(undefined);

  // AI Bulk State
  const [isAiBulkOpen, setIsAiBulkOpen] = useState(false);
  const [isAiBulkLoading, setIsAiBulkLoading] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const quillRef = useRef<any>(null);

  // Draft Auto-Save Key
  const DRAFT_KEY = 'question_draft';

  // Load Courses & Subjects
  useEffect(() => {
    const unsubscribeCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setFirestoreCourses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
      setIsLoading(false);
    });
    const unsubscribeSubjects = onSnapshot(collection(db, 'subjects'), (snapshot) => {
      setFirestoreSubjects(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
    });
    return () => { unsubscribeCourses(); unsubscribeSubjects(); };
  }, []);

  // Load Existing Question OR Draft
  useEffect(() => {
    const load = async () => {
      if (id) {
        const docSnap = await getDoc(doc(db, "mock-questions", id));
        if (docSnap.exists()) {
          setQuestionData({ ...INITIAL_QUESTION, ...docSnap.data() as Question, id: docSnap.id });
        } else {
          toast.error("Question not found");
        }
      } else {
        // Check for local draft if creating new
        const draft = localStorage.getItem(DRAFT_KEY);
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            // Ask user if they want to restore? For now just restore silently or maybe a toast
            setQuestionData({ ...INITIAL_QUESTION, ...parsed });
            toast.info("Restored draft from previous session");
          } catch (e) { }
        }
      }
    };
    load();
  }, [id]);

  const fetchHistory = async () => {
    if (!id) return;
    try {
      const q = query(collection(db, 'mock-questions', id, 'history'), orderBy('snapshotAt', 'desc'));
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      toast.error("Failed to load history");
    }
  };

  const handleRollback = (snapshot: any) => {
    // Exclude metadata that shouldn't be rolled back or needs manual check
    const { snapshotAt, id: snapshotId, version: snapshotVersion, ...rest } = snapshot;
    setQuestionData(prev => ({
      ...prev,
      ...rest,
      version: (prev.version || 0) + 1 // New version after rollback
    }));
    setIsHistoryOpen(false);
    toast.success(`Rolled back to version ${snapshotVersion}`);
  };

  // Auto-save draft
  useEffect(() => {
    if (!id) {
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(questionData));
        } catch (e) {
          console.warn("Draft auto-save failed (likely quota exceeded):", e);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [questionData, id]);

  const handleInputChange = (field: keyof Question, value: any) => {
    setQuestionData(prev => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...questionData.options];
    newOptions[index] = value;
    setQuestionData(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    if (questionData.options.length < 6) {
      setQuestionData(prev => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  const removeOption = (index: number) => {
    if (questionData.options.length > 2) {
      const newOpts = questionData.options.filter((_, i) => i !== index);
      setQuestionData(prev => ({ ...prev, options: newOpts }));
    }
  };

  const validate = useCallback(() => {
    if (!questionData.questionText) { toast.error("Question text is required"); return false; }
    if (!questionData.correctAnswer) { toast.error("Correct answer required"); return false; }
    if (questionData.options.some(o => !o)) { toast.error("All options must be filled"); return false; }
    if (!questionData.course || !questionData.subject) { toast.error("Metadata missing"); return false; }
    return true;
  }, [questionData]);

  const getAuthHeader = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');
    return { Authorization: `Bearer ${token}` };
  };

  const syncToAlgolia = async (id: string, data: any) => {
    try {
      const authHeader = await getAuthHeader();
      await fetch('/api/admin/sync-algolia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ questionId: id, data, type: 'mock' })
      });
    } catch (e) {
      console.error('Algolia sync failed', e);
    }
  };

  const handleSave = useCallback(async (status: 'draft' | 'published' = 'published') => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const dataToSave = {
        ...questionData,
        status,
        updatedAt: new Date(),
        version: (questionData.version || 0) + 1,
        isDeleted: questionData.isDeleted ?? false,
        searchTokens: generateSearchTokens(questionData.questionText)
      };

      if (id) {
        await updateDoc(doc(db, 'mock-questions', id), dataToSave);
        await syncToAlgolia(id, dataToSave);
        // Create history snapshot
        await addDoc(collection(db, 'mock-questions', id, 'history'), {
          ...questionData,
          snapshotAt: new Date()
        });
        toast.success("Question updated!");
      } else {
        const docRef = await addDoc(collection(db, 'mock-questions'), { ...dataToSave, createdAt: new Date() });
        await syncToAlgolia(docRef.id, dataToSave);
        toast.success("Question created successfully!");
        localStorage.removeItem(DRAFT_KEY);
        setQuestionData(INITIAL_QUESTION);
      }
      router.push('/admin/mockquestions/questionbank');
    } catch (e) {
      console.error(e);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [validate, questionData, id, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!storage) {
      toast.error("Storage not initialized");
      return;
    }

    toast.promise(
      async () => {
        const sRef = ref(storage, `questions/images/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(sRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log("Image uploaded successfully:", url);

        // Insert into editor at cursor position
        if (quillRef.current) {
          const editor = quillRef.current.getEditor();
          const range = editor.getSelection();
          const index = range ? range.index : editor.getLength();

          console.log("Attempting to insert image at index:", index);

          // Method 1: Standard insertEmbed
          editor.insertEmbed(index, 'image', url, 'user');

          // Verify if it worked, if not use Method 2
          setTimeout(() => {
            const currentHtml = editor.root.innerHTML;
            if (!currentHtml.includes(url)) {
              console.warn("insertEmbed failed to show URL in HTML, trying dangerouslyPasteHTML");
              editor.clipboard.dangerouslyPasteHTML(index, `<img src="${url}" alt="Question Image" />`, 'user');
            }
            // Manually trigger state update to be safe
            handleInputChange('questionText', editor.root.innerHTML);
          }, 100);

        } else {
          console.warn("Quill ref not found, falling back to string concatenation");
          handleInputChange('questionText', questionData.questionText + `<p><img src="${url}" alt="Question Image" /></p>`);
        }
        return url;
      },
      {
        loading: 'Uploading image...',
        success: 'Image uploaded and inserted!',
        error: 'Upload failed',
      }
    );
  };

  // LaTeX Preview Helper
  const renderContentWithLatex = (content: string) => {
    if (!content) return null;
    // Simple regex to split by $$...$$ or $...$
    // This is a basic implementation, for complex needs use a dedicated parser
    const parts = content.split(/(\$\$.*?\$\$|\$.*?\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        return <BlockMath key={i} math={part.slice(2, -2)} />;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={i} math={part.slice(1, -1)} />;
      }
      return <SanitizedContent key={i} as="span" content={part} />;
    });
  };

  const handleAiRefine = async (type: 'options' | 'explanation' | 'simplify') => {
    if (!questionData.questionText && type !== 'options') {
      toast.error("Enter question text first");
      return;
    }
    setIsGeneratingAI(true);
    try {
      let prompt = '';
      if (type === 'options') prompt = `Based on this question: "${questionData.questionText}", suggest 4 plausible MCQ options including one correct answer. Return ONLY a JSON object with keys "options" (array of 4 strings) and "correctAnswer" (string, must be one of the options).`;
      if (type === 'explanation') prompt = `Based on this question: "${questionData.questionText}" and correct answer: "${questionData.correctAnswer}", generate a detailed explanation. Return ONLY the explanation text.`;
      if (type === 'simplify') prompt = `Simplify the language of this question: "${questionData.questionText}". Return ONLY the simplified text.`;

      const authHeader = await getAuthHeader();
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          prompt,
          subject: questionData.subject,
          difficulty: questionData.difficulty
        }),
      });

      const result = await response.json();
      if (result.success) {
        if (type === 'options' && result.data.options) {
          handleInputChange('options', result.data.options);
          handleInputChange('correctAnswer', result.data.correctAnswer);
          toast.success("Options suggested!");
        } else if (type === 'explanation') {
          handleInputChange('explanation', result.data.explanation || result.data);
          handleInputChange('enableExplanation', true);
          toast.success("Explanation generated!");
        } else if (type === 'simplify') {
          handleInputChange('questionText', result.data.questionText || result.data);
          toast.success("Language simplified!");
        }
      }
    } catch (e) {
      toast.error("AI Refinement failed");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Real AI Generation
  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsGeneratingAI(true);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({
          prompt: aiPrompt,
          subject: questionData.subject,
          difficulty: questionData.difficulty
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch from AI');
      }

      setQuestionData(prev => ({
        ...prev,
        questionText: data.questionText || prev.questionText,
        options: Array.isArray(data.options) ? data.options : prev.options,
        correctAnswer: data.correctAnswer || data.options?.[0] || '',
        explanation: data.explanation || '',
        topic: data.topic || prev.topic,
        difficulty: data.difficulty || prev.difficulty,
      }));

      toast.success("AI generated a question successfully!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to generate question. Try again.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAiBulkSuccess = (data: any[]) => {
    setImportInitialData(data);
    setIsCsvDialogOpen(true); // Open CSV/Preview Dialog directly
  };

  const handleSmartImport = async (importedData: any[]) => {
    setIsSaving(true);
    let successCount = 0;
    try {
      const batch = writeBatch(db);

      for (const row of importedData) {
        // Image Handling from raw CSV row
        let questionText = row.questionText;
        if (row.imageUrl || row.image) {
          questionText += `<br/><img src="${row.imageUrl || row.image}" alt="Imported Image" />`;
        }

        const data = {
          questionText,
          options: [row.option1, row.option2, row.option3, row.option4].filter(Boolean),
          correctAnswer: row.correctAnswer,
          explanation: row.explanation || '',
          difficulty: row.difficulty || 'Medium',

          // Use Row Metadata if Present, else Global Defaults
          course: row.course || questionData.course,
          subject: row.subject || questionData.subject,
          chapter: row.chapter || questionData.chapter,
          topic: row.topic || questionData.topic,

          status: 'published',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isDeleted: false,
          isGrace: row.isGrace === 'true' || row.isGrace === true,
          searchTokens: generateSearchTokens(questionText),
        };
        const newDocRef = doc(collection(db, 'mock-questions'));
        batch.set(newDocRef, data);
        await syncToAlgolia(newDocRef.id, data);
        successCount++;
      }

      await batch.commit();
      toast.success(`Successfully imported ${successCount} questions!`);
      setIsCsvDialogOpen(false);
      router.push('/admin/mockquestions/questionbank');

    } catch (err) {
      console.error(err);
      toast.error("Failed to save imported questions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetMetadata = () => {
    setQuestionData(prev => ({
      ...prev,
      course: '',
      courses: [], // Reset selected courses array
      subject: '',
      chapter: '',
      topic: '',
      difficulty: 'Medium',
      year: '',
      book: '',
    }));
    toast.info("Metadata reset to defaults");
  };

  // Helpers for Selects
  const selectedCourse = firestoreCourses.find(c => c.name === questionData.course);
  const filteredSubjects = selectedCourse ? firestoreSubjects.filter(s => selectedCourse.subjectIds.includes(s.id)) : [];
  const selectedSubjectObj = firestoreSubjects.find(s => s.name === questionData.subject);
  const chapters = selectedSubjectObj ? Object.keys(selectedSubjectObj.chapters || {}) : [];

  // Topics handling
  const rawTopics = (selectedSubjectObj && questionData.chapter) ? selectedSubjectObj.chapters[questionData.chapter] : null;
  const topics: string[] = Array.isArray(rawTopics) ? rawTopics : typeof rawTopics === 'object' ? Object.keys(rawTopics || {}) : [];

  // Keyboard Shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [handleSave]);

  // Render
  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8">
      {/* React Quill Dark Mode Overrides */}
      <style jsx global>{`
        .dark .ql-toolbar {
          background-color: #1f2937;
          border-color: #374151;
          color: #e5e7eb;
        }
        .dark .ql-container {
          background-color: #111827;
          border-color: #374151;
          color: #f3f4f6;
        }
        .dark .ql-stroke {
          stroke: #e5e7eb !important;
        }
        .dark .ql-fill {
          fill: #e5e7eb !important;
        }
        .dark .ql-picker {
          color: #e5e7eb !important;
        }
        .dark .ql-picker-options {
          background-color: #1f2937 !important;
          border-color: #374151 !important;
        }
        /* Fix overlapping issues and internal scrolling */
        .ql-container.ql-snow {
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          background-color: white;
        }
        .dark .ql-container.ql-snow {
          background-color: #111827;
        }
        .ql-editor {
          min-height: 200px;
          max-height: 600px;
          overflow-y: auto;
          font-size: 1rem;
        }
        .ql-toolbar.ql-snow {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          border-color: #e5e7eb;
        }
        .dark .ql-toolbar.ql-snow {
          border-color: #374151;
        }
        /* Mobile Preview and Editor Image Styles */
        .preview-container img, .ql-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
          display: block;
        }
      `}</style>

      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full dark:hover:bg-gray-800">
            <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-300" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{id ? 'Edit Question' : 'Create Question'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-gray-500 dark:text-gray-400">
                {id ? `Editing Version ${questionData.version || 1}` : 'Design high-quality questions for your students.'}
              </p>
              {id && (
                <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                  <SheetTrigger asChild>
                    <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 dark:text-blue-400 font-normal" onClick={fetchHistory}>
                      View History
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[400px] sm:w-[540px] dark:bg-gray-950 dark:border-gray-800">
                    <SheetHeader>
                      <SheetTitle>Version History</SheetTitle>
                      <SheetDescription>
                        View previous versions and rollback if needed.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4 overflow-y-auto max-h-[calc(100vh-150px)] pr-2">
                      {history.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No history found for this question.</p>
                      ) : (
                        history.map((h, i) => (
                          <Card key={h.id} className="dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
                            <CardHeader className="py-3 px-4 bg-gray-50 dark:bg-gray-800/50 flex flex-row justify-between items-center">
                              <div>
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Version {h.version || 'Unknown'}</span>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{h.snapshotAt?.toDate()?.toLocaleString()}</p>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => handleRollback(h)} className="h-8 text-xs">
                                <RotateCcw className="h-3 w-3 mr-1" /> Rollback
                              </Button>
                            </CardHeader>
                            <CardContent className="py-3 px-4">
                              <SanitizedContent className="text-xs text-gray-600 dark:text-gray-300 mb-2" content={h.questionText} />
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-[10px] py-0">{h.difficulty}</Badge>
                                <Badge variant="outline" className="text-[10px] py-0">{h.subject}</Badge>
                                {h.status === 'published' && <Badge className="text-[10px] py-0 bg-green-500/10 text-green-600 border-green-500/20">Published</Badge>}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (!questionData.course || !questionData.subject) {
                toast.error("Please select Course and Subject first");
                return;
              }
              setIsAiBulkLoading(true);
              setTimeout(() => {
                setIsAiBulkOpen(true);
                setIsAiBulkLoading(false);
              }, 800);
            }}
            className="bg-white dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            {isAiBulkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-500" />}
            AI Bulk Import
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setImportInitialData(undefined);
              if (!questionData.course || !questionData.subject) {
                toast.error("Please select Course and Subject first");
                return;
              }
              setIsCsvDialogOpen(true)
            }}
            className="bg-white dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <Upload className="mr-2 h-4 w-4" /> Import CSV
          </Button>
          <Button onClick={() => handleSave('published')} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600">
            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Question'}
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Editor */}
        <div className="lg:col-span-2 space-y-6">

          {/* AI & Quick Tools */}
          <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
            <CardHeader className="py-4">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Wand2 className="h-5 w-5" /> AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
                  onClick={() => handleAiRefine('options')}
                  disabled={isGeneratingAI}
                >
                  <Wand2 className="h-4 w-4 mr-1" /> Suggest Options
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                  onClick={() => handleAiRefine('explanation')}
                  disabled={isGeneratingAI}
                >
                  <FileText className="h-4 w-4 mr-1" /> Generate Explanation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                  onClick={() => handleAiRefine('simplify')}
                  disabled={isGeneratingAI}
                >
                  <RotateCcw className="h-4 w-4 mr-1" /> Simplify Language
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a topic (e.g., 'Photosynthesis')..."
                  className="bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 placeholder:text-gray-400"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                />
                <Button onClick={handleAiGenerate} disabled={isGeneratingAI || !aiPrompt} className="dark:bg-blue-700 dark:hover:bg-blue-600">
                  {isGeneratingAI ? 'Generating...' : 'Generate New'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg shadow-gray-200/50 dark:shadow-none border-0 dark:border dark:border-gray-800 dark:bg-gray-900">
            <CardHeader>
              <CardTitle>Question Content</CardTitle>
              <CardDescription>Compose your question text and options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Editor */}
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <Label className="text-base dark:text-gray-300">Question Text</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 cursor-pointer relative" asChild>
                      <label>
                        <ImageIcon className="h-3.5 w-3.5" /> Image
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => handleInputChange('questionText', questionData.questionText + ' $$E=mc^2$$ ')}>
                      <Sigma className="h-3.5 w-3.5" /> Equation
                    </Button>
                  </div>
                </div>
                <ReactQuill
                  forwardedRef={quillRef}
                  theme="snow"
                  value={questionData.questionText}
                  onChange={(val: string) => handleInputChange('questionText', val)}
                  modules={EDITOR_MODULES}
                  formats={EDITOR_FORMATS}
                  className="dark:text-gray-100"
                />
              </div>

              {/* Options Section with Border Separator */}
              <div className="space-y-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="flex justify-between items-center">
                  <Label className="text-base dark:text-gray-300">Answer Options</Label>
                  <Button variant="ghost" size="sm" onClick={addOption} className="text-blue-600 dark:text-blue-400 dark:hover:bg-gray-800">
                    <Plus className="h-4 w-4 mr-1" /> Add Option
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {questionData.options.map((opt, idx) => (
                    <div key={idx} className="flex gap-3 items-center group">
                      <div className={`
                                            flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700
                                            text-sm font-bold text-gray-500 dark:text-gray-400
                                            ${opt === questionData.correctAnswer ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800 text-green-700 dark:text-green-300' : ''}
                                         `}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <Input
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleInputChange('correctAnswer', opt)}
                          className={`p-2 rounded-full transition-colors ${questionData.correctAnswer === opt ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'text-gray-300 dark:text-gray-600 hover:text-green-600 dark:hover:text-green-400'}`}
                          title="Mark as correct"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => removeOption(idx)}
                          className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={questionData.enableExplanation}
                    onCheckedChange={c => handleInputChange('enableExplanation', c)}
                  />
                  <Label className="dark:text-gray-300">Enable Explanation</Label>
                </div>
                {questionData.enableExplanation && (
                  <div className="space-y-2">
                    <ReactQuill
                      theme="snow"
                      value={questionData.explanation}
                      onChange={(val: string) => handleInputChange('explanation', val)}
                      modules={EDITOR_MODULES}
                      formats={EDITOR_FORMATS}
                      placeholder="Explain why the answer is correct..."
                      className="dark:text-gray-100"
                    />
                  </div>
                )}
              </div>

              {/* Reference Management */}
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <BookIcon className="h-4 w-4 text-blue-500" />
                  <h3 className="font-semibold text-sm">Reference Management</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Book Name</Label>
                    <Input
                      placeholder="e.g. NCERT Physics"
                      value={questionData.bookName}
                      onChange={e => handleInputChange('bookName', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Page Number</Label>
                    <Input
                      placeholder="e.g. 142"
                      value={questionData.pageNumber}
                      onChange={e => handleInputChange('pageNumber', e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Source URL (if any)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://..."
                      value={questionData.sourceUrl}
                      onChange={e => handleInputChange('sourceUrl', e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => window.open(questionData.sourceUrl, '_blank')} disabled={!questionData.sourceUrl}>
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Teacher Notes (Internal)</Label>
                  <Textarea
                    placeholder="Hidden from students..."
                    value={questionData.teacherNotes}
                    onChange={e => handleInputChange('teacherNotes', e.target.value)}
                    className="min-h-[80px] text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Metadata & Preview */}
        <div className="space-y-6 lg:sticky lg:top-8 self-start">

          {/* Mobile Preview Sticky */}
          <Card className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
            <CardHeader className="bg-gray-50/80 dark:bg-gray-800/50 py-3 border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <Eye className="h-4 w-4" />
                </div>
                Live Mobile Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
              <div className="prose prose-sm dark:prose-invert max-w-none mb-6">
                {questionData.questionText ? (
                  <div className="preview-container leading-relaxed">
                    {renderContentWithLatex(questionData.questionText)}
                  </div>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 italic">Start typing question...</p>
                )}
              </div>
              <div className="space-y-3">
                {questionData.options.map((opt, i) => (
                  <div key={i} className={`
                    p-4 rounded-xl border text-sm transition-all duration-200 flex items-start gap-3
                    ${opt === questionData.correctAnswer
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                      : 'bg-gray-50/50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400'}
                  `}>
                    <span className={`
                      flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold
                      ${opt === questionData.correctAnswer
                        ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}
                    `}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <div className="flex-1">{opt || '...'}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Metadata Settings */}
          <Card className="dark:bg-gray-900 dark:border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Metadata</CardTitle>
              <Button variant="ghost" size="sm" onClick={handleResetMetadata} className="h-8 text-xs text-muted-foreground hover:text-red-500">
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label>Courses (Select Multiple)</Label>
                  <Badge variant="outline">{questionData.courses?.length || 0} Selected</Badge>
                </div>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20 max-h-[150px] overflow-y-auto">
                  {firestoreCourses.map(c => (
                    <Badge
                      key={c.id}
                      variant={questionData.courses?.includes(c.name) ? 'default' : 'outline'}
                      className="cursor-pointer transition-all"
                      onClick={() => {
                        const current = questionData.courses || [];
                        const updated = current.includes(c.name)
                          ? current.filter(x => x !== c.name)
                          : [...current, c.name];
                        handleInputChange('courses', updated);
                        // Also set primary course for compatibility
                        if (updated.length > 0) handleInputChange('course', updated[0]);
                      }}
                    >
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select value={questionData.subject} onValueChange={(v) => handleInputChange('subject', v)} disabled={!questionData.course}>
                  <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Chapter</Label>
                  <Select value={questionData.chapter} onValueChange={(v) => handleInputChange('chapter', v)} disabled={!questionData.subject}>
                    <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      {chapters.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Select value={questionData.topic} onValueChange={(v) => handleInputChange('topic', v)} disabled={!questionData.chapter}>
                    <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700"><SelectValue placeholder="-" /></SelectTrigger>
                    <SelectContent>
                      {topics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <div className="flex gap-2">
                  {['Easy', 'Medium', 'Hard'].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => handleInputChange('difficulty', lvl)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition-all ${questionData.difficulty === lvl
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4 border-t border-gray-100 dark:border-gray-800 mt-4">
                <Switch
                  id="grace-mode"
                  checked={questionData.isGrace || false}
                  onCheckedChange={(checked) => handleInputChange('isGrace', checked)}
                />
                <Label htmlFor="grace-mode">Grace Mark (Award Full)</Label>
              </div>

            </CardContent>
          </Card>

        </div>
      </div>

      <CsvImporter
        isOpen={isCsvDialogOpen}
        onClose={() => setIsCsvDialogOpen(false)}
        onImport={handleSmartImport}
        defaultMetadata={{
          Course: questionData.course,
          Subject: questionData.subject,
          Topic: questionData.topic || 'General',
          Chapter: questionData.chapter || 'General',
          Difficulty: questionData.difficulty
        }}
        validChapters={chapters}
      />
      <CsvImporter
        isOpen={isCsvDialogOpen}
        onClose={() => setIsCsvDialogOpen(false)}
        onImport={handleSmartImport}
        initialData={importInitialData}
        defaultMetadata={{
          course: questionData.course,
          subject: questionData.subject,
          chapter: questionData.chapter,
          difficulty: questionData.difficulty
        }}
        validChapters={chapters}
      />

      <AiBulkGenerateDialog
        isOpen={isAiBulkOpen}
        onClose={() => setIsAiBulkOpen(false)}
        onGenerate={handleAiBulkSuccess}
        defaultMetadata={{
          courseId: '', // Mock questions might not have courseId strictly or we map it from name
          subject: questionData.subject,
          chapter: questionData.chapter,
          difficulty: questionData.difficulty
        }}
        validChapters={chapters}
      />
    </div>
  );
}

export default function CreateQuestionPage() {
  return (
    <React.Suspense fallback={<div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
      <CreateQuestionPageContent />
    </React.Suspense>
  );
}

