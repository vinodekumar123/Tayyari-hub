'use client';

import { Quiz } from '@/types';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  limit,
  startAfter,
  deleteDoc,
  doc,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useUserStore } from '@/stores/useUserStore';
import { useCacheStore } from '@/stores/useCacheStore';
import { useUIStore } from '@/stores/useUIStore';
import { TableSkeleton, ListItemSkeleton } from '@/components/ui/skeleton-cards';
import { brandColors, animations, glassmorphism } from '@/lib/design-tokens';
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
import {
  ArrowRight, BookOpen, Calendar, Clock, Play, Pencil, Eye, Trash2,
  Search, Filter, RefreshCw, TrendingUp, Award, Zap, Database
} from 'lucide-react';
import Link from 'next/link';
import { UnifiedHeader } from '@/components/unified-header';
import { toast } from 'react-hot-toast';

// Quiz status helper
function getQuizStatus(startDate: string, endDate: string, startTime?: string, endTime?: string) {
  const now = new Date();
  let start: Date;
  let end: Date;

  try {
    if (!startDate || !endDate) return 'ended';

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

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'ended';
    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'active';
    return 'ended';
  } catch (error) {
    return 'ended';
  }
}

export default function QuizBankPage() {
  const router = useRouter();

  // Zustand stores
  const { user, isLoading: userLoading } = useUserStore();
  const cache = useCacheStore();
  const { addToast, setLoading: setUiLoading } = useUIStore();

  // State
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    accessType: 'all',
    status: 'all',
    series: 'all',
  });
  const [seriesList, setSeriesList] = useState<{ id: string; name: string }[]>([]);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showPremiumDialog, setShowPremiumDialog] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<{ [key: string]: number }>({});

  // Debug: Log when user changes
  useEffect(() => {
    console.log('🎯 Quiz Bank: User state changed', {
      hasUser: !!user,
      isLoading: userLoading,
      userUid: user?.uid,
      userAdmin: user?.admin
    });
  }, [user, userLoading]);

  // Fetch quizzes with caching
  useEffect(() => {
    // Wait for user to be available from Admin Layout
    if (!user) {
      console.log('⏳ Quiz Bank: Waiting for user from Admin Layout...');
      return; // Admin Layout will handle redirect if not authenticated
    }

    console.log('🚀 Quiz Bank: User available, starting fetch...');

    const fetchQuizzes = async () => {
      setLoading(true);
      setUiLoading('quizzes', true);

      try {
        // Check cache first
        const cacheKey = `quizzes-${user.uid}-${user.admin ? 'admin' : 'student'}`;
        const cached = cache.get<Quiz[]>(cacheKey);
        if (cached && Array.isArray(cached)) {
          console.log('✅ Loading from cache:', cached.length, 'quizzes');
          setQuizzes(cached);
          setLoading(false);
          setUiLoading('quizzes', false);
          return;
        }

        console.log('🔄 Fetching quizzes from Firebase...');

        // Fetch from Firebase
        const constraints: any[] = [orderBy('startDate', 'desc'), limit(20)];

        // Fetch Series for filter
        getDocs(collection(db, 'series')).then(snap => {
          setSeriesList(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
        });

        // If not admin, filter by published and course
        const isAdmin = user.admin === true || user.admin === 'true';
        if (!isAdmin) {
          constraints.push(where('published', '==', true));
          // Only add course filter if course exists
          const userCourse = (user as any).course;
          if (userCourse) {
            constraints.push(where('course.name', '==', userCourse));
          }
        }

        const q = query(collection(db, 'quizzes'), ...constraints);
        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Quiz[];

        console.log('✅ Fetched', data.length, 'quizzes from Firebase');

        setQuizzes(data);
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 20);

        // Cache for 5 minutes
        cache.set(cacheKey, data, 5 * 60 * 1000);

        if (data.length > 0) {
          addToast({
            type: 'success',
            message: `Loaded ${data.length} quizzes`,
            duration: 2000,
          });
        }
      } catch (error: any) {
        console.error('❌ Error fetching quizzes:', error);
        addToast({
          type: 'error',
          message: error.message || 'Failed to load quizzes',
        });
      } finally {
        setLoading(false);
        setUiLoading('quizzes', false);
      }
    };

    const fetchAttempts = async () => {
      try {
        const attemptsRef = collection(db, 'users', user.uid, 'quizAttempts');
        const attemptsSnap = await getDocs(attemptsRef);

        const counts: { [key: string]: number } = {};

        attemptsSnap.docs.forEach(doc => {
          // doc.id is the quizId for single attempts or we need to check structure. 
          // Based on start/page.tsx: doc(db, 'users', user.uid, 'quizAttempts', quizId)
          // It seems it stores ONE summary doc per quiz?
          // start/page.tsx: setDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId), { attemptNumber: X, completed: true ... }, { merge: true })
          // So yes, doc.id IS the quizId, and data().attemptNumber is the count.

          if (doc.data().completed) {
            counts[doc.id] = doc.data().attemptNumber || 0;
          }
        });

        setAttemptedQuizzes(counts);
      } catch (err) {
        console.error("Failed to load attempts", err);
      }
    };

    fetchQuizzes();
    // Only fetch attempts if not admin (or if admins act as students) 
    // Usually admins don't have limits, but we can show it anyway.
    fetchAttempts();

  }, [user, cache, addToast, setUiLoading]);

  // Filter quizzes
  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((quiz) => {
      const matchesSearch = !filters.search ||
        quiz.title?.toLowerCase().includes(filters.search.toLowerCase());

      const matchesAccessType = filters.accessType === 'all' ||
        quiz.accessType === filters.accessType;

      const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
      const matchesStatus = filters.status === 'all' || status === filters.status;

      const matchesSeries = filters.series === 'all' || (quiz.series && quiz.series.includes(filters.series));

      return matchesSearch && matchesAccessType && matchesStatus && matchesSeries;
    });
  }, [quizzes, filters]);

  // Handle quiz click
  const handleQuizClick = (quiz: Quiz) => {
    const userPlan = (user as any)?.plan;
    if (!user?.admin && userPlan === 'free' && quiz.accessType === 'paid') {
      setShowPremiumDialog(true);
      return;
    }
    router.push(`/quiz/start?id=${quiz.id}`);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!quizToDelete?.id) return;

    try {
      await deleteDoc(doc(db, 'quizzes', quizToDelete.id));
      setQuizzes(quizzes.filter((q) => q.id !== quizToDelete.id));
      cache.invalidatePattern('quizzes');
      setDeleteModal(false);
      addToast({
        type: 'success',
        message: 'Quiz deleted successfully',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to delete quiz',
      });
    }
  };

  // Load more (pagination)
  const handleLoadMore = async () => {
    if (!lastVisible || !user) return;
    setLoading(true);
    setUiLoading('quizzes', true);

    try {
      const constraints: any[] = [orderBy('startDate', 'desc'), limit(20)];
      const isAdmin = user.admin === true || user.admin === 'true';
      if (!isAdmin) {
        constraints.push(where('published', '==', true));
        const userCourse = (user as any).course;
        if (userCourse) constraints.push(where('course.name', '==', userCourse));
      }

      constraints.push(startAfter(lastVisible));

      const q = query(collection(db, 'quizzes'), ...constraints);
      const snapshot = await getDocs(q);

      const newData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Quiz[];
      if (newData.length) {
        setQuizzes((prev) => {
          const combined = [...prev, ...newData];
          // Update cache with appended results
          try {
            const cacheKey = `quizzes-${user.uid}-${user.admin ? 'admin' : 'student'}`;
            cache.set(cacheKey, combined, 5 * 60 * 1000);
          } catch (e) {
            /* ignore cache errors */
          }
          return combined;
        });
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === 20);
    } catch (error: any) {
      console.error('❌ Error loading more quizzes:', error);
      addToast({ type: 'error', message: error.message || 'Failed to load more quizzes' });
    } finally {
      setLoading(false);
      setUiLoading('quizzes', false);
    }
  };

  // Show skeleton while loading
  if (loading || !user) {
    return (
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-12 w-64 bg-muted animate-pulse rounded-lg mb-4" />
          <div className="h-6 w-48 bg-muted animate-pulse rounded-lg" />
        </div>
        <TableSkeleton rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <UnifiedHeader
        title="Admin Dashboard"
        subtitle="Manage Quizzes and Exams"
        icon={<Database className="w-6 h-6" />}
      />

      {/* Modern Header with Brand Colors */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
        <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black mb-2 flex items-center gap-2">
                <span>📝</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF]">
                  Quiz Bank
                </span>
              </h1>
              <p className="text-muted-foreground font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]" />
                {filteredQuizzes.length} quizzes available
              </p>
            </div>
            <div className="hidden md:flex gap-4">
              <div className={`${glassmorphism.medium} p-4 rounded-2xl border border-[#004AAD]/10`}>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-[#004AAD]/20 to-[#0066FF]/20 rounded-xl">
                    <Award className="w-6 h-6 text-[#004AAD] dark:text-[#0066FF]" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-2xl font-black text-foreground">
                      {filteredQuizzes.filter(q => getQuizStatus(q.startDate, q.endDate) === 'active').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Filters */}
      <Card className={`${glassmorphism.light} border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-xl`}>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search quizzes..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 bg-background/50 border-[#004AAD]/20 focus:border-[#0066FF]"
              />
            </div>

            <Select
              value={filters.accessType}
              onValueChange={(v) => setFilters({ ...filters, accessType: v })}
            >
              <SelectTrigger className="bg-background/50 border-[#004AAD]/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Access Types</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="paid">Premium</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(v) => setFilters({ ...filters, status: v })}
            >
              <SelectTrigger className="bg-background/50 border-[#004AAD]/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.series}
              onValueChange={(v) => setFilters({ ...filters, series: v })}
            >
              <SelectTrigger className="bg-background/50 border-[#004AAD]/20">
                <SelectValue placeholder="Filter by Series" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Series</SelectItem>
                {seriesList.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quiz Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-xl font-semibold text-muted-foreground">No quizzes found</p>
          <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => {
            const status = getQuizStatus(quiz.startDate, quiz.endDate, quiz.startTime, quiz.endTime);
            const attemptCount = attemptedQuizzes[quiz.id] || 0;
            const canAttempt = attemptCount < (quiz.maxAttempts || 1);

            return (
              <div key={quiz.id} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#004AAD]/5 to-[#00B4D8]/5 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <Card className={`relative ${glassmorphism.light} border border-[#004AAD]/10 dark:border-[#0066FF]/20 shadow-lg ${animations.smooth} group-hover:scale-[1.02]`}>
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${status === 'active'
                        ? 'bg-gradient-to-r from-[#00B4D8]/20 to-[#66D9EF]/20 text-[#00B4D8] dark:text-[#66D9EF]'
                        : status === 'upcoming'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                        {status}
                      </div>
                      {quiz.accessType === 'paid' && (
                        <div className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 text-amber-700 dark:text-amber-400">
                          Premium
                        </div>
                      )}
                    </div>

                    <CardTitle className="text-xl font-black text-foreground line-clamp-2">
                      {quiz.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {quiz.description}
                    </p>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BookOpen className="w-4 h-4" />
                        <span>{quiz.selectedQuestions?.length || 0} questions</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{quiz.duration} min</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{quiz.startDate}</span>
                      </div>
                      {quiz.endDate && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4 text-red-400" />
                          <span>{quiz.endDate}</span>
                        </div>
                      )}
                    </div>

                    <div className={`${glassmorphism.medium} p-3 rounded-xl border border-[#004AAD]/10 space-y-2 text-sm`}>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Course:</span>
                        <span className="font-semibold text-foreground">{typeof quiz.course === 'object' ? quiz.course.name : quiz.course}</span>
                      </div>
                      {quiz.series && quiz.series.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Series:</span>
                          <span className="font-semibold text-foreground truncate max-w-[150px] text-right">
                            {seriesList.filter(s => quiz.series?.includes(s.id)).map(s => s.name).join(', ') || 'Linked'}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Attempts:</span>
                        <span className="font-semibold text-foreground">{attemptCount} / {quiz.maxAttempts || 1}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {user?.admin ? (
                        <>
                          <Button className="w-full bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white" asChild>
                            <Link href={`/quiz/start?id=${quiz.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              Preview Quiz
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="secondary" size="sm" asChild>
                              <Link href={`/admin/quizzes/create?id=${quiz.id}`}>
                                <Pencil className="w-3 h-3 mr-1" />
                                Edit
                              </Link>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setQuizToDelete(quiz);
                                setDeleteModal(true);
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Button
                          className={`w-full ${status === 'active' && canAttempt
                            ? 'bg-gradient-to-r from-[#00B4D8] to-[#66D9EF] text-white'
                            : ''
                            }`}
                          disabled={status !== 'active' || !canAttempt}
                          onClick={() => handleQuizClick(quiz)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {attemptCount > 0 ? 'Retake Quiz' : 'Start Quiz'}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center mt-8">
          <Button onClick={handleLoadMore} disabled={loading} className="px-6 py-2">
            {loading ? 'Loading...' : 'Load more quizzes'}
          </Button>
        </div>
      )}

      {/* Premium Dialog */}
      <Dialog open={showPremiumDialog} onOpenChange={setShowPremiumDialog}>
        <DialogContent className={`${glassmorphism.medium} border-[#004AAD]/20`}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] to-[#0066FF]">
              Premium Required
            </DialogTitle>
            <DialogDescription>
              This quiz requires a premium subscription. Upgrade now to access all premium content!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPremiumDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white"
              onClick={() => router.push('/pricing')}
            >
              Upgrade Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{quizToDelete?.title}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
