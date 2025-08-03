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
import { ArrowRight, BookOpen, Calendar, Clock, Play, Pencil, Eye } from 'lucide-react';
import Link from 'next/link';

function getQuizStatus(startDate: string, endDate: string, startTime?: string, endTime?: string) {
  const now = new Date('2025-08-03T16:55:00+05:00');
  const start = new Date(`${startDate}T${startTime || '00:00'}`);
  const end = new Date(`${endDate}T${endTime || '23:59'}`);
  console.log(`Now: ${now}, Start: ${start}, End: ${end}`);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'active';
  return 'ended';
}

export default function QuizBankPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<string[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
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
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const router = useRouter();

  const fetchQuizzes = async (startAfterDoc: any = null) => {
    if (!currentUser) return;

    const isAdmin = currentUser.isAdmin;
    let courseIds: string[] = enrolledCourses;

    const constraints = [orderBy('createdAt', 'desc'), limit(2)];
    if (!isAdmin) {
      constraints.push(where('published', '==', true));
      if (courseIds.length > 0) {
        constraints.push(where('course.id', 'in', courseIds));
      }
    }
    if (startAfterDoc) {
      constraints.push(startAfter(startAfterDoc));
    }

    const q = query(collection(db, 'quizzes'), ...constraints);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const quizData = doc.data();
        const subject = (() => {
          if (quizData.questionFilters?.subjects?.length) {
            return quizData.questionFilters.subjects.join(', ');
          } else if (Array.isArray(quizData.subjects)) {
            return quizData.subjects
              .map((s: any) => (typeof s === 'string' ? s : s?.name || '[Invalid]'))
              .join(', ');
          } else if (quizData.subject?.name) {
            return quizData.subject.name;
          } else if (typeof quizData.subject === 'string') {
            return quizData.subject;
          } else {
            return '';
          }
        })();

        const chapter = (() => {
          if (quizData.questionFilters?.chapters?.length) {
            return quizData.questionFilters.chapters.join(', ');
          } else if (quizData.chapter?.name) {
            return quizData.chapter.name;
          } else if (typeof quizData.chapter === 'string') {
            return quizData.chapter;
          } else {
            return '';
          }
        })();

        const course =
          quizData.course?.name ||
          (typeof quizData.course === 'string' ? quizData.course : '') ||
          '';

        return {
          id: doc.id,
          ...quizData,
          course,
          subject,
          chapter,
        };
      });

      setQuizzes((prev) => (startAfterDoc ? [...prev, ...data] : data));
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 2);
      setLoading(false);
    });

    unsubscribeRef.current = unsubscribe;
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const isAdmin = userData.admin === true;
        const userPlan = userData.plan || 'free';

        let courseIds: string[] = [];
        if (!isAdmin) {
          const coursesSnapshot = await getDocs(collection(db, 'users', user.uid, 'courses'));
          courseIds = coursesSnapshot.docs.map((doc) => doc.id);
          setEnrolledCourses(courseIds);
        }

        setCurrentUser({ ...user, isAdmin, plan: userPlan });
        fetchQuizzes();

        const attemptsSnapshot = await getDocs(
          collection(db, 'users', user.uid, 'quizAttempts')
        );
        const attempted = attemptsSnapshot.docs
          .filter((doc) => doc.data()?.completed)
          .map((doc) => doc.id);
        setAttemptedQuizzes(attempted);
      } else {
        setQuizzes([]);
        setLoading(false);
        setCurrentUser(null);
        setHasMore(false);
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
    if (currentUser) {
      setQuizzes([]);
      setLastVisible(null);
      setHasMore(true);
      fetchQuizzes();
    }
  }, [filters, currentUser, enrolledCourses]);

  const filteredQuizzes = quizzes.filter((quiz) => {
    const { course, subject, chapter, accessType, searchTerm, status, date } = filters;
    const quizStatus = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
    const matches = [
      !course || quiz.course === course,
      !subject || quiz.subject === subject,
      !chapter || quiz.chapter === chapter,
      !accessType || quiz.accessType === accessType,
      !searchTerm || (quiz.title || '').toLowerCase().includes(searchTerm.toLowerCase()),
      !status || status === quizStatus,
      !date || quiz.startDate === date,
    ];
    return matches.every(Boolean);
  });

  const uniqueValues = (key: string) => {
    return [...new Set(quizzes.map((q) => q[key]).filter(Boolean))];
  };

  const handleQuizClick = (quiz: any) => {
    if (!currentUser?.isAdmin && currentUser?.plan === 'free' && quiz.accessType === 'paid') {
      setSelectedQuizId(quiz.id);
      setShowPremiumDialog(true);
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

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">📝 Available Quizzes</h1>

      <Card className="border-0 shadow-lg mb-8 sm:mb-10">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
            {['course', 'subject', 'chapter', 'accessType'].map((key) => (
              <Select
                key={key}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, [key]: v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={key.charAt(0).toUpperCase() + key.slice(1)} />
                </SelectTrigger>
                <SelectContent>
                  {uniqueValues(key).map((val) => (
                    <SelectItem
                      key={typeof val === 'object' ? val?.id : val}
                      value={typeof val === 'object' ? val?.name : val}
                    >
                      {typeof val === 'object' ? val?.name : val}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            <Select
              onValueChange={(v) =>
                setFilters((prev) => ({ ...prev, status: v }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.date}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, date: e.target.value }))
              }
              className="w-full"
            />
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

      {loading && quizzes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-4 border-b-4 border-green-600"></div>
          <p className="text-gray-600 text-base sm:text-lg animate-pulse">Fetching your quizzes...</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <p className="text-gray-500 text-center py-10 text-base sm:text-lg">
          No quizzes available for your enrolled courses.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredQuizzes.map((quiz) => {
              const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
              const isAttempted = attemptedQuizzes.includes(quiz.id);

              const courseName =
                typeof quiz.course === 'object' && 'name' in quiz.course
                  ? quiz.course.name
                  : quiz.course || '';
              const subjectName =
                typeof quiz.subject === 'object' && 'name' in quiz.subject
                  ? quiz.subject.name
                  : quiz.subject || '';
              const chapterName =
                typeof quiz.chapter === 'object' && 'name' in quiz.chapter
                  ? quiz.chapter.name
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
                          <span className="font-medium">{quiz.maxAttempts}</span>
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
                      ) : isAttempted ? (
                        <Button variant="outline" disabled className="w-full h-10 sm:h-12">
                          Attempted
                        </Button>
                      ) : status === 'upcoming' ? (
                        <Button variant="outline" disabled className="w-full h-10 sm:h-12">
                          Upcoming
                        </Button>
                      ) : quiz.accessType === 'paid' && currentUser?.plan === 'free' ? (
                        <Button
                          className="w-full h-10 sm:h-12 bg-green-600 text-white"
                          onClick={() => handleQuizClick(quiz)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Quiz
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      ) : (
                        <Button className="w-full h-10 sm:h-12 bg-green-600 text-white" asChild>
                          <Link href={`/quiz/start?id=${quiz.id}`}>
                            <Play className="h-4 w-4 mr-2" />
                            Start Quiz
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      )}

                      {currentUser?.isAdmin && (
                        <Button
                          variant="secondary"
                          className="w-full h-9 sm:h-10 mt-2 rounded-xl"
                          asChild
                        >
                          <Link href={`/admin/quizzes/create?id=${quiz.id}`}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit Quiz
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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