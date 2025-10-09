 'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  DocumentData,
  QueryDocumentSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@radix-ui/react-select';
import { Pencil, Trash, Plus, Loader2, Download, Eye, Edit2, Upload, Sun, Moon, BarChart2, User2 } from 'lucide-react';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import ReactSelect from 'react-select';
import { FixedSizeList as VirtualList } from 'react-window';

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

// Simulate current user and role
const useCurrentUser = () => ({ name: 'Admin User', role: 'admin' as 'admin' | 'teacher' | 'viewer' });

type Question = {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  course?: string;
  subject?: string;
  chapter?: string;
  difficulty?: string;
  explanation?: string;
  topic?: string;
  year?: string;
  book?: string;
  teacher?: string;
  enableExplanation?: boolean;
  createdAt?: Date;
  tags?: string[];
};

function parseCreatedAt(data: DocumentData): Date {
  if (data.createdAt instanceof Date) return data.createdAt;
  if (data.createdAt?.toDate) return data.createdAt.toDate();
  if (typeof data.createdAt === 'string') return new Date(data.createdAt);
  return new Date();
}

const PAGE_SIZE = 20;

const QuestionBankPage = () => {
  const router = useRouter();
  const { name: currentUserName, role } = useCurrentUser();

  // Data and UI state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  // Filters and search
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Selection and bulk ops
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'subject' | 'all'>('selected');
  const [isDeleting, setIsDeleting] = useState(false);

  // CSV Export/Import
  const [exportMode, setExportMode] = useState<'all' | 'subject'>('all');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // Preview/Editing
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<'subject' | 'difficulty' | 'chapter' | 'addTag' | 'removeTag'>('subject');
  const [bulkEditValue, setBulkEditValue] = useState('');

  // Stats
  const [stats, setStats] = useState<{ [key: string]: number }>({});
  // Dark Mode
  const [darkMode, setDarkMode] = useState(false);

  // Virtualization
  const listRef = useRef<VirtualList>(null);

  // Tag set
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    questions.forEach(q => q.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).map(tag => ({ label: tag, value: tag }));
  }, [questions]);

  // Infinite scroll with IntersectionObserver
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!bottomRef.current || !hasMore || loading || fetchingMore) return;
    const el = bottomRef.current;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) handleLoadMore();
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line
  }, [hasMore, loading, fetchingMore]);

  // Fetch paginated and filtered questions (server-side filtering)
  const fetchQuestions = async (reset = false) => {
    setLoading(reset);
    setFetchingMore(!reset);
    try {
      let q = collection(db, 'questions');
      let qArr: any[] = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)];
      if (selectedSubject !== 'all') qArr.push(where('subject', '==', selectedSubject));
      if (filterDifficulty !== 'all') qArr.push(where('difficulty', '==', filterDifficulty));
      let ref = query(q, ...qArr);
      if (!reset && lastVisible) ref = query(q, ...qArr, startAfter(lastVisible));
      const snapshot = await getDocs(ref);
      const fetched: Question[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Question, 'id'>),
        createdAt: parseCreatedAt(doc.data()),
      }));
      setQuestions(reset ? fetched : prev => [...prev, ...fetched]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.size === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };
  // Initial/filtered load
  useEffect(() => { fetchQuestions(true); }, [selectedSubject, filterDifficulty]);

  // Search (client-side, since Firestore doesn't support full-text)
  const filteredQuestions = useMemo(() => {
    let qlist = [...questions];
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      qlist = qlist.filter(q =>
        q.course?.toLowerCase().includes(s) ||
        q.subject?.toLowerCase().includes(s) ||
        q.chapter?.toLowerCase().includes(s) ||
        q.questionText?.toLowerCase().includes(s)
      );
    }
    if (filterYear !== 'all') qlist = qlist.filter(q => q.year === filterYear);
    if (filterTags.length > 0) qlist = qlist.filter(q => q.tags?.some(t => filterTags.includes(t)));
    return qlist;
  }, [questions, debouncedSearch, filterYear, filterTags]);

  // Stats calculation
  useEffect(() => {
    const subjectCounts: { [key: string]: number } = {};
    questions.forEach(q => {
      const subject = q.subject || 'Unknown';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    setStats(subjectCounts);
  }, [questions]);

  // Selection
  useEffect(() => setSelectedQuestions([]), [filteredQuestions]);

  const handleSelectQuestion = useCallback((id: string) => {
    setSelectedQuestions(prev =>
      prev.includes(id) ? prev.filter(qid => qid !== id) : [...prev, id]
    );
  }, []);

  const handleSelectAll = () => {
    if (selectedQuestions.length === filteredQuestions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(filteredQuestions.map(q => q.id));
    }
  };

  // Batched delete
  const handleBulkDelete = async () => {
    if (role !== 'admin') return alert('Only admins can perform this operation.');
    if (deleteMode === 'selected' && selectedQuestions.length === 0) {
      alert('Please select at least one question to delete.');
      return;
    }
    if (!window.confirm(
      `Are you sure you want to delete ${
        deleteMode === 'selected'
          ? `${selectedQuestions.length} selected question(s)`
          : deleteMode === 'subject'
          ? `all questions for subject "${selectedSubject}"`
          : 'all questions'
      }? This action cannot be undone.`
    )) return;

    setIsDeleting(true);
    try {
      if (deleteMode === 'selected') {
        for (let i = 0; i < selectedQuestions.length; i += 500) {
          const batch = writeBatch(db);
          selectedQuestions.slice(i, i + 500).forEach(id => {
            batch.delete(doc(db, 'questions', id));
          });
          await batch.commit();
        }
        setQuestions(prev => prev.filter(q => !selectedQuestions.includes(q.id)));
      } else if (deleteMode === 'subject') {
        const qRef = query(collection(db, 'questions'), where('subject', '==', selectedSubject));
        const snapshot = await getDocs(qRef);
        const ids = snapshot.docs.map(d => d.id);
        for (let i = 0; i < ids.length; i += 500) {
          const batch = writeBatch(db);
          ids.slice(i, i + 500).forEach(id => {
            batch.delete(doc(db, 'questions', id));
          });
          await batch.commit();
        }
        setQuestions(prev => prev.filter(q => q.subject !== selectedSubject));
      } else if (deleteMode === 'all') {
        const snapshot = await getDocs(collection(db, 'questions'));
        const ids = snapshot.docs.map(d => d.id);
        for (let i = 0; i < ids.length; i += 500) {
          const batch = writeBatch(db);
          ids.slice(i, i + 500).forEach(id => {
            batch.delete(doc(db, 'questions', id));
          });
          await batch.commit();
        }
        setQuestions([]);
      }
      setSelectedQuestions([]);
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error during bulk delete:', error);
      alert('Failed to delete questions.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk Edit
  const handleBulkEdit = async () => {
    if (selectedQuestions.length === 0) return alert('Select questions to bulk edit.');
    setIsDeleting(true);
    try {
      for (let i = 0; i < selectedQuestions.length; i += 500) {
        const batch = writeBatch(db);
        selectedQuestions.slice(i, i + 500).forEach(id => {
          const qRef = doc(db, 'questions', id);
          if (bulkEditField === 'subject') batch.update(qRef, { subject: bulkEditValue });
          if (bulkEditField === 'difficulty') batch.update(qRef, { difficulty: bulkEditValue });
          if (bulkEditField === 'chapter') batch.update(qRef, { chapter: bulkEditValue });
          if (bulkEditField === 'addTag') batch.update(qRef, { tags: Array.from(new Set([...(questions.find(q => q.id === id)?.tags || []), bulkEditValue])) });
          if (bulkEditField === 'removeTag') batch.update(qRef, { tags: (questions.find(q => q.id === id)?.tags || []).filter(t => t !== bulkEditValue) });
        });
        await batch.commit();
      }
      setBulkEditDialogOpen(false);
      fetchQuestions(true);
    } catch (e) {
      alert('Bulk edit failed.');
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  // CSV Export
  const exportToCSV = (exportQuestions: Question[], filename: string) => {
    const headers = [
      'questionText', 'options', 'correctAnswer', 'course', 'subject', 'chapter', 'difficulty',
      'explanation', 'topic', 'year', 'book', 'teacher', 'enableExplanation', 'tags'
    ];
    const escape = (text?: string) =>
      `"${(text ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    const rows = exportQuestions.map((q) =>
      [
        escape(q.questionText),
        escape((q.options || []).join('|')),
        escape(q.correctAnswer),
        escape(q.course),
        escape(q.subject),
        escape(q.chapter),
        escape(q.difficulty),
        escape(q.explanation),
        escape(q.topic),
        escape(q.year),
        escape(q.book),
        escape(q.teacher),
        q.enableExplanation ? 'true' : 'false',
        escape((q.tags || []).join('|'))
      ].join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = (mode: 'all' | 'subject', subject?: string) => {
    const exportQuestions =
      mode === 'all' ? questions :
      questions.filter((q) => q.subject === subject);
    const filename =
      mode === 'all'
        ? 'all_questions.csv'
        : `questions_${subject?.replace(/\s+/g, '_').toLowerCase()}.csv`;
    exportToCSV(exportQuestions, filename);
  };

  // CSV Import
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setImporting(true);
    Papa.parse(acceptedFiles[0], {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          (results.data as any[]).slice(0, 500).forEach((row) => {
            const q: any = {
              ...row,
              options: row.options?.split('|'),
              tags: row.tags?.split('|').filter((t: string) => t),
              createdAt: new Date(),
            };
            batch.set(doc(collection(db, 'questions')), q);
          });
          await batch.commit();
          setIsImportDialogOpen(false);
          fetchQuestions(true);
        } catch (e) {
          alert('Import failed.');
        } finally {
          setImporting(false);
        }
      }
    });
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

  // Unique values for filters
  const uniqueSubjects = useMemo(() =>
    Array.from(new Set(questions.map(q => q.subject).filter((s): s is string => !!s)))
  , [questions]);
  const uniqueDifficulties = useMemo(() =>
    Array.from(new Set(questions.map(q => q.difficulty).filter((d): d is string => !!d)))
  , [questions]);
  const uniqueYears = useMemo(() =>
    Array.from(new Set(questions.map(q => q.year).filter((y): y is string => !!y)))
  , [questions]);

  const handleLoadMore = () => {
    if (hasMore && !loading && !fetchingMore) fetchQuestions(false);
  };

  // Dark mode
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Audit log placeholder
  const handleAudit = (action: string, questionId?: string) => {
    // In production, send to backend or log service
    console.log(`[AUDIT] User: ${currentUserName}, Action: ${action}, QuestionID: ${questionId}`);
  };

  // Virtualized list row
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const q = filteredQuestions[index];
    return (
      <div style={style}>
        <Card
          key={q.id}
          className="p-4 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl mb-4"
        >
          <div className="flex items-start gap-3 mb-2">
            <Checkbox
              checked={selectedQuestions.includes(q.id)}
              onCheckedChange={() => handleSelectQuestion(q.id)}
              className="mt-1"
            />
            <div className="flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-start gap-1">
                {index + 1}.{' '}
                <span className="prose max-w-prose inline"
                  dangerouslySetInnerHTML={{ __html: q.questionText }}
                />
              </h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {q.course && <Badge className="bg-blue-100 text-blue-800">{q.course}</Badge>}
                {q.subject && (
                  <Badge variant="outline" className="border-blue-200 text-gray-700">{q.subject}</Badge>
                )}
                {q.chapter && (
                  <Badge variant="secondary" className="bg-gray-100 text-gray-700">{q.chapter}</Badge>
                )}
                {q.difficulty && (
                  <Badge className="bg-green-100 text-green-800">{q.difficulty}</Badge>
                )}
                {q.tags?.map(tag => (
                  <Badge key={tag} className="bg-yellow-100 text-yellow-900">{tag}</Badge>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setPreviewQuestion(q)}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-2">
            {q.options.map((opt, i) => (
              <div
                key={i}
                className={`p-2 rounded-md border text-sm ${
                  opt === q.correctAnswer
                    ? 'bg-green-100 border-green-400 text-green-900'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-300 hover:bg-gray-100 text-gray-700"
              onClick={() => router.push(`/admin/questions/create?id=${q.id}`)}
              disabled={role === 'viewer'}
            >
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="hover:bg-red-700 text-white"
              onClick={async () => {
                if (!window.confirm('Are you sure?')) return;
                await deleteDoc(doc(db, 'questions', q.id));
                setQuestions(prev => prev.filter(qq => qq.id !== q.id));
                handleAudit('delete', q.id);
              }}
              disabled={role !== 'admin'}
            >
              <Trash className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
          {q.createdAt && (
            <p className="text-sm text-gray-500 mt-1">
              Created on:{' '}
              {q.createdAt instanceof Date
                ? q.createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                : new Date(q.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          )}
        </Card>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-white'} rounded-xl p-4 sm:p-6 lg:p-8`}>
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold">
            📘 Question Bank
          </h1>
          <span className="text-sm sm:text-base opacity-70">
            (Total Questions: {questions.length})
          </span>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => setDarkMode((d) => !d)} variant="ghost">
            {darkMode ? <Sun /> : <Moon />}
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => router.push('/admin/questions/create')}
            disabled={role === 'viewer'}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Question
          </Button>
          <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="hover:bg-red-700 text-white" disabled={role !== 'admin'}>
                <Trash className="h-5 w-5 mr-2" />
                Bulk Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Delete Questions</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select value={deleteMode} onValueChange={val => setDeleteMode(val as any)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select delete mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selected">Selected Questions</SelectItem>
                    <SelectItem value="subject">By Subject</SelectItem>
                    <SelectItem value="all">All Questions</SelectItem>
                  </SelectContent>
                </Select>
                {deleteMode === 'subject' && (
                  <Select
                    value={selectedSubject}
                    onValueChange={setSelectedSubject}
                    disabled={uniqueSubjects.length === 0}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueSubjects.map(subject => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {deleteMode === 'selected' && (
                  <p className="text-sm text-gray-600">{selectedQuestions.length} question(s) selected</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsBulkDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isDeleting || (deleteMode === 'selected' && selectedQuestions.length === 0) || (deleteMode === 'subject' && !selectedSubject)}
                >
                  {isDeleting ? (<><Loader2 className="h-5 w-5 mr-2 animate-spin" />Deleting...</>) : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-600 hover:bg-yellow-700 text-white"
                disabled={selectedQuestions.length === 0}
              >
                <Edit2 className="h-5 w-5 mr-2" />
                Bulk Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Edit Selected Questions</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Select value={bulkEditField} onValueChange={val => setBulkEditField(val as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Edit Field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subject">Subject</SelectItem>
                    <SelectItem value="difficulty">Difficulty</SelectItem>
                    <SelectItem value="chapter">Chapter</SelectItem>
                    <SelectItem value="addTag">Add Tag</SelectItem>
                    <SelectItem value="removeTag">Remove Tag</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={`Set ${bulkEditField}`}
                  value={bulkEditValue}
                  onChange={e => setBulkEditValue(e.target.value)}
                  list={bulkEditField === 'addTag' || bulkEditField === 'removeTag' ? 'tag-list' : undefined}
                />
                <datalist id="tag-list">
                  {uniqueTags.map(tag => <option key={tag.value} value={tag.value} />)}
                </datalist>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleBulkEdit}
                  disabled={isDeleting || !bulkEditValue}
                >
                  {isDeleting ? (<Loader2 className="h-5 w-5 mr-2 animate-spin" />) : null}
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                <Upload className="h-5 w-5 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Questions from CSV</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <div {...getRootProps()} className={`border-2 border-dashed rounded p-6 text-center cursor-pointer ${isDragActive ? 'border-blue-500' : 'border-gray-300'}`}>
                  <input {...getInputProps()} />
                  {isDragActive
                    ? <p>Drop the file here ...</p>
                    : <p>Drag and drop a CSV file here, or click to select file</p>
                  }
                </div>
                {importing && <p className="text-blue-500 mt-2">Importing...</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <Download className="h-5 w-5 mr-2" />
                Export CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Questions to CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select
                  value={exportMode}
                  onValueChange={val => setExportMode(val as 'all' | 'subject')}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select export mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Questions</SelectItem>
                    <SelectItem value="subject">By Subject</SelectItem>
                  </SelectContent>
                </Select>
                {exportMode === 'subject' && (
                  <Select
                    value={selectedSubject}
                    onValueChange={val => {
                      setSelectedSubject(val);
                      if (val) handleExportCSV('subject', val);
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {uniqueSubjects.map(subject => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  className="bg-green-600 mt-4"
                  onClick={() => handleExportCSV('all')}
                >
                  Download All
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedSubject('all')}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Advanced Filtering */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex gap-2 w-full md:w-2/5">
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
          />
          {search && (
            <Button variant="outline" onClick={() => setSearch('')}>Clear</Button>
          )}
        </div>
        <div className="flex gap-2 w-full md:w-3/5">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueSubjects.map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueDifficulties.map(diff => (
                <SelectItem key={diff} value={diff}>{diff}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueYears.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div style={{ minWidth: 160 }}>
            <ReactSelect
              isMulti
              options={uniqueTags}
              value={uniqueTags.filter(tag => filterTags.includes(tag.value))}
              onChange={vals => setFilterTags(vals.map(v => v.value))}
              placeholder="Tags"
              classNamePrefix="react-select"
            />
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-4 text-xs md:text-sm flex flex-wrap gap-3 items-center opacity-80">
        <BarChart2 className="w-4 h-4 mr-1" />
        {Object.entries(stats).map(([subj, count]) => (
          <span key={subj} className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{subj}: {count}</span>
        ))}
        <span>Total: {questions.length}</span>
      </div>

      {/* Content - Virtualized List */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse bg-white shadow-md">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="h-6 bg-gray-100 rounded"></div>
                <div className="h-6 bg-gray-100 rounded"></div>
              </div>
              <div className="flex justify-end gap-2">
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filteredQuestions.length === 0 ? (
        <p className="text-center text-gray-500 text-lg mt-10">No questions found.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              checked={filteredQuestions.length > 0 && selectedQuestions.length === filteredQuestions.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Select All ({selectedQuestions.length}/{filteredQuestions.length})
            </span>
          </div>
          <VirtualList
            ref={listRef}
            height={700}
            width={'100%'}
            itemCount={filteredQuestions.length}
            itemSize={330}
          >
            {Row}
          </VirtualList>
          <div ref={bottomRef} />
        </>
      )}

      {/* Preview Modal */}
      <Dialog open={!!previewQuestion} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
          </DialogHeader>
          {previewQuestion && (
            <div>
              <h2 className="font-bold mb-2">{previewQuestion.questionText}</h2>
              <div>
                <b>Options:</b>
                <ul>
                  {previewQuestion.options.map((o, i) => (
                    <li key={i} className={o === previewQuestion.correctAnswer ? 'font-bold text-green-700' : ''}>
                      {String.fromCharCode(65 + i)}. {o}
                    </li>
                  ))}
                </ul>
                <div className="mt-2"><b>Correct:</b> {previewQuestion.correctAnswer}</div>
                <div><b>Explanation:</b> {previewQuestion.explanation}</div>
                <div><b>Course:</b> {previewQuestion.course}</div>
                <div><b>Subject:</b> {previewQuestion.subject}</div>
                <div><b>Chapter:</b> {previewQuestion.chapter}</div>
                <div><b>Difficulty:</b> {previewQuestion.difficulty}</div>
                <div><b>Tags:</b> {(previewQuestion.tags || []).join(', ')}</div>
                <div><b>Year:</b> {previewQuestion.year}</div>
                <div><b>Book:</b> {previewQuestion.book}</div>
                <div><b>Teacher:</b> {previewQuestion.teacher}</div>
                <div><b>Enable Explanation:</b> {previewQuestion.enableExplanation ? 'Yes' : 'No'}</div>
                <div><b>Created At:</b> {previewQuestion.createdAt?.toLocaleString()}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPreviewQuestion(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuestionBankPage;
