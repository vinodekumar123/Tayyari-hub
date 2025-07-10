'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  BookOpen, 
  Clock, 
  Users, 
  Calendar,
  Search,
  Filter,
  Play,
  Star,
  Trophy,
  Target,
  Zap,
  ArrowRight,
  Bell,
  User
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AvailableQuizzes() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'student' | 'admin'>('student');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  const handleRoleSwitch = (role: 'student' | 'admin') => {
    setUserRole(role);
    if (role === 'admin') {
      router.push('/dashboard/admin');
    }
  };

  const availableQuizzes = [
    {
      id: 1,
      title: 'Biology - Cell Structure & Function',
      course: 'MDCAT',
      subject: 'Biology',
      chapter: 'Cell Biology',
      questions: 50,
      duration: 90,
      difficulty: 'Medium',
      participants: 234,
      averageScore: 78.5,
      startDate: '2024-01-15',
      endDate: '2024-01-20',
      status: 'upcoming',
      description: 'Comprehensive test covering cell structure, organelles, and cellular processes.',
      instructor: 'Dr. Sarah Ahmed',
      maxAttempts: 2,
      passingScore: 70,
      tags: ['Important', 'High Weightage']
    },
    {
      id: 2,
      title: 'Chemistry - Organic Compounds',
      course: 'MDCAT',
      subject: 'Chemistry',
      chapter: 'Organic Chemistry',
      questions: 40,
      duration: 75,
      difficulty: 'Hard',
      participants: 189,
      averageScore: 72.3,
      startDate: '2024-01-16',
      endDate: '2024-01-22',
      status: 'active',
      description: 'Advanced questions on organic compounds, reactions, and mechanisms.',
      instructor: 'Prof. Ali Hassan',
      maxAttempts: 1,
      passingScore: 75,
      tags: ['Challenging']
    },
    {
      id: 3,
      title: 'Physics - Mechanics & Motion',
      course: 'MDCAT',
      subject: 'Physics',
      chapter: 'Mechanics',
      questions: 35,
      duration: 60,
      difficulty: 'Easy',
      participants: 156,
      averageScore: 82.1,
      startDate: '2024-01-18',
      endDate: '2024-01-25',
      status: 'upcoming',
      description: 'Fundamental concepts of mechanics, motion, and forces.',
      instructor: 'Dr. Fatima Khan',
      maxAttempts: 3,
      passingScore: 65,
      tags: ['Beginner Friendly']
    },
    {
      id: 4,
      title: 'Mathematics - Calculus Basics',
      course: 'ECAT',
      subject: 'Mathematics',
      chapter: 'Calculus',
      questions: 30,
      duration: 45,
      difficulty: 'Medium',
      participants: 98,
      averageScore: 75.8,
      startDate: '2024-01-17',
      endDate: '2024-01-24',
      status: 'active',
      description: 'Essential calculus concepts including derivatives and integrals.',
      instructor: 'Prof. Ahmed Ali',
      maxAttempts: 2,
      passingScore: 70,
      tags: ['Foundation']
    }
  ];

  const filteredQuizzes = availableQuizzes.filter(quiz => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quiz.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || quiz.course === selectedCourse;
    const matchesDifficulty = selectedDifficulty === 'all' || quiz.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCourse && matchesDifficulty;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <Sidebar userRole={userRole} onRoleSwitch={handleRoleSwitch} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Available Quizzes</h1>
              <p className="text-gray-600">Choose from {filteredQuizzes.length} available quizzes</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
              </Button>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="hidden md:block">
                  <div className="text-sm font-semibold text-gray-900">Ahmad Hassan</div>
                  <div className="text-xs text-gray-500">MDCAT Student</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Filters */}
          <Card className="glass-card border-0 shadow-xl mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search quizzes by title or subject..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-12 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl"
                    />
                  </div>
                </div>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="w-48 h-12 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl">
                    <SelectValue placeholder="All Courses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    <SelectItem value="MDCAT">MDCAT</SelectItem>
                    <SelectItem value="ECAT">ECAT</SelectItem>
                    <SelectItem value="LAT">LAT</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
                  <SelectTrigger className="w-48 h-12 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl">
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Quiz Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredQuizzes.map((quiz) => (
              <Card key={quiz.id} className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                        {quiz.title}
                      </CardTitle>
                      <p className="text-gray-600 text-sm line-clamp-2">{quiz.description}</p>
                    </div>
                    <Badge className={getStatusColor(quiz.status)}>
                      {quiz.status}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{quiz.course}</Badge>
                    <Badge variant="outline">{quiz.subject}</Badge>
                    <Badge className={getDifficultyColor(quiz.difficulty)}>
                      {quiz.difficulty}
                    </Badge>
                    {quiz.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="h-4 w-4 text-gray-500" />
                      <span>{quiz.questions} questions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>{quiz.duration} minutes</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span>{quiz.participants} participants</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Trophy className="h-4 w-4 text-gray-500" />
                      <span>{quiz.averageScore}% avg score</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Instructor:</span>
                      <span className="font-medium">{quiz.instructor}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-600">Passing Score:</span>
                      <span className="font-medium">{quiz.passingScore}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-600">Max Attempts:</span>
                      <span className="font-medium">{quiz.maxAttempts}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Available: {quiz.startDate} - {quiz.endDate}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 pt-2">
                    {quiz.status === 'active' ? (
                      <Button className="flex-1 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                        <Link href={`/quiz/${quiz.id}`}>
                          <Play className="h-4 w-4 mr-2" />
                          Start Quiz
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Link>
                      </Button>
                    ) : quiz.status === 'upcoming' ? (
                      <Button variant="outline" className="flex-1 h-12 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-medium">
                        <Bell className="h-4 w-4 mr-2" />
                        Set Reminder
                      </Button>
                    ) : (
                      <Button variant="outline" className="flex-1 h-12 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl font-medium" disabled>
                        Quiz Ended
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-12 px-4 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl">
                      <Star className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredQuizzes.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No quizzes found</h3>
              <p className="text-gray-600">Try adjusting your search criteria or check back later for new quizzes.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}