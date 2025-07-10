'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, BookOpen, Clock, Play, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function getQuizStatus(startDate: string, endDate: string) {
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
    date: ''
  });
  const router = useRouter();

  useEffect(() => {
    const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredQuizzes = quizzes.filter(quiz => {
    const {
      course, subject, chapter, accessType, searchTerm, status, date
    } = filters;
    const quizStatus = getQuizStatus(quiz.startDate, quiz.endDate);
    const matches = [
      !course || quiz.course === course,
      !subject || quiz.subject === subject,
      !chapter || quiz.chapter === chapter,
      !accessType || quiz.accessType === accessType,
      !searchTerm || (quiz.title || '').toLowerCase().includes(searchTerm.toLowerCase()),
      !status || status === quizStatus,
      !date || quiz.startDate === date
    ];
    return matches.every(Boolean);
  });

  const uniqueValues = (key: string) => {
    return [...new Set(quizzes.map((q) => q[key]).filter(Boolean))];
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
        
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Available Quizzes</h1>
        </div>
      </div>

      {/* Filters */}
      <Card className="glass-card border-0 shadow-xl mb-8">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Input
              placeholder="Search quizzes..."
              value={filters.searchTerm}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
            />
            {['course', 'subject', 'chapter', 'accessType'].map((key) => (
              <Select
                key={key}
                onValueChange={(v) => setFilters((prev) => ({ ...prev, [key]: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={key.charAt(0).toUpperCase() + key.slice(1)} />
                </SelectTrigger>
                <SelectContent>
                  {uniqueValues(key).map((val) => (
                    <SelectItem key={val} value={val}>{val}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            <Select onValueChange={(v) => setFilters((prev) => ({ ...prev, status: v }))}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="ended">Ended</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Quiz Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-6 space-y-3 rounded-2xl">
              <Skeleton className="h-7 w-3/4 rounded" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-12 w-full rounded" />
            </Card>
          ))}
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No quizzes match your filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredQuizzes.map((quiz) => {
            const status = getQuizStatus(quiz.startDate, quiz.endDate);
            

            return (
              <Card key={quiz.id} className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                        {quiz.title}
                      </CardTitle>
                      <p className="text-gray-600 text-sm line-clamp-2">{quiz.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-gray-500" />
                      <span>{quiz.selectedQuestions?.length || 0} questions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>{quiz.duration} minutes</span>
                    </div>
                    <div className="col-span-2 text-sm text-gray-500">
                      <strong>Course:</strong> {quiz.course} | <strong>Subject:</strong> {quiz.subject}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Access:</span>
                      <span className="font-medium capitalize">{quiz.accessType}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-600">Attempts:</span>
                      <span className="font-medium">{quiz.maxAttempts}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>{quiz.startDate} - {quiz.endDate}</span>
                    </div>
                    
                  </div>
                  <div className="flex pt-2">
                    {(status === 'active' || status === 'upcoming') ? (
                      <Button className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                        <Link href={`/quiz/${quiz.id}`}>
                          <Play className="h-4 w-4 mr-2" />
                          Start Quiz
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" className="flex-1 h-12 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium" disabled>
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
