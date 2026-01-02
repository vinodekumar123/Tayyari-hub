'use client';

import { useEffect, useState } from 'react';
import { db, auth } from '@/app/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuizAttempt {
  id: string;
  quizId: string;
  score: number;
  total: number;
  submittedAt: { seconds: number; nanoseconds: number } | null;
  detailed?: any[];
  quizType?: string;
  [key: string]: any;
}

interface QuizMeta {
  name: string;
  subject?: string;
}

const UserQuizResultsPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [quizMetas, setQuizMetas] = useState<Record<string, QuizMeta>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        router.push('/login');
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const attemptsRef = collection(db, 'users', user.uid, 'user-quizattempts');
        const q = query(attemptsRef, orderBy('submittedAt', 'desc'));
        const snap = await getDocs(q);
        const _attempts: QuizAttempt[] = [];
        const metaFetches: Promise<void>[] = [];
        const _quizMetas: Record<string, QuizMeta> = {};
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (!data.completed) return; // Only show completed attempts
          _attempts.push({
            ...(data as any),
            id: docSnap.id,
            quizId: docSnap.id,
          });
          // Prefetch quiz meta
          metaFetches.push(
            getDoc(doc(db, 'user-quizzes', docSnap.id)).then(metaSnap => {
              if (metaSnap.exists()) {
                _quizMetas[docSnap.id] = {
                  name: metaSnap.data().name,
                  subject: metaSnap.data().subject,
                };
              }
            })
          );
        });
        await Promise.all(metaFetches);
        setAttempts(_attempts);
        setQuizMetas(_quizMetas);
        setLoading(false);
      } catch (err: any) {
        setError('Failed to load quiz results: ' + (err?.message || String(err)));
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <div className="py-10 text-center">Loading...</div>;
  if (error) return <div className="text-red-600 py-10 text-center">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Quiz Results</h1>
      {attempts.length === 0 ? (
        <Card className="p-6 text-center">
          <CardContent>No quiz results found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => {
            const meta = quizMetas[attempt.quizId] || ({} as QuizMeta);
            const date = attempt.submittedAt
              ? new Date(attempt.submittedAt.seconds * 1000)
              : null;
            return (
              <Card key={attempt.id}>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span>
                      {meta.name || 'Quiz'}{' '}
                      {meta.subject && (
                        <span className="text-gray-500 text-base ml-2">({meta.subject})</span>
                      )}
                    </span>
                    <span className="text-sm text-gray-500">
                      {date ? date.toLocaleString() : '—'}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="font-semibold">Score:</span>{' '}
                    {attempt.score} / {attempt.total}
                  </div>
                  <div>
                    <Button
                      onClick={() =>
                        router.push(`/admin/students/user-responses?id=${attempt.quizId}`)
                      }
                    >
                      View Responses
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UserQuizResultsPage;
