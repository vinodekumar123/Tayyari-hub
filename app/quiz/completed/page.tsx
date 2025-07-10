'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  CheckCircle, 
  Trophy, 
  Calendar,
  Search,
  Eye,
  Download,
  RefreshCw,
  TrendingUp,
  Award,
  Star,
  User,
  Bell,
  BarChart3,
  Target
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CompletedQuizzes() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<'student' | 'admin'>('student');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const handleRoleSwitch = (role: 'student' | 'admin') => {
    setUserRole(role);
    if (role === 'admin') {
      router.push('/dashboard/admin');
    }
  };

  const completedQuizzes = [
    {
      id: 1,
      title: 'Biology - Cell Structure & Function',
      course: 'MDCAT',
      subject: 'Biology',
      score: 92,
      totalQuestions: 50,
      correctAnswers: 46,
      completedAt: '2024-01-10',
      duration: '85 minutes',
      rank: 5,
      totalParticipants: 150,
      percentile: 95,
      difficulty: 'Medium',
      improvement: '+8%',
      status: 'excellent'
    },
    {
      id: 2,
      title: 'Chemistry - Organic Compounds',
      course: 'MDCAT',
      subject: 'Chemistry',
      score: 78,
      totalQuestions: 40,
      correctAnswers: 31,
      completedAt: '2024-01-08',
      duration: '72 minutes',
      rank: 12,
      totalParticipants: 120,
      percentile: 85,
      difficulty: 'Hard',
      improvement: '+3%',
      status: 'good'
    },
    {
      id: 3,
      title: 'Physics - Mechanics & Motion',
      course: 'MDCAT',
      subject: 'Physics',
      score: 85,
      totalQuestions: 35,
      correctAnswers: 30,
      completedAt: '2024-01-05',
      duration: '58 minutes',
      rank: 8,
      totalParticipants: 95,
      percentile: 88,
      difficulty: 'Easy',
      improvement: '+12%',
      status: 'good'
    },
    {
      id: 4,
      title: 'Mathematics - Calculus Basics',
      course: 'ECAT',
      subject: 'Mathematics',
      score: 65,
      totalQuestions: 30,
      correctAnswers: 20,
      completedAt: '2024-01-03',
      duration: '43 minutes',
      rank: 25,
      totalParticipants: 80,
      percentile: 68,
      difficulty: 'Medium',
      improvement: '-2%',
      status: 'average'
    }
  ];

  const filteredQuizzes = completedQuizzes.filter(quiz => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quiz.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || quiz.course === selectedCourse;
    
    return matchesSearch && matchesCourse;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'score-high':
        return b.score - a.score;
      case 'score-low':
        return a.score - b.score;
      case 'recent':
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      case 'oldest':
        return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      default:
        return 0;
    }
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return { text: 'Excellent', color: 'bg-green-100 text-green-800' };
    if (score >= 75) return { text: 'Good', color: 'bg-blue-100 text-blue-800' };
    if (score >= 60) return { text: 'Average', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Needs Improvement', color: 'bg-red-100 text-red-800' };
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const averageScore = completedQuizzes.reduce((acc, quiz) => acc + quiz.score, 0) / completedQuizzes.length;
  const totalQuizzes = completedQuizzes.length;
  const excellentQuizzes = completedQuizzes.filter(q => q.score >= 90).length;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <Sidebar userRole={userRole} onRoleSwitch={handleRoleSwitch} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Completed Quizzes</h1>
              <p className="text-gray-600">Review your quiz history and performance</p>
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="glass-card border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{totalQuizzes}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl shadow-lg">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Score</p>
                    <p className="text-3xl font-bold text-gray-900">{averageScore.toFixed(1)}%</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-lg">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Excellent Scores</p>
                    <p className="text-3xl font-bold text-gray-900">{excellentQuizzes}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl shadow-lg">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Best Score</p>
                    <p className="text-3xl font-bold text-gray-900">{Math.max(...completedQuizzes.map(q => q.score))}%</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="glass-card border-0 shadow-xl mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search completed quizzes..."
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
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-48 h-12 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 rounded-xl">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="score-high">Highest Score</SelectItem>
                    <SelectItem value="score-low">Lowest Score</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Quiz Results */}
          <div className="space-y-6">
            {filteredQuizzes.map((quiz) => {
              const scoreBadge = getScoreBadge(quiz.score);
              
              return (
                <Card key={quiz.id} className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.01]">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{quiz.title}</h3>
                        <div className="flex items-center space-x-3">
                          <Badge variant="secondary">{quiz.course}</Badge>
                          <Badge variant="outline">{quiz.subject}</Badge>
                          <Badge className={getDifficultyColor(quiz.difficulty)}>
                            {quiz.difficulty}
                          </Badge>
                          <Badge className={scoreBadge.color}>
                            {scoreBadge.text}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-4xl font-bold ${getScoreColor(quiz.score)} mb-1`}>
                          {quiz.score}%
                        </div>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{quiz.completedAt}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-900">{quiz.correctAnswers}/{quiz.totalQuestions}</div>
                        <div className="text-xs text-blue-700">Correct Answers</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-lg font-bold text-green-900">#{quiz.rank}</div>
                        <div className="text-xs text-green-700">Rank</div>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-lg font-bold text-purple-900">{quiz.percentile}th</div>
                        <div className="text-xs text-purple-700">Percentile</div>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <div className="text-lg font-bold text-yellow-900">{quiz.duration}</div>
                        <div className="text-xs text-yellow-700">Duration</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className={`text-lg font-bold ${quiz.improvement.startsWith('+') ? 'text-green-900' : 'text-red-900'}`}>
                          {quiz.improvement}
                        </div>
                        <div className="text-xs text-gray-700">Improvement</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <span>Out of {quiz.totalParticipants} participants</span>
                        {quiz.improvement.startsWith('+') && (
                          <div className="flex items-center text-green-600">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            <span>Improving</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" className="border-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl" asChild>
                          <Link href={`/quiz/${quiz.id}/results`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" className="border-2 border-green-200 text-green-700 hover:bg-green-50 rounded-xl">
                          <Download className="h-4 w-4 mr-1" />
                          Report
                        </Button>
                        <Button variant="outline" size="sm" className="border-2 border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl">
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Retake
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredQuizzes.length === 0 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No completed quizzes found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search criteria or complete some quizzes first.</p>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                <Link href="/quiz/available">
                  <Trophy className="h-4 w-4 mr-2" />
                  Take a Quiz
                </Link>
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}