'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDoc,
  doc,
  getDocs,
  where,
  limit,
  startAfter,
  deleteDoc,
} from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../../../firebase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArrowRight, BookOpen, Calendar, Clock, Play, Pencil, Eye, Trash2 } from 'lucide-react';
import Link from 'next/link';

function getQuizStatus(startDate: string, endDate: string, startTime?: string, endTime?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;

  try {
    if (!startDate || !endDate) {
      console.warn('Invalid startDate or endDate:', { startDate, endDate });
      return 'ended';
    }

    if (startTime && /^\d{2}:\d{2}$/.test(startTime)) {
      const [y, m, d] = startDate.split('-').map(Number);
      const [h, min] = startTime.split(':').map(Number);
      start = new Date(y, m - 1, d, h, min);
    } else {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
    }

    if (endTime && /^\d{2}:\d{2}$/.test(endTime)) {
      const [y, m, d] = endDate.split('-').map(Number);
      const [h, min] = endTime.split(':').map(Number);
      end = new Date(y, m - 1, d, h, min);
    } else {
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn('Invalid date parsed:', { start, end });
      return 'ended';
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🕐 Now:', now.toString());
      console.log('🚀 Start:', start.toString());
      console.log('🛑 End:', end.toString());
    }

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'active';
    return 'ended';
  } catch (error) {
    console.error('Error in getQuizStatus:', error);
    return 'ended';
  }
}

export default function QuizBankPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<{ [key: string]: number }>({});
  const [enrolledCourse, setEnrolledCourse] = useState<string | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  // Only keep searchTerm and accessType in filters
  const [filters, setFilters] = useState({
    searchTerm: '',
    accessType: '',
  });
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setError(null);

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          const userData = userSnap.exists() ? userSnap.data() : {} as any;
          const isAdmin = (userData as any).admin === true;
          const userPlan = (userData as any).plan || 'free';
          const course = (userData as any).course;

          if (!isAdmin && (!course || typeof course !== 'string')) {
            setError('Invalid enrollment: You must be enrolled in a course.');
            setLoading(false);
            setUserLoaded(true);
            return;
          }

          setCurrentUser({ ...user, isAdmin, plan: userPlan });
          setEnrolledCourse(isAdmin ? null : course);

          // Fetch quiz attempts
          const attemptsSnapshot = await getDocs(
            collection(db, 'users', user.uid, 'quizAttempts')
          );
          const attempted: { [key: string]: number } = {};
          attemptsSnapshot.docs.forEach((d) => {
            const data = d.data() as any;
            if (data?.completed) {
              attempted[d.id] = data.attemptNumber || 1;
            }
          });
          setAttemptedQuizzes(attempted);
          setUserLoaded(true);
        } catch (err) {
          setError('Failed to load user data. Please try again.');
          setLoading(false);
          setUserLoaded(true);
        }
      } else {
        setQuizzes([]);
        setEnrolledCourse(null);
        setCurrentUser(null);
        setHasMore(false);
        setUserLoaded(true);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      unsubscribeAuth();
    };
  }, []);

  const fetchQuizzes = useCallback(
    async (startAfterDoc: any = null) => {
      if (!currentUser) return;

      setLoading(true);
      setError(null);

      try {
        const isAdmin = currentUser.isAdmin;
        const courseName = enrolledCourse;
        const constraints: any[] = [
          orderBy('publishedAt', 'desc'), // sort by published date, newest first
          limit(30),
        ];

        if (!isAdmin) {
          if (!courseName) {
            setError('No course enrolled. Please enroll in a course to view quizzes.');
            setQuizzes([]);
            setLoading(false);
            setHasMore(false);
            return;
          }
          constraints.push(where('published', '==', true));
          constraints.push(where('course.name', '==', courseName));
        }

        // Access type filter
        if (filters.accessType) {
          constraints.push(where('accessType', '==', filters.accessType));
        }

        if (startAfterDoc) {
          constraints.push(startAfter(startAfterDoc));
        }

        const q = query(collection(db, 'quizzes'), ...constraints);

        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        unsubscribeRef.current = onSnapshot(
          q,
          (snapshot) => {
            let data = snapshot.docs.map((d) => {
              const quizData = d.data() as any;
              const course = quizData.course?.name || quizData.course || 'Unknown';
              const subject = Array.isArray(quizData.subjects)
                ? quizData.subjects.map((s: any) => s.name || s).join(', ')
                : quizData.subject?.name || quizData.subject || '';
              const chapter = quizData.chapter?.name || quizData.chapter || '';
              return {
                id: d.id,
                ...quizData,
                course,
                subject,
                chapter,
                maxAttempts: quizData.maxAttempts || 1,
              } as any;
            });

            // Search filter (client side, since Firestore doesn't support full text search)
            if (filters.searchTerm) {
              const search = filters.searchTerm.toLowerCase();
              data = data.filter((quiz) =>
                (quiz.title || '')
                  .toLowerCase()
                  .includes(search)
              );
            }

            setQuizzes(data);
            setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
            setHasMore(snapshot.docs.length === 30);
            setLoading(false);
          },
          (error) => {
            setError(
              `Failed to fetch quizzes: ${error.message}. Please try again or create the required index at the provided link.`
            );
            setLoading(false);
            setHasMore(false);
          }
        );
      } catch (err: any) {
        setError('Failed to fetch quizzes. Please try again.');
        setLoading(false);
        setHasMore(false);
      }
    },
    [currentUser, enrolledCourse, filters.accessType, filters.searchTerm]
  );

  useEffect(() => {
    if (userLoaded && currentUser) {
      setLastVisible(null);
      setHasMore(true);
      fetchQuizzes();
    }
  }, [filters, currentUser, enrolledCourse, userLoaded, fetchQuizzes]);

  // Group quizzes by published date (yyyy-mm-dd)
  const quizzesByDate = quizzes.reduce((acc: Record<string, any[]>, quiz) => {
    const date = quiz.publishedAt
      ? new Date(quiz.publishedAt.seconds ? quiz.publishedAt.seconds * 1000 : quiz.publishedAt)
      : null;
    const dateStr = date
      ? date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
      : 'Unknown Date';
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(quiz);
    return acc;
  }, {});

  // Sort dates descending (newest first)
  const sortedDates = Object.keys(quizzesByDate).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div className="container py-4">
      <div className="flex items-center gap-4 mb-6">
        <Input
          placeholder="Search quizzes..."
          value={filters.searchTerm}
          onChange={e => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
          className="max-w-xs"
        />

        <Select
          value={filters.accessType}
          onValueChange={val => setFilters(f => ({ ...f, accessType: val }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Access type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading && <div>Loading quizzes...</div>}
      {error && <div className="text-red-500">{error}</div>}
      {!loading && quizzes.length === 0 && <div>No quizzes found.</div>}
      {sortedDates.map(date => (
        <div key={date} className="mb-8">
          <h2 className="text-xl font-bold mb-3">
            {date === 'Unknown Date' ? date : `Published: ${date}`}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizzesByDate[date].map((quiz) => (
              <Card key={quiz.id}>
                <CardHeader>
                  <CardTitle>{quiz.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 text-sm">
                    <div>Course: {quiz.course}</div>
                    <div>Subject: {quiz.subject}</div>
                    <div>Chapter: {quiz.chapter}</div>
                    <div>Status: {getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime)}</div>
                    <div>Access: {quiz.accessType}</div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Link href={`/admin/mockquize/quizebank/${quiz.id}`}>
                      <Button size="sm" variant="outline" className="flex items-center gap-1">
                        <Eye size={16} /> View
                      </Button>
                    </Link>
                    {/* Add other actions if needed */}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
