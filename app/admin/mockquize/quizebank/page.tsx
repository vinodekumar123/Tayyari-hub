'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  Play,
} from 'lucide-react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/app/firebase'; // or adjust the path accordingly

function getQuizStatus(startDate?: string, endDate?: string) {
  // If either is missing, consider it always available
  if (!startDate || !endDate) return 'active';

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'active';
  return 'ended';
}


export default function QuizListPage() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    course: '',
    subject: '',
    chapter: '',
    accessType: '',
    searchTerm: '',
    status: '',
    date: '',
  });

  const router = useRouter();

useEffect(() => {
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'mock-quizzes'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setQuizzes(data);
      setLoading(false);
    });

    return unsubscribeSnapshot;
  });

  return () => unsubscribeAuth();
}, []);
  const filteredQuizzes = quizzes.filter((quiz) => {
    const {
      course,
      subject,
      chapter,
      accessType,
      searchTerm,
      status,
      date,
    } = filters;
    const quizStatus = getQuizStatus(quiz.startDate, quiz.endDate);
    const matches = [
      !course || quiz.course === course,
      !subject || quiz.subject === subject,
      !chapter || quiz.chapter === chapter,
      !accessType || quiz.accessType === accessType,
      !searchTerm ||
        (quiz.title || '').toLowerCase().includes(searchTerm.toLowerCase()),
      !status || status === quizStatus,
      !date || quiz.startDate === date,
    ];
    return matches.every(Boolean);
  });

  const uniqueValues = (key: string) => {
    return [...new Set(quizzes.map((q) => q[key]).filter(Boolean))];
  };

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        📝 Available Mock Quizzes
      </h1>

      {/* Filters */}
      <Card className="border-0 shadow-lg mb-10">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Input
              placeholder="Search quizzes..."
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  searchTerm: e.target.value,
                }))
              }
            />
            {['course', 'subject', 'chapter'].map((key) => (
              <Select
                key={key}
                onValueChange={(v) =>
                  setFilters((prev) => ({ ...prev, [key]: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={key.charAt(0).toUpperCase() + key.slice(1)}
                  />
                </SelectTrigger>
                <SelectContent>
                  {uniqueValues(key).map((val) => (
                    <SelectItem key={val} value={val}>
                      {val}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
           
        
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-6 space-y-3 rounded-2xl">
              <Skeleton className="h-7 w-3/4 rounded" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-12 w-full rounded" />
            </Card>
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          No quizzes match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredQuizzes.map((quiz) => {
            const status = getQuizStatus(quiz.startDate, quiz.endDate);
            return (
              <Card
                key={quiz.id}
                className="shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl font-bold text-gray-900 mb-1 line-clamp-2">
                    {quiz.title}
                  </CardTitle>
                  <p className="text-gray-600 text-sm line-clamp-2">
                    {quiz.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-gray-500" />
                      <span>{quiz.selectedQuestions?.length || 0} questions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>{quiz.duration} min</span>
                    </div>
                    <div className="col-span-2">
                      <strong>Course:</strong> {quiz.course} | <strong>Subject:</strong> {quiz.subject}
                    </div>
                  </div>

                 

                  <div className="pt-2">
                    {status === 'active' || status === 'upcoming' ? (
                      <Button
                        className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:brightness-110 font-medium rounded-xl"
                        asChild
                      >
                        <Link href={`/dashboard/quiz/start?id=${quiz.id}`}>
                          <Play className="h-4 w-4 mr-2" />
                          Start Quiz
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-12 border-2 border-gray-200 text-gray-600 font-medium rounded-xl"
                        disabled
                      >
                        Quiz Ended
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
