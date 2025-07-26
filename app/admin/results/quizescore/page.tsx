// QuizStudentScores.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { collection, getDocs, doc, getDoc, query, limit, startAfter } from 'firebase/firestore';
import { db } from '@/app/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function QuizStudentScores() {
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizTitle, setQuizTitle] = useState('');
  const [subjects, setSubjects] = useState('');
  const [chapters, setChapters] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const fetchedUserIdsRef = useRef<Set<string>>(new Set());

  const params = useSearchParams();
  const router = useRouter();
  const quizId = params.get('id');
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const fetchMetadata = async () => {
    if (!quizId) return;
    const quizDoc = await getDoc(doc(db, 'quizzes', quizId));
    if (!quizDoc.exists()) return;
    const data = quizDoc.data();

    setQuizTitle(data.title || 'Untitled');

    const rawSubjects = data.subjects || data.subject;
    let subjectNames = 'N/A';
    if (Array.isArray(rawSubjects)) {
      subjectNames = rawSubjects.map((s: any) => typeof s === 'string' ? s : s?.name || '[Invalid]').join(', ');
    } else if (typeof rawSubjects === 'object' && rawSubjects?.name) {
      subjectNames = rawSubjects.name;
    } else if (typeof rawSubjects === 'string') {
      subjectNames = rawSubjects;
    }
    setSubjects(subjectNames);

    const rawChapters = data.chapters || data.chapter;
    let chapterNames = 'N/A';
    if (Array.isArray(rawChapters)) {
      chapterNames = rawChapters.map((c: any) => typeof c === 'string' ? c : c?.name || '[Invalid]').join(', ');
    } else if (typeof rawChapters === 'object' && rawChapters?.name) {
      chapterNames = rawChapters.name;
    } else if (typeof rawChapters === 'string') {
      chapterNames = rawChapters;
    }
    setChapters(chapterNames);
  };

  const fetchScores = async () => {
    if (!quizId) return;
    const usersQuery = query(collection(db, 'users'), limit(10), ...(lastVisible ? [startAfter(lastVisible)] : []));
    const usersSnap = await getDocs(usersQuery);
    const scoreList: any[] = [];
    const newFetchedIds = new Set<string>();

    const lastDoc = usersSnap.docs[usersSnap.docs.length - 1];
    if (!lastDoc) setHasMore(false);
    else setLastVisible(lastDoc);

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      if (fetchedUserIdsRef.current.has(userId) || newFetchedIds.has(userId)) continue;

      const resultRef = doc(db, 'users', userId, 'quizAttempts', quizId, 'results', quizId);
      const resultSnap = await getDoc(resultRef);
      if (resultSnap.exists()) {
        newFetchedIds.add(userId);
        scoreList.push({
          id: userId,
          name: userDoc.data().fullName || 'Unknown',
          ...resultSnap.data(),
        });
      }
    }

    newFetchedIds.forEach(id => fetchedUserIdsRef.current.add(id));
    setScores(prev => {
      const existing = new Set(prev.map(s => s.id));
      const filtered = scoreList.filter(s => !existing.has(s.id));
      return [...prev, ...filtered];
    });

    setLoading(false);
    setInitialLoading(false);
  };

  const handleObserver = useCallback((entries: any[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading) {
      setLoading(true);
      fetchScores();
    }
  }, [hasMore, loading]);

  useEffect(() => {
    if (loaderRef.current) {
      const option = {
        root: null,
        rootMargin: '20px',
        threshold: 1.0,
      };
      const observer = new IntersectionObserver(handleObserver, option);
      observer.observe(loaderRef.current);
      return () => observer.disconnect();
    }
  }, [handleObserver]);

  useEffect(() => {
    fetchMetadata();
    fetchScores();
  }, [quizId]);

  return (
    <div className="p-8 min-h-screen bg-gradient-to-b from-white to-blue-50">
        <Button variant="outline" onClick={() => router.push('/admin/results')}>
          ← Back to Results
        </Button>
      <div className="mb-4 mt-4 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">📝 {quizTitle || 'Quiz'} Results</h1>
          <p className="text-gray-700">📚 Subjects: {subjects}
            </p>
            <p>
              📖 Chapters: {chapters}</p>
        </div>
      </div>

      {initialLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-1/2 mb-2" />
              <Skeleton className="h-4 w-1/3" />
            </Card>
          ))}
        </div>
      ) : scores.length === 0 ? (
        <p className="text-center text-gray-500">No results submitted for this quiz yet.</p>
      ) : (
        <div className="space-y-4">
          {scores.map((s) => (
            <Card key={s.id} className="p-4 bg-white rounded-xl shadow-sm flex justify-between items-center">
              <CardHeader className="p-0">
                <CardTitle className="text-lg font-semibold">{s.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-right">
                <p className="text-lg font-bold">{s.score} / {s.total}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div ref={loaderRef} className="h-10 mt-4" />
      {loading && !initialLoading && <p className="text-center text-gray-500 mt-2">Loading more...</p>}
    </div>
  );
}