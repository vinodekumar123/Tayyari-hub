'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  getFirestore,
  doc,
  getDoc,
} from 'firebase/firestore';
import { app } from '@/app/firebase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function ForAdminStudentResults() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');
  const [analytics, setAnalytics] = useState<{ total: number; scored: number; average: number }>({
    total: 0,
    scored: 0,
    average: 0,
  });

  const router = useRouter();
  const db = getFirestore(app);
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId');

  useEffect(() => {
    const fetchStudentResults = async () => {
      if (!studentId) return;

      const userSnap = await getDoc(doc(db, 'users', studentId));
      if (userSnap.exists()) {
        setStudentName(userSnap.data().fullName || 'Unknown');
      }

      const allResults: any[] = [];
      let totalScore = 0;
      let totalMax = 0;

      const paths = [
        { attemptPath: 'quizAttempts', quizSource: 'quizzes', isMock: false },
        { attemptPath: 'mock-quizAttempts', quizSource: 'mock-quizzes', isMock: true },
      ];

      for (const { attemptPath, quizSource, isMock } of paths) {
        const attemptsRef = collection(db, 'users', studentId, attemptPath);
        const attemptsSnap = await getDocs(attemptsRef);

        await Promise.all(
          attemptsSnap.docs.map(async (attemptDoc) => {
            const quizId = attemptDoc.id;
            const [resultSnap, quizSnap] = await Promise.all([
              getDoc(doc(db, 'users', studentId, attemptPath, quizId, 'results', quizId)),
              getDoc(
                quizSource === 'mock-quizzes'
                  ? doc(db, 'users', studentId, 'mock-quizzes', quizId)
                  : doc(db, 'quizzes', quizId)
              ),
            ]);

            if (resultSnap.exists() && quizSnap.exists()) {
              const resultData = resultSnap.data();
              const quizMeta = quizSnap.data();

              totalScore += resultData.score || 0;
              totalMax += resultData.total || 0;

              // Subject
              let subjectNames = 'N/A';
              if (quizMeta.questionFilters?.subjects?.length) {
                subjectNames = quizMeta.questionFilters.subjects.join(', ');
              } else if (quizMeta.subjects?.length) {
                subjectNames = quizMeta.subjects.map((s: any) =>
                  typeof s === 'string' ? s : s?.name || '[Invalid]'
                ).join(', ');
              } else if (quizMeta.subject?.name) {
                subjectNames = quizMeta.subject.name;
              } else if (typeof quizMeta.subject === 'string') {
                subjectNames = quizMeta.subject;
              }

              // Chapter
              let chapterNames = 'N/A';
              if (quizMeta.questionFilters?.chapters?.length) {
                chapterNames = quizMeta.questionFilters.chapters.join(', ');
              } else if (quizMeta.chapter?.name) {
                chapterNames = quizMeta.chapter.name;
              } else if (typeof quizMeta.chapter === 'string') {
                chapterNames = quizMeta.chapter;
              }

              // Course
              const courseName = quizMeta.course?.name || quizMeta.course || 'Unknown';

              allResults.push({
                id: quizId,
                ...resultData,
                title: quizMeta.title || 'Untitled Quiz',
                subject: subjectNames,
                chapter: chapterNames,
                course: courseName,
                isMock,
                timestamp: resultData.timestamp,
              });
            }
          })
        );
      }

      allResults.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setResults(allResults);

      setAnalytics({
        total: totalMax,
        scored: totalScore,
        average: totalMax > 0 ? parseFloat(((totalScore / totalMax) * 100).toFixed(2)) : 0,
      });

      setLoading(false);
    };

    fetchStudentResults();
  }, [studentId]);

  return (
    <div className="mx-auto py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-blue-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">📊 {studentName}'s Results</h1>
          <p className="text-gray-600">
            Performance Overview: {analytics.scored} / {analytics.total} ({analytics.average}%)
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/students')}>
          ← Back to Students
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 w-full rounded-xl shadow-md">
              <CardHeader><Skeleton className="h-6 w-3/4 mb-2" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="text-gray-500 text-center text-base">No results found for this student.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {results.map((result) => (
            <Card
              key={result.id}
              className="hover:shadow-xl transition-all border w-full rounded-xl border-gray-200 bg-white"
            >
              <CardHeader className="bg-blue-600 text-white rounded-t-xl p-4">
                <CardTitle className="text-xl font-bold">{result.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-700 space-y-2 px-6 py-5">
                <p><strong>📘 Course:</strong> {result.course}</p>
                <p><strong>📚 Subject:</strong> {result.subject}</p>
                <p><strong>📖 Chapter:</strong> {result.chapter}</p>
                <p><strong>📊 Score:</strong> {result.score} / {result.total}</p>
                <p><strong>🧾 Type:</strong> {result.isMock ? 'By Own' : 'By Admin'}</p>
                <p><strong>📅 Date:</strong> {result.timestamp?.toDate ? format(result.timestamp.toDate(), 'dd MMM yyyy, hh:mm a') : 'N/A'}</p>
                <Button
                  variant="outline"
                  className="w-full text-sm font-semibold border-blue-500 text-blue-700 hover:bg-blue-50 mt-4"
                  onClick={() =>
                    router.push(`/admin/students/responses?id=${result.id}&mock=${result.isMock}&studentId=${studentId}`)
                  }
                >
                  🔎 View Responses
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
