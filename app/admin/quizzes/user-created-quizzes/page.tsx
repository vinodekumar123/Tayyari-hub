'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from 'app/firebase';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, CheckCircle2, PlayCircle, RotateCw } from 'lucide-react';

interface UserCreatedQuiz {
  id: string;
  name: string;
  subject: string;
  chapters: string[];
  createdBy: string;
  duration: number;
  questionCount: number;
  createdAt: any;
  attempts?: { userId: string; status: 'started' | 'completed' }[]; // change as needed
}

const getStatus = (
  quiz: UserCreatedQuiz,
  userId: string
): { label: string; color: string; icon: JSX.Element; action?: string } => {
  if (!quiz.attempts) {
    return {
      label: 'Start',
      color: 'primary',
      icon: <PlayCircle className="h-4 w-4 mr-1" />,
      action: 'start',
    };
  }
  const userAttempt = quiz.attempts.find((a) => a.userId === userId);
  if (userAttempt) {
    if (userAttempt.status === 'started') {
      return {
        label: 'Resume',
        color: 'yellow',
        icon: <RotateCw className="h-4 w-4 mr-1" />,
        action: 'resume',
      };
    }
    if (userAttempt.status === 'completed') {
      return {
        label: 'Completed',
        color: 'emerald',
        icon: <CheckCircle2 className="h-4 w-4 mr-1" />,
      };
    }
  }
  return {
    label: 'Start',
    color: 'primary',
    icon: <PlayCircle className="h-4 w-4 mr-1" />,
    action: 'start',
  };
};

const UserCreatedQuizzesPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [quizzes, setQuizzes] = useState<UserCreatedQuiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        router.push('/login');
        return;
      }
      try {
        // query quizzes created by this user
        const q = query(
          collection(db, 'user-quizzes'),
          where('createdBy', '==', u.uid)
        );
        const snap = await getDocs(q);
        const list: UserCreatedQuiz[] = [];
        snap.forEach((docSnap) => {
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
            attempts: d.attempts || [],
          });
        });
        setQuizzes(list);
      } catch (e) {
        console.error('Error loading user quizzes:', e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span className="font-medium text-lg text-gray-600">Loading...</span>
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto py-16 px-4">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
          Your Created Quizzes
        </h1>
        <Button
          onClick={() => router.push('/create-your-own-test')}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition hover:scale-105"
        >
          <Plus className="mr-2 h-5 w-5" /> New Test
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <Card className="text-center py-10 bg-gradient-to-br from-slate-100 via-blue-50 to-white shadow-none">
          <CardContent>
            <p className="text-lg text-slate-600">
              You have not created any quizzes yet.
            </p>
            <Button
              onClick={() => router.push('/quiz/create-mock')}
              className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow hover:scale-105"
            >
              <Plus className="mr-2 h-5 w-5" /> Create First Test
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {quizzes.map((q) => {
            const status = user
              ? getStatus(q, user.uid)
              : {
                  label: 'Start',
                  color: 'primary',
                  icon: <PlayCircle className="h-4 w-4 mr-1" />,
                  action: 'start',
                };

            return (
              <Card
                key={q.id}
                className="shadow-lg transition-transform duration-300 hover:scale-[1.02] hover:shadow-2xl border border-slate-200/70 bg-white/80 backdrop-blur"
              >
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-semibold text-gray-800">
                      {q.name}
                    </CardTitle>
                    {status.action ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={`font-semibold flex items-center border-0 text-${status.color}-700 shadow-sm bg-${status.color}-100 hover:bg-${status.color}-200`}
                        onClick={() =>
                          router.push(
                            status.action === 'resume'
                              ? `/user-quizzes/${q.id}/resume?id=${q.id}`
                              : `/user-quizzes/${q.id}/start?id=${q.id}`
                          )
                        }
                      >
                        {status.icon} {status.label}
                      </Button>
                    ) : (
                      <Badge
                        className={`bg-${status.color}-100 text-${status.color}-900 font-semibold border-0 px-3 py-1 flex items-center`}
                      >
                        {status.icon}
                        {status.label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Badge variant="secondary" className="mr-2 text-sm px-2 py-1">
                      {q.subject}
                    </Badge>
                    {q.chapters && q.chapters.length > 0 && (
                      <Badge
                        variant="outline"
                        className="ml-1 text-xs px-2 py-1 border-blue-400 text-blue-800"
                      >
                        {q.chapters.join(', ')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-6 text-base text-slate-600">
                    <div>
                      <span className="font-semibold text-slate-700">Questions:</span>{' '}
                      {q.questionCount}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Duration:</span>{' '}
                      {q.duration} min
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    Created{' '}
                    {q.createdAt?.toDate
                      ? q.createdAt.toDate().toLocaleString()
                      : new Date(q.createdAt).toLocaleString()}
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

export default UserCreatedQuizzesPage;
