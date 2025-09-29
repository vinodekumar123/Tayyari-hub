'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from 'app/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye } from 'lucide-react';

interface UserCreatedQuiz {
  id: string;
  name: string;
  subject: string;
  chapters: string[];
  createdBy: string;
  duration: number;
  questionCount: number;
  createdAt: any;
}

const UserCreatedQuizzesPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<UserCreatedQuiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setLoading(false); // Fix: ensure loading is stopped even on redirect
        router.push('/login');
        return;
      }
      try {
        const q = query(
          collection(db, 'user-created-tests'),
          where('createdBy', '==', u.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const list: UserCreatedQuiz[] = [];
        snap.forEach(docSnap => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            name: d.name,
            subject: d.subject,
            chapters: d.chapters || [],
            createdBy: d.createdBy,
            duration: d.duration,
            questionCount: d.questionCount,
            createdAt: d.createdAt,
          });
        });
        setQuizzes(list);
      } catch (e) {
        // Optionally set an error message
      } finally {
        setLoading(false); // Fix: ensure loading is stopped after fetch or error
      }
    });
    return () => unsub();
  }, [router]);

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Created Quizzes</h1>
        <Button
          onClick={() => router.push('/create-your-own-test')}
          className="bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="mr-2 h-5 w-5" /> Create New Test
        </Button>
      </div>
      {quizzes.length === 0 ? (
        <Card className="text-center py-10">
          <CardContent>
            <p className="text-lg">You have not created any quizzes yet.</p>
            <Button
              onClick={() => router.push('app/quiz/create-mock')}
              className="mt-4 bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="mr-2 h-5 w-5" /> Create First Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {quizzes.map((q) => (
            <Card key={q.id} className="shadow-md hover:shadow-lg transition">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl font-semibold">{q.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/user-created-tests/${q.id}/start?id=${q.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" /> Start
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Badge variant="secondary" className="mr-2">
                    {q.subject}
                  </Badge>
                  {q.chapters && q.chapters.length > 0 && (
                    <Badge variant="outline" className="ml-1">
                      {q.chapters.join(', ')}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <div>
                    <strong>Questions:</strong> {q.questionCount}
                  </div>
                  <div>
                    <strong>Duration:</strong> {q.duration} min
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Created {q.createdAt?.toDate
                    ? q.createdAt.toDate().toLocaleString()
                    : new Date(q.createdAt).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserCreatedQuizzesPage;
