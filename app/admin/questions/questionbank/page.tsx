'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  limit,
  startAfter,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
  updateDoc
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { addDays, format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
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
  ArrowRight,
  ArrowUp,
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

// Increased batch size for infinite scroll
const ITEMS_PER_PAGE = 100;
// import { useInView } from 'react-intersection-observer'; // Removed to avoid dependency error

import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../firebase';

export default function QuestionBankPage() {
  const router = useRouter();

  // User Role State
  const [userRole, setUserRole] = useState<'admin' | 'superadmin' | 'teacher' | 'student' | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Checks user role on mount
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch extended user details for role/subjects
        // We can't just rely on custom claims if they aren't set, so fetch from firestore 'users'
        // But since we are inside a component, let's just fetch the doc.
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const role = data.role || (data.superadmin ? 'superadmin' : data.admin ? 'admin' : 'student');
            setUserRole(role);
            setIsSuperAdmin(role === 'superadmin' || !!data.superadmin);

            if (role === 'teacher') {
              const subs = data.subjects || [];
              setTeacherSubjects(subs);
              // Force filter to first subject if available
              if (subs.length > 0) {
                setFilterSubject(subs[0]);
              }
            }
          }
        } catch (e) {
          console.error("Error fetching user role", e);
        }
      }
    });
    return () => unsub();
  }, []);

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
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourse, setFilterCourse] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterDifficulty, setFilterDifficulty] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // New Filters
  const [filterTeacher, setFilterTeacher] = useState('All');
  const [filterChapter, setFilterChapter] = useState('All');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Metadata
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  // Full Data for Dropdowns
  const [allSubjectsData, setAllSubjectsData] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<{ uid: string, name: string }[]>([]);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);

  // Scroll To Top Logic
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch Metadata (Subjects & Teachers) independently
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // Fetch Subjects
        const subSnap = await getDocs(collection(db, 'subjects'));
        const subs = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllSubjectsData(subs);

        // Fetch Teachers (Users with role 'teacher' or 'admin'?? Just teachers for now)
        // Note: 'users' collection might be large, but filtering by role 'teacher' requires index.
        // Fallback: Fetch all if small app, or try query.
        try {
          const teacherQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
          const tSnap = await getDocs(teacherQuery);
          const tech = tSnap.docs.map(d => ({
            uid: d.id,
            name: d.data().name || d.data().displayName || d.data().email || 'Unknown'
          }));
          // Also add Admins? Maybe separately.
          setTeachersList(tech);
        } catch (e) {
          console.warn("Could not fetch teachers list (missing index?)", e);
        }

      } catch (e) {
        console.error("Error fetching metadata", e);
      }
    };
    fetchMetadata();
  }, []);

  // Update Available Chapters when Subject changes
  useEffect(() => {
    if (filterSubject !== 'All') {
      const sub = allSubjectsData.find(s => s.name === filterSubject);
      if (sub && sub.chapters) {
        setAvailableChapters(Object.keys(sub.chapters));
      } else {
        setAvailableChapters([]);
      }
    } else {
      setAvailableChapters([]);
    }
    // Reset chapter filter if subject changes
    setFilterChapter('All');
  }, [filterSubject, allSubjectsData]);



  // Infinite Scroll Observer
  const observer = React.useRef<IntersectionObserver>();
  const lastQuestionElementRef = useCallback((node: HTMLTableRowElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchQuestions(true);
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, hasMore]); // eslint-disable-line

  // Initial Fetch & Filter Sync
  const fetchQuestions = useCallback(async (isLoadMore = false) => {
    setLoading(true);
    try {
      let q;
      const constraints: any[] = [];
      if (filterCourse !== 'All') constraints.push(where('course', '==', filterCourse));
      if (filterSubject !== 'All') constraints.push(where('subject', '==', filterSubject));
      if (filterDifficulty !== 'All') constraints.push(where('difficulty', '==', filterDifficulty));
      if (filterYear !== 'All') constraints.push(where('year', '==', filterYear));
      if (filterStatus !== 'All') constraints.push(where('status', '==', filterStatus));

      if (filterStatus !== 'All') constraints.push(where('status', '==', filterStatus));

      // New Server Side Filters
      if (filterTeacher !== 'All') constraints.push(where('teacherId', '==', filterTeacher));
      if (filterChapter !== 'All') constraints.push(where('chapter', '==', filterChapter));

      // Server-Side Filtering for Deleted Items Only
      // We ONLY apply this constraint if we are looking for the Delete Bin.
      // For "Active" items, we cannot simply say `where('isDeleted', '==', false)` because
      // legacy documents missing the 'isDeleted' field would be EXCLUDED by Firestore.
      if (showDeleted) {
        constraints.push(where('isDeleted', '==', true));
      }

      if (constraints.length > 0) {
        q = query(collection(db, 'questions'), ...constraints, orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));
      } else {
        // Fallback to simple query
        q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'), limit(ITEMS_PER_PAGE));
      }

      if (isLoadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      console.log("Firestore snapshot size:", snapshot.size);

      const fetched: Question[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Question, 'id'>),
        createdAt: parseCreatedAt(doc.data())
      }));

      // Client-side filtering:
      // 1. Search Query
      // 2. isDeleted 
      // 3. Date Range (To avoid composite index hell)
      const filtered = fetched.filter(q => {
        const matchesSearch = searchQuery ? q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) : true;

        // If we are in "Active Mode" (showDeleted=false), we must HIDE items that are isDeleted=true
        // We include items where isDeleted is false OR undefined.
        const matchesStatus = showDeleted ? true : (q.isDeleted !== true);

        // Date Logic
        let matchesDate = true;
        if (dateRange && dateRange.from) {
          const qDate = q.createdAt;
          if (qDate) {
            if (dateRange.from && qDate < dateRange.from) matchesDate = false;
            if (dateRange.to) {
              // End of day
              const endOfDay = new Date(dateRange.to);
              endOfDay.setHours(23, 59, 59, 999);
              if (qDate > endOfDay) matchesDate = false;
            }
          }
        }

        return matchesSearch && matchesStatus && matchesDate;
      });

      console.log("Total fetched:", fetched.length, "After filtering:", filtered.length);

      if (isLoadMore) {
        setQuestions(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newUnique = filtered.filter(f => !existingIds.has(f.id));
          return [...prev, ...newUnique];
        });
      } else {
        setQuestions(filtered);
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);

      // Extract unique values for filters (from FETCHED data - adaptive)
      // Note: For Chapter/Teacher, we rely on the full lists we fetched separately.
      const subjects = new Set([...availableSubjects, ...fetched.map(q => q.subject || '')].filter(Boolean));
      setAvailableSubjects(Array.from(subjects));

      const courses = new Set([...availableCourses, ...fetched.map(q => q.course || '')].filter(Boolean));
      setAvailableCourses(Array.from(courses));

      const years = new Set([...availableYears, ...fetched.map(q => q.year || '')].filter(Boolean));
      setAvailableYears(Array.from(years));

      // Previously: fetchStats(fetched.map(q => q.id)); -> REMOVED for performance

    } catch (error) {
      console.error("Error fetching questions:", error);
      toast.error("Failed to fetch questions");
    } finally {
      setLoading(false);
    }
  }, [filterCourse, filterSubject, filterDifficulty, filterYear, filterStatus, filterTeacher, filterChapter, dateRange, searchQuery, showDeleted, lastDoc]); // eslint-disable-line

  // Filters Change Effect (Reset & Fetch)
  // Removed searchQuery from dependency to prevent auto-reload on type
  useEffect(() => {
    setLastDoc(null);
    fetchQuestions(false);
  }, [filterCourse, filterSubject, filterDifficulty, filterYear, filterStatus, filterTeacher, filterChapter, dateRange, showDeleted]); // eslint-disable-line

  // Handle Search Explicitly
  const handleSearch = () => {
    setLastDoc(null);
    fetchQuestions(false);
  };

  // REMOVED fetchStats: It was causing O(N) reads on the 'quizzes' collection
  // which is not scalable. Usage counts should be pre-calculated on the question document.


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

  const handleSoftDelete = async () => {
    if (selectedQuestions.length === 0) return;
    if (!confirm(`Move ${selectedQuestions.length} questions to Delete Bin?`)) return;

    setLoading(true);
    try {
      // Helper for chunking
      const chunkSize = 450;
      for (let i = 0; i < selectedQuestions.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = selectedQuestions.slice(i, i + chunkSize);
        chunk.forEach(id => {
          batch.update(doc(db, 'questions', id), { isDeleted: true, updatedAt: new Date() });
        });
        await batch.commit();
      }

      setQuestions(prev => prev.filter(q => !selectedQuestions.includes(q.id)));
      setSelectedQuestions([]);
      toast.success("Questions moved to Delete Bin");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete questions");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (selectedQuestions.length === 0) return;
    setLoading(true);
    try {
      const chunkSize = 450;
      for (let i = 0; i < selectedQuestions.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = selectedQuestions.slice(i, i + chunkSize);
        chunk.forEach(id => {
          batch.update(doc(db, 'questions', id), { isDeleted: false, updatedAt: new Date() });
        });
        await batch.commit();
      }

      setQuestions(prev => prev.filter(q => !selectedQuestions.includes(q.id)));
      setSelectedQuestions([]);
      toast.success("Questions restored successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore questions");
    } finally {
      setLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (selectedQuestions.length === 0) return;
    if (!confirm(`PERMANENTLY DELETE ${selectedQuestions.length} questions? This cannot be undone.`)) return;

    setLoading(true);
    try {
      const chunkSize = 450;
      for (let i = 0; i < selectedQuestions.length; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = selectedQuestions.slice(i, i + chunkSize);
        chunk.forEach(id => {
          batch.delete(doc(db, 'questions', id));
        });
        await batch.commit();
      }

      setQuestions(prev => prev.filter(q => !selectedQuestions.includes(q.id)));
      setSelectedQuestions([]);
      toast.success("Questions permanently deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete questions");
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (question: Question) => {
    // Navigate to create page with pre-fill data? 
    // Or duplicate directly. Let's direct duplication for speed.
    try {
      const { id, ...data } = question; // eslint-disable-line
      const newDoc = await import('firebase/firestore').then(mod => mod.addDoc(collection(db, 'questions'), {
        ...data,
        questionText: `${data.questionText} (Copy)`,
        createdAt: new Date(),
      }));
      toast.success("Question duplicated!");
      // Optional: Add to current list
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
    link.setAttribute("download", "questions_export.csv");
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
        const docRef = doc(db, 'questions', id);
        batch.update(docRef, { ...batchUpdateData, updatedAt: new Date() });
      });
      await batch.commit();

      // Update local state
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
      await updateDoc(doc(db, 'questions', id), { status: newStatus, updatedAt: new Date() });
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
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">Question Bank</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and organize your examination content.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/questions/create')} className="bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
            <Plus className="mr-2 h-4 w-4" /> New Question
          </Button>
          <Button variant="secondary" className="gap-2" onClick={() => fetchQuestions(false)}>
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

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-4 bg-gray-50/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row gap-4 items-center justify-between transition-all">

        {/* Search & Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-1 max-w-2xl">
          <div className="relative flex-1 md:min-w-[300px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions (Press Enter)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 bg-white dark:bg-gray-800"
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1 h-8 w-8 p-0"
              onClick={handleSearch}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
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
                {/* Course Filter */}
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

                {/* Subject Filter */}
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

                {/* Chapter Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Chapter</label>
                  <Select value={filterChapter} onValueChange={setFilterChapter} disabled={filterSubject === 'All'}>
                    <SelectTrigger><SelectValue placeholder="All Chapters" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Chapters</SelectItem>
                      {availableChapters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Teacher Filter */}
                {(userRole === 'admin' || isSuperAdmin) && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Teacher</label>
                    <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                      <SelectTrigger><SelectValue placeholder="All Teachers" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All Teachers</SelectItem>
                        {teachersList.map(t => <SelectItem key={t.uid} value={t.uid}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Date Filter */}
                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-medium">Date Range</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !dateRange && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
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
          </Sheet >
        </div >

        {/* Bulk Actions */}
        {
          selectedQuestions.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800 animate-in fade-in slide-in-from-top-2">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{selectedQuestions.length} Selected</span>
              <div className="h-4 w-px bg-blue-200 dark:bg-blue-700 mx-2" />

              {/* Only Admins/SuperAdmins can Delete/Restore generally. Teachers might delete their own, but let's restrict bulk delete for safety or allow if owner logic is complex. 
                For now, restrict Soft/Hard Delete to Admins. Teachers can only Update. 
             */}
              {(isSuperAdmin || userRole === 'admin') && (
                <>
                  {!showDeleted ? (
                    <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={handleSoftDelete}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30" onClick={handleRestore}>
                        <RefreshCw className="h-4 w-4 mr-1" /> Restore
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30" onClick={handlePermanentDelete}>
                        <AlertTriangle className="h-4 w-4 mr-1" /> Permanent Delete
                      </Button>
                    </>
                  )}
                </>
              )}

              <Button size="sm" variant="ghost" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={() => setIsBatchEditing(true)}>
                <Edit className="h-4 w-4 mr-1" /> Update
              </Button>
              <Button size="sm" variant="ghost" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </div>
          )
        }
      </div >

      {/* Main Table */}
      < div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden" >
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
              <TableHead className="text-gray-700 dark:text-gray-300">Added By</TableHead>
              <TableHead className="text-gray-700 dark:text-gray-300">Stats</TableHead>
              <TableHead className="text-gray-700 dark:text-gray-300">Details</TableHead>
              <TableHead className="text-right text-gray-700 dark:text-gray-300">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-64 text-center text-gray-500">
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
                  <TableCell>
                    <div className="flex flex-col gap-1 text-[10px]">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {question.teacher || 'System'}
                      </span>
                      <span className="text-muted-foreground text-[9px]">
                        {question.isDeleted ? '(Deleted)' : ''}
                      </span>
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
                          <DropdownMenuItem onClick={() => router.push(`/admin/questions/create?id=${question.id}`)}>
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
                          <DropdownMenuItem onClick={() => {
                            setSelectedQuestions([question.id]);
                            handleSoftDelete();
                          }} className="text-red-600 dark:text-red-400">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
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
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>

        {/* Sentinel for Infinite Scroll */}
        {
          hasMore && (
            <div
              className="p-8 flex justify-center items-center"
              ref={(node) => {
                if (loading) return;
                const obs = new IntersectionObserver(entries => {
                  if (entries[0].isIntersecting && hasMore) {
                    fetchQuestions(true);
                  }
                }, { threshold: 1.0 });
                if (node) obs.observe(node);
              }}
            >
              {loading && <div className="text-gray-400 text-sm animate-pulse">Loading more questions...</div>}
              {!loading && <div ref={lastQuestionElementRef as any} className="h-10 w-full" />}
            </div>
          )
        }
      </div >

      {/* Preview Modal */}
      < Dialog open={!!previewQuestion
      } onOpenChange={(open) => !open && setPreviewQuestion(null)}>
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
                  </div>
                ))}
              </div>

              {previewQuestion.enableExplanation && previewQuestion.explanation && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                  <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2 flex items-center gap-2">
                    <Eye className="h-4 w-4" /> Explanation
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {previewQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog >

      {/* Batch Edit Modal */}
      < Dialog open={isBatchEditing} onOpenChange={setIsBatchEditing} >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Update Metadata</DialogTitle>
            <DialogDescription>
              Update {selectedQuestions.length} selected questions at once. Only selected fields will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Course</label>
              <Select value={batchUpdateData.course} onValueChange={(v) => setBatchUpdateData(prev => ({ ...prev, course: v }))}>
                <SelectTrigger><SelectValue placeholder="No Change" /></SelectTrigger>
                <SelectContent>
                  {availableCourses.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <Select value={batchUpdateData.subject} onValueChange={(v) => setBatchUpdateData(prev => ({ ...prev, subject: v }))}>
                <SelectTrigger><SelectValue placeholder="No Change" /></SelectTrigger>
                <SelectContent>
                  {availableSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <div className="flex gap-2">
                {['Easy', 'Medium', 'Hard'].map(lvl => (
                  <Button
                    key={lvl}
                    size="sm"
                    variant={batchUpdateData.difficulty === lvl ? 'default' : 'outline'}
                    onClick={() => setBatchUpdateData(prev => ({ ...prev, difficulty: lvl }))}
                  >
                    {lvl}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="flex gap-2">
                {['draft', 'published', 'review'].map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={batchUpdateData.status === s ? 'default' : 'outline'}
                    onClick={() => setBatchUpdateData(prev => ({ ...prev, status: s as any }))}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setIsBatchEditing(false)}>Cancel</Button>
            <Button onClick={handleBulkUpdate} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog >
      {/* Question Analytics Sheet */}
      < QuestionAnalyticsSheet
        question={analyticsQuestion}
        onClose={() => setAnalyticsQuestion(null)}
      />


      {/* Scroll To Top Button */}
      {
        showScrollTop && (
          <Button
            className="fixed bottom-8 right-8 rounded-full shadow-lg z-50 p-3 h-12 w-12 bg-blue-600 hover:bg-blue-700 text-white animate-in fade-in slide-in-from-bottom-4"
            onClick={scrollToTop}
          >
            <ArrowUp className="h-6 w-6" />
          </Button>
        )
      }

    </div >
  );
}

function QuestionAnalyticsSheet({ question, onClose }: { question: Question | null, onClose: () => void }) {
  const [usedInQuizzes, setUsedInQuizzes] = useState<{ id: string, title: string }[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);

  useEffect(() => {
    if (!question) {
      setUsedInQuizzes([]);
      return;
    }
    const fetchQuizzes = async () => {
      setLoadingQuizzes(true);
      try {
        const qSnap = await getDocs(collection(db, 'quizzes'));
        const linked = qSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(quiz => (quiz.selectedQuestions || []).some((q: any) => q.id === question.id));
        setUsedInQuizzes(linked.map(q => ({ id: q.id, title: q.title })));
      } catch (err) {
        console.error("Failed to fetch used in quizzes:", err);
      } finally {
        setLoadingQuizzes(false);
      }
    };
    fetchQuizzes();
  }, [question]);

  if (!question) return null;

  const totalAttempts = question.totalAttempts || 0;
  const correctAttempts = question.correctAttempts || 0;
  const successRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const avgTime = totalAttempts > 0 && question.totalTimeSpent
    ? Math.round(question.totalTimeSpent / totalAttempts)
    : 0;

  return (
    <Sheet open={!!question} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <BarChart2 className="h-6 w-6 text-blue-600" />
            Performance Analytics
          </SheetTitle>
          <SheetDescription>
            Detailed performance breakdown for this question.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-8">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-blue-50/50 border-blue-100">
              <div className="text-sm text-blue-600 font-medium">Total Attempts</div>
              <div className="text-3xl font-bold text-blue-900 mt-1">{totalAttempts}</div>
            </Card>
            <Card className="p-4 bg-green-50/50 border-green-100">
              <div className="text-sm text-green-600 font-medium">Success Rate</div>
              <div className="text-3xl font-bold text-green-900 mt-1">{successRate}%</div>
            </Card>
            <Card className="p-4 bg-purple-50/50 border-purple-100">
              <div className="text-sm text-purple-600 font-medium">Usage Count</div>
              <div className="text-3xl font-bold text-purple-900 mt-1">{question.usageCount || 0} Quizzes</div>
            </Card>
            <Card className="p-4 bg-orange-50/50 border-orange-100">
              <div className="text-sm text-orange-600 font-medium">Avg. Time</div>
              <div className="text-3xl font-bold text-orange-900 mt-1">{avgTime}s</div>
            </Card>
          </div>

          {/* Option Distribution */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-gray-500" />
              Option Distribution (Distractor Analysis)
            </h3>
            <div className="space-y-3">
              {question.options.map((option, idx) => {
                const count = question.optionCounts?.[option] || 0;
                const percentage = totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0;
                const isCorrect = option === question.correctAnswer;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-gray-700'}`}>
                        Option {String.fromCharCode(65 + idx)} {isCorrect && '(Correct)'}
                      </span>
                      <span className="text-gray-500">{count} selections ({percentage}%)</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isCorrect ? 'bg-green-500' : 'bg-blue-400'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Difficulty Correlation */}
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Difficulty Correlation</h3>
            <div className="flex items-start gap-3">
              {totalAttempts < 5 ? (
                <>
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <p className="text-sm text-gray-600">
                    Not enough attempt data to provide difficulty correlation insights yet.
                  </p>
                </>
              ) : (
                <>
                  {question.difficulty === 'Easy' && successRate < 60 ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-amber-700">Refinement Suggested:</span> This question is marked as <span className="font-bold">Easy</span>, but the success rate is only <span className="font-bold text-red-600">{successRate}%</span>. Consider reviewing the distractors or re-labeling it.
                      </p>
                    </>
                  ) : question.difficulty === 'Hard' && successRate > 75 ? (
                    <>
                      <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-blue-700">Observation:</span> This question is marked as <span className="font-bold">Hard</span>, but students are succeeding at <span className="font-bold text-green-600">{successRate}%</span>. It might be easier than expected.
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold text-green-700">Perfect Alignment:</span> The assigned difficulty (<span className="font-bold">{question.difficulty}</span>) matches student performance well.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Linked Quizzes */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Plus className="h-5 w-5 text-gray-500" />
              Linked Quizzes ({usedInQuizzes.length})
            </h3>
            <div className="space-y-2">
              {loadingQuizzes ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-10 bg-gray-100 rounded w-full"></div>
                  <div className="h-10 bg-gray-100 rounded w-full"></div>
                </div>
              ) : usedInQuizzes.length > 0 ? (
                usedInQuizzes.map(quiz => (
                  <div key={quiz.id} className="flex items-center justify-between p-3 bg-white border rounded-lg hover:border-blue-200 transition-colors">
                    <span className="text-sm font-medium text-gray-700 truncate">{quiz.title}</span>
                    <Link href={`/admin/quizzes/create?id=${quiz.id}`} passHref>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 h-8"
                      >
                        View Quiz
                      </Button>
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">This question is not used in any quizzes yet.</p>
              )}
            </div>
          </div>

          {/* Question Meta */}
          <div className="pt-4 border-t border-gray-100">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Field</span>
                <span className="font-medium text-gray-900">Value</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subject</span>
                <span>{question.subject}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Difficulty</span>
                <Badge variant="outline" className="h-5 text-[10px]">{question.difficulty}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Last Used</span>
                <span>{question.lastUsedAt ? new Date(question.lastUsedAt.seconds * 1000).toLocaleDateString() : 'Never'}</span>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="mt-8">
          <SheetClose asChild>
            <Button variant="outline" className="w-full">Close Analytics</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
