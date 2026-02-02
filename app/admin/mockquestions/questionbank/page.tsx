'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
  updateDoc,
  orderBy,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Plus,
  Filter,
  Trash2,
  Download,
  Copy,
  ChevronDown,
  Search,
  RefreshCw,
  Eye,
  Edit,
  Save,
  Archive,
  History,
  PieChart,
  UserCheck,
  AlertTriangle,
  BarChart2,
  Info,
  CheckCircle,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

// --- Types ---
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
  status?: 'draft' | 'published' | 'review';
  usageCount?: number;
  totalAttempts?: number;
  correctAttempts?: number;
  totalTimeSpent?: number;
  optionCounts?: Record<string, number>;
  lastUsedAt?: any;
  isDeleted?: boolean;
};

// --- Helper Functions ---
function parseCreatedAt(data: DocumentData): Date {
  if (data.createdAt?.toDate) return data.createdAt.toDate();
  if (typeof data.createdAt === 'string') return new Date(data.createdAt);
  return new Date();
}

function stripHtml(html: string) {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

const ITEMS_PER_PAGE = 20;

export default function MockQuestionBankPage() {
  const router = useRouter();

  // State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [analyticsQuestion, setAnalyticsQuestion] = useState<Question | null>(null);
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [batchUpdateData, setBatchUpdateData] = useState<{
    course?: string;
    subject?: string;
    topic?: string;
    difficulty?: string;
    status?: 'draft' | 'published' | 'review';
  }>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Metadata for filter options
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  // Initial Fetch & Filter Sync
  const fetchQuestions = useCallback(async (isLoadMore = false, currentLastDoc: QueryDocumentSnapshot<DocumentData> | null = null) => {
    setLoading(true);
    try {
      let q;
      const constraints: any[] = [];
      if (filterCourse !== 'All') constraints.push(where('course', '==', filterCourse));
      if (filterSubject !== 'All') constraints.push(where('subject', '==', filterSubject));
      if (filterDifficulty !== 'All') constraints.push(where('difficulty', '==', filterDifficulty));
      if (filterYear !== 'All') constraints.push(where('year', '==', filterYear));
      if (filterStatus !== 'All') constraints.push(where('status', '==', filterStatus));

      if (showDeleted) {
        constraints.push(where('isDeleted', '==', true));
      }

      if (constraints.length > 0) {
        // Note: usage of orderBy with where clauses may require composite indexes
        q = query(collection(db, 'mock-questions'), ...constraints, orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));
      } else {
        q = query(collection(db, 'mock-questions'), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));
      }

      if (isLoadMore && currentLastDoc) {
        q = query(q, startAfter(currentLastDoc));
      }

      const snapshot = await getDocs(q);
      console.log("Firestore snapshot size:", snapshot.size);

      const fetched: Question[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Question, 'id'>),
        createdAt: parseCreatedAt(doc.data())
      }));

      // Client-side filtering
      const filtered = fetched.filter(q => {
        const matchesSearch = searchQuery ? q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) : true;
        const matchesDeleted = showDeleted ? q.isDeleted === true : q.isDeleted !== true;
        return matchesSearch && matchesDeleted;
      });

      console.log("Total fetched:", fetched.length, "After filtering:", filtered.length);

      if (isLoadMore) {
        setQuestions(prev => [...prev, ...filtered]);
      } else {
        setQuestions(filtered);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);

      // Extract unique values for filters
      const subjects = new Set([...availableSubjects, ...fetched.map(q => q.subject || '')].filter(Boolean));
      setAvailableSubjects(Array.from(subjects));

      const courses = new Set([...availableCourses, ...fetched.map(q => q.course || '')].filter(Boolean));
      setAvailableCourses(Array.from(courses));

      const years = new Set([...availableYears, ...fetched.map(q => q.year || '')].filter(Boolean));
      setAvailableYears(Array.from(years));

      fetchUsageStats(fetched.map(q => q.id));

    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to fetch questions");
    } finally {
      setLoading(false);
    }
  }, [filterCourse, filterSubject, filterDifficulty, filterYear, filterStatus, searchQuery, showDeleted]); // eslint-disable-line

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setLastDoc(null);
      fetchQuestions(false, null);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, filterCourse, filterSubject, filterDifficulty, filterYear, filterStatus, showDeleted]); // eslint-disable-line react-hooks/exhaustive-deps

  const [globalStats, setGlobalStats] = useState({
    total: 0,
    active: 0,
    deleted: 0
  });
  const [subjectStats, setSubjectStats] = useState<{ subject: string; count: number }[]>([]);

  useEffect(() => {
    fetchCollectionStats();
  }, []);

  const fetchCollectionStats = async () => {
    try {
      const coll = collection(db, 'mock-questions');

      // Total & Deleted Stats
      const allSnapshot = await getCountFromServer(query(coll));
      const allCount = allSnapshot.data().count;

      const deletedSnapshot = await getCountFromServer(query(coll, where('isDeleted', '==', true)));
      const deletedCount = deletedSnapshot.data().count;

      setGlobalStats({
        total: allCount,
        active: allCount - deletedCount,
        deleted: deletedCount
      });

      // Subject Wise Stats
      // First get all subjects
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      const subjects = subjectsSnap.docs.map(d => d.data().name);

      const statsPromises = subjects.map(async (subject: string) => {
        const snapshot = await getCountFromServer(query(coll, where('subject', '==', subject), where('isDeleted', '!=', true)));
        return {
          subject,
          count: snapshot.data().count
        };
      });

      const results = await Promise.all(statsPromises);
      setSubjectStats(results.sort((a, b) => b.count - a.count));

    } catch (e) {
      console.error("Error fetching collection stats:", e);
    }
  };

  const fetchUsageStats = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const qSnap = await getDocs(collection(db, 'quizzes'));
      const quizData = qSnap.docs.map(d => d.data());

      setQuestions(prev => prev.map(q => {
        if (ids.includes(q.id)) {
          const count = quizData.filter(qz =>
            qz.selectedQuestions?.some((sq: any) => sq.id === q.id)
          ).length;
          return { ...q, usageCount: count };
        }
        return q;
      }));
    } catch (e) {
      console.error("Error fetching stats:", e);
    }
  };

  // Actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedQuestions(questions.map(q => q.id));
    } else {
      setSelectedQuestions([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedQuestions(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSoftDelete = async (questionIds?: string[]) => {
    const idsToDelete = questionIds || selectedQuestions;
    if (idsToDelete.length === 0) return;
    if (!confirm(`Move ${idsToDelete.length} question(s) to Delete Bin?`)) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      idsToDelete.forEach(id => {
        batch.update(doc(db, 'mock-questions', id), { isDeleted: true, updatedAt: new Date() });
      });
      await batch.commit();

      setQuestions(prev => prev.filter(q => !idsToDelete.includes(q.id)));
      setSelectedQuestions(prev => prev.filter(id => !idsToDelete.includes(id)));
      toast.success("Questions moved to Delete Bin");
    } catch (err) {
      toast.error("Failed to delete questions");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (questionIds?: string[]) => {
    const idsToRestore = questionIds || selectedQuestions;
    if (idsToRestore.length === 0) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      idsToRestore.forEach(id => {
        batch.update(doc(db, 'mock-questions', id), { isDeleted: false, updatedAt: new Date() });
      });
      await batch.commit();

      setQuestions(prev => prev.filter(q => !idsToRestore.includes(q.id)));
      setSelectedQuestions(prev => prev.filter(id => !idsToRestore.includes(id)));
      toast.success("Questions restored successfully");
    } catch (err) {
      toast.error("Failed to restore questions");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async (questionIds?: string[]) => {
    const idsToDelete = questionIds || selectedQuestions;
    if (idsToDelete.length === 0) return;
    if (!confirm(`PERMANENTLY DELETE ${idsToDelete.length} question(s)? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const batch = writeBatch(db);
      idsToDelete.forEach(id => {
        batch.delete(doc(db, 'mock-questions', id));
      });
      await batch.commit();

      setQuestions(prev => prev.filter(q => !idsToDelete.includes(q.id)));
      setSelectedQuestions(prev => prev.filter(id => !idsToDelete.includes(id)));
      toast.success("Questions permanently deleted");
    } catch (err) {
      toast.error("Failed to delete questions");
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (question: Question) => {
    try {
      const { id, ...data } = question; // eslint-disable-line
      const newDoc = await import('firebase/firestore').then(mod => mod.addDoc(collection(db, 'mock-questions'), {
        ...data,
        questionText: `${data.questionText} (Copy)`,
        createdAt: new Date(),
      }));
      toast.success("Question duplicated!");
      setQuestions([{ ...data, questionText: `${data.questionText} (Copy)`, id: newDoc.id, createdAt: new Date() } as Question, ...questions]);
    } catch (e) {
      toast.error("Failed to duplicate");
    }
  };

  const handleExport = () => {
    const dataToExport = questions.filter(q => selectedQuestions.length ? selectedQuestions.includes(q.id) : true);
    const csv = Papa.unparse(dataToExport.map(q => ({
      ...q,
      options: q.options.join('|')
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "mock_questions_export.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkUpdate = async () => {
    if (selectedQuestions.length === 0) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      selectedQuestions.forEach(id => {
        const docRef = doc(db, 'mock-questions', id);
        batch.update(docRef, { ...batchUpdateData, updatedAt: new Date() });
      });
      await batch.commit();

      setQuestions(prev => prev.map(q =>
        selectedQuestions.includes(q.id) ? { ...q, ...batchUpdateData } : q
      ));

      setSelectedQuestions([]);
      setIsBatchEditing(false);
      setBatchUpdateData({});
      toast.success(`Successfully updated ${selectedQuestions.length} questions`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update questions");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'draft' | 'published' | 'review') => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'mock-questions', id), { status: newStatus, updatedAt: new Date() });
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 p-6 space-y-6">

      {/* Header Statistics & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">Mock Question Bank</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and organize your mock examination content.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/mockquestions/create')} className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Plus className="mr-2 h-4 w-4" /> New Question
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => { setLastDoc(null); fetchQuestions(false, null); }}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant={showDeleted ? "destructive" : "outline"}
            className="gap-2"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Archive className="h-4 w-4" /> {showDeleted ? 'Exit Bin' : 'Delete Bin'}
          </Button>
        </div>
      </div>

      {/* Database Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
        <Card className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Questions</p>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{globalStats.total}</h2>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</p>
              <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">{globalStats.active}</h2>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-2.5 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Deleted</p>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{globalStats.deleted}</h2>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Top Subjects</p>
              <PieChart className="h-4 w-4 text-gray-400" />
            </div>
            <div className="space-y-2 max-h-[60px] overflow-y-auto pr-1">
              {subjectStats.slice(0, 3).map((s, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="truncate max-w-[120px]" title={s.subject}>{s.subject}</span>
                  <span className="font-semibold bg-gray-100 dark:bg-gray-800 px-1.5 rounded text-xs">{s.count}</span>
                </div>
              ))}
              {subjectStats.length === 0 && <span className="text-xs text-gray-400">No data available</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject Distribution Detail (Collapsible or just a separate row if needed) */}
      {subjectStats.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 hidden sm:flex">
          {subjectStats.map((s, i) => (
            <Badge key={i} variant="outline" className="whitespace-nowrap flex gap-2 bg-white dark:bg-gray-900 py-1">
              {s.subject}
              <span className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-[10px]">{s.count}</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-4 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between transition-all">

        {/* Search & Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input
              placeholder="Search questions..."
              className="pl-9 bg-white dark:bg-gray-900 shadow-sm border-gray-200 dark:border-gray-800 focus:ring-blue-500"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="bg-white dark:bg-gray-900 shadow-sm dark:border-gray-800">
                <Filter className="mr-2 h-4 w-4" /> Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Questions</SheetTitle>
                <SheetDescription>Refine your view by specific attributes.</SheetDescription>
              </SheetHeader>
              <div className="py-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Course</label>
                  <Select value={filterCourse} onValueChange={setFilterCourse}>
                    <SelectTrigger><SelectValue placeholder="All Courses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Courses</SelectItem>
                      {availableCourses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Select value={filterSubject} onValueChange={setFilterSubject}>
                    <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Subjects</SelectItem>
                      {availableSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Difficulty</label>
                  <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All</SelectItem>
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Year</label>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Years</SelectItem>
                      {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="review">Review Required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button type="submit">Apply Filters</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {/* Bulk Actions */}
        {selectedQuestions.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-2">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{selectedQuestions.length} Selected</span>
            <div className="h-4 w-px bg-blue-200 dark:bg-blue-700 mx-2" />

            {!showDeleted ? (
              <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => handleSoftDelete()}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30" onClick={() => handleRestore()}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Restore
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={() => handlePermanentDelete()}>
                  <AlertTriangle className="h-4 w-4 mr-1" /> Permanent Delete
                </Button>
              </>
            )}

            <Button size="sm" variant="ghost" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={() => setIsBatchEditing(true)}>
              <Edit className="h-4 w-4 mr-1" /> Update
            </Button>
            <Button size="sm" variant="ghost" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
            <TableRow className="border-gray-200 dark:border-gray-800">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={questions.length > 0 && selectedQuestions.length === questions.length}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </TableHead>
              <TableHead className="w-[40%] text-gray-700 dark:text-gray-300">Question</TableHead>
              <TableHead className="text-gray-700 dark:text-gray-300">Metadata</TableHead>
              <TableHead className="text-gray-700 dark:text-gray-300">Stats</TableHead>
              <TableHead className="text-gray-700 dark:text-gray-300">Details</TableHead>
              <TableHead className="text-right text-gray-700 dark:text-gray-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center text-gray-500">
                  No questions found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              questions.map((question) => (
                <TableRow key={question.id} className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors border-gray-100 dark:border-gray-800">
                  <TableCell>
                    <Checkbox
                      checked={selectedQuestions.includes(question.id)}
                      onCheckedChange={() => handleSelectOne(question.id)}
                    />
                  </TableCell>
                  <TableCell className="max-w-[400px]">
                    <div className="space-y-1 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors whitespace-normal break-words prose prose-sm dark:prose-invert">
                        <div dangerouslySetInnerHTML={{ __html: question.questionText }} />
                      </div>
                      <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">ID: {question.id.slice(0, 6)}</span>
                        <span>{question.options.length} Options</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs bg-white dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">{question.course}</Badge>
                        <Badge variant="outline" className="text-xs bg-white dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">{question.subject}</Badge>
                      </div>
                      {question.topic && <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{question.topic}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-[10px] text-gray-500">
                      <div className="flex items-center gap-1.5" title="Used in X Quizzes">
                        <PieChart className="h-3 w-3" />
                        <span>{question.usageCount || 0} Quizzes</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Success Rate">
                        <UserCheck className="h-3 w-3" />
                        <span>{question.totalAttempts ? `${Math.round(((question.correctAttempts || 0) / question.totalAttempts) * 100)}%` : 'No data'}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                      <Badge className={`w-fit text-[10px] uppercase
                                    ${question.difficulty === 'Easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200' : ''}
                                    ${question.difficulty === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200' : ''}
                                    ${question.difficulty === 'Hard' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200' : ''}
                                `}>
                        {question.difficulty || 'N/A'}
                      </Badge>
                      <Badge variant="secondary" className={`w-fit text-[10px] uppercase
                                    ${question.status === 'published' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}
                                `}>
                        {question.status || 'draft'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => setPreviewQuestion(question)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setPreviewQuestion(question)}>
                            <Eye className="mr-2 h-4 w-4" /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/mockquestions/create?id=${question.id}`)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleClone(question)}>
                            <Copy className="mr-2 h-4 w-4" /> Duplicate
                          </DropdownMenuItem>

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <RefreshCw className="mr-2 h-4 w-4" /> Change Status
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => handleStatusChange(question.id, 'draft')}>
                                  <Badge className="bg-gray-100 text-gray-700">Draft</Badge>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(question.id, 'review')}>
                                  <Badge className="bg-yellow-100 text-yellow-700">Under Review</Badge>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(question.id, 'published')}>
                                  <Badge className="bg-green-100 text-green-700">Published</Badge>
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                          </DropdownMenuSub>

                          <DropdownMenuItem onClick={() => setAnalyticsQuestion(question)}>
                            <BarChart2 className="mr-2 h-4 w-4" /> Analytics
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          {showDeleted ? (
                            <>
                              <DropdownMenuItem onClick={() => handleRestore([question.id])} className="text-green-600 dark:text-green-400">
                                <RefreshCw className="mr-2 h-4 w-4" /> Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePermanentDelete([question.id])} className="text-red-600 dark:text-red-400">
                                <AlertTriangle className="mr-2 h-4 w-4" /> Permanent Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => handleSoftDelete([question.id])} className="text-red-600 dark:text-red-400">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
            {loading && (
              <>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="border-gray-100 dark:border-gray-800">
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                    <TableCell><Skeleton className="h-12 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>

        {/* Load More Footer */}
        {hasMore && !loading && questions.length > 0 && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-center">
            <Button variant="outline" onClick={() => fetchQuestions(true, lastDoc)} className="w-full sm:w-auto bg-white dark:bg-gray-800 dark:border-gray-700">
              Load More Questions <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={!!previewQuestion} onOpenChange={(open) => !open && setPreviewQuestion(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
            <DialogDescription>
              This is how students will see this question.
            </DialogDescription>
          </DialogHeader>

          {previewQuestion && (
            <div className="space-y-6 py-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{previewQuestion.course}</Badge>
                <Badge variant="secondary">{previewQuestion.subject}</Badge>
                <Badge variant="secondary">{previewQuestion.difficulty}</Badge>
                {previewQuestion.year && <Badge variant="outline">Year: {previewQuestion.year}</Badge>}
                <Badge className={previewQuestion.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                  {previewQuestion.status || 'draft'}
                </Badge>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: previewQuestion.questionText }} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {previewQuestion.options.map((option, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border flex items-start gap-3 ${option === previewQuestion.correctAnswer
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-800'
                      }`}
                  >
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1">{option}</span>
                    {option === previewQuestion.correctAnswer && (
                      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {previewQuestion.explanation && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-300 mb-2">Explanation</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: previewQuestion.explanation }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={!!analyticsQuestion} onOpenChange={(open) => !open && setAnalyticsQuestion(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question Analytics</DialogTitle>
            <DialogDescription>
              Performance metrics and usage statistics
            </DialogDescription>
          </DialogHeader>

          {analyticsQuestion && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{analyticsQuestion.usageCount || 0}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Times Used</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{analyticsQuestion.totalAttempts || 0}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Attempts</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {analyticsQuestion.totalAttempts ? `${Math.round(((analyticsQuestion.correctAttempts || 0) / analyticsQuestion.totalAttempts) * 100)}%` : 'N/A'}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Success Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{analyticsQuestion.totalTimeSpent ? `${Math.round(analyticsQuestion.totalTimeSpent / 60)}m` : 'N/A'}</div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg. Time</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Option Distribution</h4>
                <div className="space-y-2">
                  {analyticsQuestion.options.map((opt, idx) => {
                    const count = analyticsQuestion.optionCounts?.[opt] || 0;
                    const total = analyticsQuestion.totalAttempts || 1;
                    const percentage = Math.round((count / total) * 100);
                    const isCorrect = opt === analyticsQuestion.correctAnswer;

                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className={isCorrect ? 'font-semibold text-green-600' : ''}>
                            {String.fromCharCode(65 + idx)}. {opt.substring(0, 50)}{opt.length > 50 ? '...' : ''}
                          </span>
                          <span className="text-gray-500">{count} ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${isCorrect ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Edit Modal */}
      <Dialog open={isBatchEditing} onOpenChange={setIsBatchEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Update {selectedQuestions.length} Questions</DialogTitle>
            <DialogDescription>
              Update metadata for all selected questions at once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={batchUpdateData.status || ''} onValueChange={(v: any) => setBatchUpdateData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <Select value={batchUpdateData.difficulty || ''} onValueChange={(v) => setBatchUpdateData(prev => ({ ...prev, difficulty: v }))}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBatchEditing(false)}>Cancel</Button>
            <Button onClick={handleBulkUpdate}>Update Questions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}