'use client';

import { useEffect, useState, useRef } from 'react';
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

    console.log('🕐 Now:', now.toString());
    console.log('🚀 Start:', start.toString());
    console.log('🛑 End:', end.toString());

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
  const [enrolledCourse, setEnrolledCourse] = useState<string | null>(null); // Single course name
  const [userLoaded, setUserLoaded] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({
    course: '',
    subject: '',
    chapter: '',
    accessType: '',
    searchTerm: '',
    status: '',
    date: '',
  });
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const router = useRouter();

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
          const course = (userData as any).course; // Fetch course directly from user document

          console.log('User Data:', userData);

          if (!isAdmin && (!course || typeof course !== 'string')) {
            console.error('Invalid or missing course for user:', user.uid, course);
            setError('Invalid enrollment: You must be enrolled in a course.');
            setLoading(false);
            setUserLoaded(true);
            return;
          }

          setCurrentUser({ ...user, isAdmin, plan: userPlan });
          setEnrolledCourse(isAdmin ? null : course); // Set single course for non-admins

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
          console.error('Error fetching user data:', err);
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

  useEffect(() => {
    if (userLoaded && currentUser) {
      setLastVisible(null);
      setHasMore(true);
      fetchQuizzes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, currentUser, enrolledCourse, userLoaded]);

  const fetchQuizzes = async (startAfterDoc: any = null) => {
    if (!currentUser) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Fetching quizzes for user:', currentUser.uid, 'Enrolled Course:', enrolledCourse);

      const isAdmin = currentUser.isAdmin;
      const courseName = enrolledCourse;

      const constraints: any[] = [ limit(10)];

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
        console.log('Query Constraints:', constraints);
      }

      if (startAfterDoc) {
        constraints.push(startAfter(startAfterDoc));
      }

      const q = query(collection(db, 'quizzes'), ...constraints);

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((d) => {
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

          console.log('Fetched Quizzes:', data);

          setQuizzes((prev) => (startAfterDoc ? [...prev, ...data] : data));
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === 10);
          setLoading(false);
        },
        (error) => {
          console.error('Firestore Query Error:', error.code, error.message);
          setError(`Failed to fetch quizzes: ${error.message}. Please try again or create the required index at the provided link.`);
          setLoading(false);
          setHasMore(false);
        }
      );
