'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from 'app/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, RotateCw, CheckCircle } from 'lucide-react';

interface UserCreatedQuiz {
  id: string;
  title: string;
  subjects: string[];
  chapters: string[];
  createdBy: string;
  duration: number;
  questionCount: number;
  createdAt: any;
  attempted?: boolean;
  startedAt?: Date | null;
  inProgress?: boolean;
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
        setLoading(false);
        router.push('/login');
        return;
      }
      try {
        // Fetch quizzes created by this user
        const q = query(
          collection(db, 'user-quizzes'),
          where('createdBy', '==', u.uid)
        );
        const snap = await getDocs(q);
        const list: UserCreatedQuiz[] = [];
        for (const docSnap of snap.docs) {
          const d = docSnap.data();

          // Check attempt status from user's subcollection
          const attemptRef = doc(db, 'users', u.uid, 'user-quizattempts', docSnap.id);
          const attemptSnap = await getDoc(attemptRef);

          let attempted = false;
          let startedAt = null;
          let inProgress = false;
          if (attemptSnap.exists()) {
            const attemptData = attemptSnap.data();
            attempted = attemptData.completed === true;
            if (attemptData.startedAt) {
              startedAt =
                typeof attemptData.startedAt.toDate === 'function'
                  ? attemptData.startedAt.toDate()
                  : new Date(attemptData.startedAt);
            }
            // If started but not completed
            if (startedAt && !attempted) {
              inProgress = true;
            }
          }
          list.push({
            id: docSnap.id,
            title: d.title || '', // Updated: use title field
            subjects: Array.isArray(d.subjects) ? d.subjects : d.subject ? [d.subject] : [],
            chapters: Array.isArray(d.chapters) ? d.chapters : [],
            createdBy: d.createdBy,
            duration: d.duration,
            questionCount: d.questionCount,
            createdAt: d.createdAt,
            attempted,
            startedAt,
            inProgress,
          });
        }
        setQuizzes(list);
      } catch (e) {
        console.error('Error loading user quizzes:', e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900">Your Created Quizzes</h1>
        <Button
          onClick={() => router.push('/create-your-own-test')}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 font-semibold rounded-lg shadow-lg px-5 py-2"
        >
          <Plus className="mr-2 h-5 w-5" /> Create New Test
        </Button>
      </div>
      {quizzes.length === 0 ? (
        <Card className="text-center py-10 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl shadow-md">
          <CardContent>
            <p className="text-lg text-gray-700">You have not created any quizzes yet.</p>
            <Button
              onClick={() => router.push('/quiz/create-mock')}
              className="mt-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg shadow px-4 py-2"
            >
              <Plus className="mr-2 h-5 w-5" /> Create First Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {quizzes.map((q) => (
            <Card key={q.id} className="rounded-xl shadow-lg hover:shadow-2xl transition-all bg-white border border-gray-100">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {q.title || "Untitled Quiz"}
                  </CardTitle>
                  <div className="flex gap-2">
                    {!q.attempted && !q.inProgress ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-blue-500 text-blue-500 hover:bg-blue-50 rounded-full"
                        onClick={() => router.push(`/quiz/start-user-quiz?id=${q.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" /> Start
                      </Button>
                    ) : q.inProgress ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-500 text-purple-600 hover:bg-purple-50 rounded-full"
                        onClick={() => router.push(`/quiz/resume-user-quiz?id=${q.id}`)}
                      >
                        <RotateCw className="h-4 w-4 mr-1" /> Resume
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-600 hover:bg-green-50 rounded-full"
                        disabled
                      >
                        <CheckCircle className="h-4 w-4 mr-1" /> Attempted
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div>
                  {q.subjects && q.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {q.subjects.map((subj, idx) => (
                        <Badge key={subj + idx} variant="secondary" className="text-base px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                          {subj}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {q.chapters && q.chapters.length > 0 && (
                    <Badge variant="outline" className="ml-1 text-base px-3 py-1 rounded-full bg-purple-100 text-purple-700">
                      {q.chapters.join(', ')}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-6 text-sm text-gray-700 font-medium">
                  <div>
                    <span className="font-semibold">Questions:</span> {q.questionCount}
                  </div>
                  <div>
                    <span className="font-semibold">Duration:</span> {q.duration} min
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <div>
                    Created{' '}
                    {q.createdAt?.toDate
                      ? q.createdAt.toDate().toLocaleString()
                      : new Date(q.createdAt).toLocaleString()}
                  </div>
                  {q.startedAt && (
                    <div className="ml-2">
                      <span className="text-gray-500">Started at: </span>
                      <span className="font-semibold text-blue-600">
                        {typeof q.startedAt === 'string'
                          ? q.startedAt
                          : q.startedAt.toLocaleString()}
                      </span>
                    </div>
                  )}
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
