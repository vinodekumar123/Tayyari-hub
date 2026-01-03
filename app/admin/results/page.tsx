// AdminQuizzesList.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Layers, ArrowRight, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Quiz {
  id: string;
  title: string;
  subjects: string;
  courseId?: string;
  course?: string;
}

const PAGE_SIZE = 9; // Increased page size for grid layout

export default function AdminQuizzesList() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const router = useRouter();

  useEffect(() => {
    const fetchQuizzesAndCourses = async () => {
      setLoading(true);
      setError(null);
      try {
        const quizSnap = await getDocs(collection(db, 'quizzes'));
        const quizDocs = quizSnap.docs;
        const courseIds: Set<string> = new Set();

        const rawQuizzes = quizDocs.map((docSnap) => {
          const quizData = docSnap.data();
          let subjectNames = 'N/A';
          const rawSubjects = quizData.subjects || quizData.subject;

          if (Array.isArray(rawSubjects)) {
            subjectNames = rawSubjects.map((s: any) =>
              typeof s === 'string' ? s : s?.name || ''
            ).filter(Boolean).join(', ');
          } else if (rawSubjects?.name) {
            subjectNames = rawSubjects.name;
          } else if (typeof rawSubjects === 'string') {
            subjectNames = rawSubjects;
          }

          let courseId: string | undefined;
          let courseName: string | undefined;
          if (quizData.course?.id) {
            courseId = quizData.course.id;
            courseIds.add(courseId);
          } else if (quizData.course?.name) {
            courseName = quizData.course.name;
          } else if (typeof quizData.course === 'string') {
            courseName = quizData.course;
          }

          return {
            id: docSnap.id,
            title: quizData.title || 'Untitled Quiz',
            subjects: subjectNames,
            courseId,
            course: courseName,
          } as Quiz;
        });

        // Bulk fetch courses
        let coursesById: Record<string, string> = {};
        if (courseIds.size > 0) {
          const idsArr = Array.from(courseIds);
          for (let i = 0; i < idsArr.length; i += 10) {
            const batchIds = idsArr.slice(i, i + 10);
            const q = query(collection(db, 'courses'), where('__name__', 'in', batchIds));
            const coursesSnap = await getDocs(q);
            coursesSnap.forEach((doc) => {
              coursesById[doc.id] = doc.data().name || 'Unknown Course';
            });
          }
        }

        const allQuizzes: Quiz[] = rawQuizzes.map((quiz) => ({
          ...quiz,
          course: quiz.courseId && coursesById[quiz.courseId]
            ? coursesById[quiz.courseId]
            : quiz.course || 'N/A',
        }));

        setQuizzes(allQuizzes);
      } catch (err) {
        console.error('Error fetching quizzes:', err);
        setError('Failed to fetch quizzes. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzesAndCourses();
  }, []);

  const filteredQuizzes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quizzes;
    return quizzes.filter((q) =>
      q.title.toLowerCase().includes(term) ||
      q.subjects.toLowerCase().includes(term) ||
      (q.course && q.course.toLowerCase().includes(term))
    );
  }, [search, quizzes]);

  const totalPages = Math.ceil(filteredQuizzes.length / PAGE_SIZE);
  const pagedQuizzes = filteredQuizzes.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => { setPage(1); }, [search]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 selection:text-indigo-900">

      {/* Header */}
      <nav className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              Quiz Results
            </h1>
          </div>

          <div className="relative w-full sm:w-80 group">
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-slate-600 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
              placeholder="Search quizzes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex justify-between items-start">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : pagedQuizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-600">
            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 opacity-50" />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No results found</h3>
            <p>Try adjusting your search terms</p>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {pagedQuizzes.map((quiz, idx) => (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className="group relative h-full flex flex-col bg-white dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-900/20 transition-all duration-300 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <CardHeader className="pb-3 relative">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                          <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        {quiz.course && quiz.course !== 'N/A' && (
                          <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                            {quiz.course}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 line-clamp-2 min-h-[3.5rem] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {quiz.title}
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-3 relative">
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <BookOpen className="w-4 h-4 text-indigo-500/70" />
                        <span className="line-clamp-1">{quiz.subjects}</span>
                      </div>
                    </CardContent>

                    <CardFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 relative bg-slate-50/50 dark:bg-slate-900/50">
                      <Button
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 hover:border-transparent transition-all group/btn"
                        onClick={() => router.push(`/admin/results/quizescore?id=${quiz.id}`)}
                      >
                        <span className="mr-2">View Responses</span>
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-12 gap-3">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                >
                  Previous
                </Button>
                <div className="flex items-center px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium">
                  Page <span className="text-indigo-600 dark:text-indigo-400 font-bold mx-1">{page}</span> of {totalPages}
                </div>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
