// AdminQuizzesList.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function AdminQuizzesList() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const quizSnap = await getDocs(collection(db, 'quizzes'));
        const allQuizzes = await Promise.all(
          quizSnap.docs.map(async (docSnap) => {
            const quizData = docSnap.data();

            // Resolve subjects (array of string, array of objects, or single value)
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

            // Resolve course
            let courseName = 'N/A';
            if (quizData.course?.id) {
              const courseDoc = await getDoc(doc(db, 'courses', quizData.course.id));
              if (courseDoc.exists()) courseName = courseDoc.data().name;
            } else if (typeof quizData.course === 'object' && quizData.course?.name) {
              courseName = quizData.course.name;
            } else if (typeof quizData.course === 'string') {
              courseName = quizData.course;
            }

            return {
              id: docSnap.id,
              title: quizData.title || 'Untitled Quiz',
              subjects: subjectNames,
              course: courseName,
            };
          })
        );

        setQuizzes(allQuizzes);
      } catch (error) {
        console.error('Error fetching quizzes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, []);

  return (
    <div className="p-8 bg-gradient-to-b from-white to-blue-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">📚 Admin Quizzes</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 rounded-xl shadow-sm">
              <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : quizzes.length === 0 ? (
        <p className="text-gray-500 text-center">No quizzes found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
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
      )}
    </div>
  );
}