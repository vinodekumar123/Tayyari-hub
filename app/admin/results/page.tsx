// AdminQuizzesList.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface Quiz {
  id: string;
  title: string;
  subjects: string;
  courseId?: string;
  course?: string;
}

interface Course {
  id: string;
  name: string;
}

const PAGE_SIZE = 6;

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
        // Fetch all quizzes
        const quizSnap = await getDocs(collection(db, 'quizzes'));
        const quizDocs = quizSnap.docs;

        // Collect unique course IDs
        const courseIds: Set<string> = new Set();
        const rawQuizzes = quizDocs.map((docSnap) => {
          const quizData = docSnap.data();

          // Subjects extraction
          let subjectNames = 'N/A';
          const rawSubjects = quizData.subjects || quizData.subject;
          if (Array.isArray(rawSubjects)) {
            subjectNames = rawSubjects
              .map((s: any) => {
                if (typeof s === 'string') return s;
                if (typeof s === 'object' && s?.name) return s.name;
                return '[Invalid]';
              })
              .join(', ');
          } else if (typeof rawSubjects === 'object' && rawSubjects?.name) {
            subjectNames = rawSubjects.name;
          } else if (typeof rawSubjects === 'string') {
            subjectNames = rawSubjects;
          }

          // Course extraction (collect ID if available)
          let courseId: string | undefined;
          let courseName: string | undefined;
          if (quizData.course?.id) {
            courseId = quizData.course.id;
            courseIds.add(courseId);
          } else if (typeof quizData.course === 'object' && quizData.course?.name) {
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
          // Firestore allows max 10 in 'in' query; batch if needed
          const idsArr = Array.from(courseIds);
          for (let i = 0; i < idsArr.length; i += 10) {
            const batchIds = idsArr.slice(i, i + 10);
            const q = query(
              collection(db, 'courses'),
              where('__name__', 'in', batchIds)
            );
            const coursesSnap = await getDocs(q);
            coursesSnap.forEach((doc) => {
              coursesById[doc.id] = doc.data().name || 'Unknown Course';
            });
          }
        }

        // Merge course names into quizzes
        const allQuizzes: Quiz[] = rawQuizzes.map((quiz) => ({
          ...quiz,
          course:
            quiz.courseId && coursesById[quiz.courseId]
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

  // SEARCH + PAGINATION
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

  // Reset page if search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="p-8 bg-gradient-to-b from-white to-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">📚 Admin Quizzes</h1>
      <div className="mb-4 flex flex-col md:flex-row gap-2 md:items-center">
        <input
          className="border rounded p-2 w-full md:w-64"
          placeholder="Search by quiz, subject, or course..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {error && (
          <span className="text-red-500 ml-0 md:ml-4">{error}</span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Card key={i} className="p-6 rounded-xl shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pagedQuizzes.length === 0 ? (
        <p className="text-gray-500 text-center">No quizzes found.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pagedQuizzes.map((quiz) => (
              <Card
                key={quiz.id}
                className="rounded-xl border shadow hover:shadow-lg transition flex flex-col justify-between"
              >
                <div>
                  <CardHeader className="bg-blue-600 text-white rounded-t-xl p-4">
                    <CardTitle className="text-lg">{quiz.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-gray-700">
                    <p><strong>📚 Subjects:</strong> {quiz.subjects}</p>
                    <p><strong>📘 Course:</strong> {quiz.course}</p>
                  </CardContent>
                </div>
                <div className="p-4 pt-0">
                  <Button
                    className="w-full text-sm font-semibold"
                    onClick={() =>
                      router.push(`/admin/results/quizescore?id=${quiz.id}`)
                    }
                  >
                    🔍 View Responses
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center mt-6 gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="self-center text-gray-700">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
