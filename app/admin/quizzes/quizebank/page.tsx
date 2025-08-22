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
  const [filters, setFilters] = useState({
    accessType: '',
    searchTerm: '',
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
          const course = (userData as any).course;

          if (!isAdmin && (!course || typeof course !== 'string')) {
            setError('Invalid enrollment: You must be enrolled in a course.');
            setLoading(false);
            setUserLoaded(true);
            return;
          }

          setCurrentUser({ ...user, isAdmin, plan: userPlan });
          setEnrolledCourse(isAdmin ? null : course);

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
      const isAdmin = currentUser.isAdmin;
      const courseName = enrolledCourse;

      const constraints: any[] = [ orderBy('startDate', 'desc'), limit(20) ];

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

          // Sort newest to oldest by startDate (descending)
          data = data.sort((a, b) => {
            // fallback to '' if missing
            return (b.startDate || '').localeCompare(a.startDate || '');
          });

          setQuizzes((prev) => (startAfterDoc ? [...prev, ...data] : data));
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === 20);
          setLoading(false);
        },
        (error) => {
          setError(`Failed to fetch quizzes: ${error.message}. Please try again or create the required index at the provided link.`);
          setLoading(false);
          setHasMore(false);
        }
      );

      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      setError('Failed to fetch quizzes. Please try again.');
      setLoading(false);
      setHasMore(false);
    }
  };

  // Only Search and Access Type filtering
  const filteredQuizzes = quizzes.filter((quiz) => {
    const { accessType, searchTerm } = filters;
    const matches = [
      !accessType || quiz.accessType === accessType,
      !searchTerm || (quiz.title || '').toLowerCase().includes(searchTerm.toLowerCase()),
    ];
    return matches.every(Boolean);
  });

  // Group quizzes by date for date headings (newest first)
  const groupedByDate = filteredQuizzes.reduce((acc: Record<string, any[]>, quiz) => {
    const date = quiz.startDate || 'Unknown Date';
    if (!acc[date]) acc[date] = [];
    acc[date].push(quiz);
    return acc;
  }, {});

  // Sorted date keys newest on top
  const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const handleQuizClick = async (quiz: any) => {
    if (!currentUser?.isAdmin && currentUser?.plan === 'free' && quiz.accessType === 'paid') {
      setSelectedQuizId(quiz.id);
      setShowPremiumDialog(true);
      return;
    }

    const attemptCount = attemptedQuizzes[quiz.id] || 0;
    const maxAttempts = quiz.maxAttempts || 1;

    if (attemptCount >= maxAttempts && !currentUser?.isAdmin) {
      alert('You have reached the maximum number of attempts for this quiz.');
      return;
    }

    router.push(`/quiz/start?id=${quiz.id}`);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      setLoading(true);
      fetchQuizzes(lastVisible);
    }
  };

  const handleDeleteClick = (quiz: any) => {
    setQuizToDelete(quiz);
    setDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (quizToDelete?.id) {
      try {
        await deleteDoc(doc(db, 'quizzes', quizToDelete.id));
        setQuizzes(quizzes.filter((q) => q.id !== quizToDelete.id));
        setDeleteModal(false);
      } catch (err) {
        alert('Failed to delete quiz.');
      }
    }
  };

  // Unique accessType values for filter dropdown
  const uniqueAccessTypes = Array.from(new Set(quizzes.map((q) => q.accessType).filter(Boolean)));

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">📝 Available Quizzes</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <Card className="border-0 shadow-lg mb-8 sm:mb-10">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              placeholder="Search quizzes..."
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  searchTerm: e.target.value,
                }))
              }
              className="w-full"
            />
            <Select
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, accessType: v }))
              }
              value={filters.accessType}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Access Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {uniqueAccessTypes.map((val) => (
                  <SelectItem key={val} value={val}>
                    {val.charAt(0).toUpperCase() + val.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog}>
        <DialogContent className="w-[90vw] max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Premium Subscription Required</DialogTitle>
            <DialogDescription>
              This quiz requires a premium subscription. Upgrade your plan to access this content.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => setShowPremiumDialog(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 text-white w-full sm:w-auto"
              onClick={() => router.push('/pricing')}
            >
              Subscribe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Are you sure you want to delete <strong>{quizToDelete?.title}</strong>? This action cannot be undone.
          </DialogDescription>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-4 border-b-4 border-green-600"></div>
          <p className="text-gray-600 text-base sm:text-lg animate-pulse">Fetching your quizzes...</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <p className="text-gray-500 text-center py-10 text-base sm:text-lg">
          No quizzes available for your enrolled course.
        </p>
      ) : (
        <>
          <div>
            {sortedDateKeys.map((date) => (
              <div key={date} className="mb-8">
                <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-800 border-b pb-1">
                  {date}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {groupedByDate[date].map((quiz) => {
                    const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
                    const attemptCount = attemptedQuizzes[quiz.id] || 0;
                    const canAttempt = attemptCount < (quiz.maxAttempts || 1);

                    const courseName =
                      typeof quiz.course === 'object' && 'name' in quiz.course
                        ? (quiz.course as any).name
                        : quiz.course || '';
                    const subjectName =
                      typeof quiz.subject === 'object' && 'name' in quiz.subject
                        ? (quiz.subject as any).name
                        : quiz.subject || '';
                    const chapterName =
                      typeof quiz.chapter === 'object' && 'name' in quiz.chapter
                        ? (quiz.chapter as any).name
                        : quiz.chapter || '';

                    return (
                      <Card
                        key={quiz.id}
                        className="shadow-md hover:shadow-lg transition-all duration-300 w-full h-[460px] sm:h-[480px] lg:h-[500px] flex flex-col"
                      >
                        <CardHeader className="pb-2 sm:pb-3">
                          <CardTitle className="text-lg sm:text-xl font-bold text-gray-900 mb-1 line-clamp-2">
                            {quiz.title}
                          </CardTitle>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {quiz.description}
                          </p>
                        </CardHeader>
                        <CardContent className="space-y-4 flex-grow flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm text-gray-700">
                              <div className="flex items-center space-x-2">
                                <BookOpen className="h-4 w-4 text-gray-500" />
                                <span>{quiz.selectedQuestions?.length || 0} questions</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span>{quiz.duration} min</span>
                              </div>
                              <div className="col-span-2 line-clamp-1">
                                <strong>Course:</strong> {courseName}
                              </div>
                              <div className="col-span-2 line-clamp-1">
                                <strong>Subject:</strong> {subjectName}
                              </div>
                              {chapterName && (
                                <div className="col-span-2 line-clamp-1">
                                  <strong>Chapter:</strong> {chapterName}
                                </div>
                              )}
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Access:</span>
                                <span className="font-medium capitalize">{quiz.accessType}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Attempts:</span>
                                <span className="font-medium">{attemptCount} / {quiz.maxAttempts}</span>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1 text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {quiz.startDate} - {quiz.endDate}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2">
                            {currentUser?.isAdmin ? (
                              <Button className="w-full h-10 sm:h-12 bg-blue-600 text-white" asChild>
                                <Link href={`/quiz/start?id=${quiz.id}`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview Quiz
                                  <ArrowRight className="h-4 w-4 ml-2" />
                                </Link>
                              </Button>
                            ) : status === 'ended' ? (
                              <Button variant="outline" disabled className="w-full h-10 sm:h-12">
                                Quiz Ended
                              </Button>
                            ) : status === 'upcoming' ? (
                              <Button variant="outline" disabled className="w-full h-10 sm:h-12">
                                Upcoming
                              </Button>
                            ) : !canAttempt ? (
                              <Button variant="outline" disabled className="w-full h-10 sm:h-12">
                                Max Attempts Reached
                              </Button>
                            ) : (
                              <Button
                                className="w-full h-10 sm:h-12 bg-green-600 text-white"
                                onClick={() => handleQuizClick(quiz)}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                {attemptCount > 0 ? 'Retake Quiz' : 'Start Quiz'}
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Button>
                            )}

                            {currentUser?.isAdmin && (
                              <>
                                <Button
                                  variant="secondary"
                                  className="w-full h-9 sm:h-10 mt-2 rounded-xl"
                                  asChild
                                >
                                  <Link href={`/admin/quizzes/create?id=${quiz.id}`}>
                                    <Pencil className="h-4 w-4 mr-2" /> Edit Quiz
                                  </Link>
                                </Button>
                                <Button
                                  variant="destructive"
                                  className="w-full h-9 sm:h-10 mt-2 rounded-xl"
                                  onClick={() => handleDeleteClick(quiz)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete Quiz
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 sm:mt-8 text-center">
              <Button
                onClick={handleLoadMore}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-3 text-sm sm:text-base"
              >
                {loading ? 'Loading...' : 'Load More Quizzes'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
