'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  BookOpen, 
  Clock, 
  Trophy, 
  TrendingUp, 
  Calendar,
  User,
  Bell,
  Play,
  CheckCircle,
  BarChart3,
  Target,
  Award,
  BookMarked,
  FileText,
  Zap,
  Brain,
  Sparkles,
  Star,
  ArrowRight,
  Timer,
  Users,
  Medal,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [greeting, setGreeting] = useState('');
  
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

 
  
  const studentData = {
    name: 'Ahmad Hassan',
    course: 'MDCAT',
    profilePicture: '/api/placeholder/150/150',
    overallProgress: 78,
    currentStreak: 15,
    totalQuizzes: 45,
    averageScore: 85.5,
    rank: 12,
    totalStudents: 1250
  };

  const upcomingQuizzes = [
    {
      id: 1,
      title: 'Biology - Cell Structure & Function',
      course: 'MDCAT',
      date: '2024-01-15',
      time: '10:00 AM',
      duration: '90 minutes',
      questions: 50,
      status: 'upcoming',
      difficulty: 'Medium',
      participants: 234
    },
    {
      id: 2,
      title: 'Chemistry - Organic Compounds',
      course: 'MDCAT',
      date: '2024-01-16',
      time: '2:00 PM',
      duration: '75 minutes',
      questions: 40,
      status: 'upcoming',
      difficulty: 'Hard',
      participants: 189
    }
  ];

  const activeQuizzes = [
    {
      id: 3,
      title: 'Physics - Mechanics & Motion',
      course: 'MDCAT',
      timeRemaining: '45:30',
      completed: 25,
      total: 50,
      status: 'active'
    }
  ];

  const completedQuizzes = [
    {
      id: 4,
      title: 'Mathematics - Algebra & Functions',
      course: 'MDCAT',
      score: 92,
      date: '2024-01-10',
      rank: 5,
      totalParticipants: 150,
      status: 'completed',
      improvement: '+8%'
    },
    {
      id: 5,
      title: 'Biology - Genetics & Evolution',
      course: 'MDCAT',
      score: 88,
      date: '2024-01-08',
      rank: 8,
      totalParticipants: 120,
      status: 'completed',
      improvement: '+12%'
    }
  ];

  const mockTests = [
    {
      id: 1,
      title: 'Biology Mock Test #1',
      questions: 30,
      duration: '45 minutes',
      difficulty: 'Medium',
      lastAttempted: '2024-01-12',
      bestScore: 85,
      attempts: 3
    },
    {
      id: 2,
      title: 'Chemistry Mock Test #2',
      questions: 25,
      duration: '40 minutes',
      difficulty: 'Hard',
      lastAttempted: '2024-01-10',
      bestScore: 78,
      attempts: 2
    }
  ];

  const performanceData = [
    { subject: 'Biology', score: 92, progress: 92, color: 'from-green-500 to-emerald-500', trend: '+5%' },
    { subject: 'Chemistry', score: 85, progress: 85, color: 'from-blue-500 to-cyan-500', trend: '+3%' },
    { subject: 'Physics', score: 88, progress: 88, color: 'from-purple-500 to-pink-500', trend: '+7%' },
    { subject: 'Mathematics', score: 90, progress: 90, color: 'from-orange-500 to-red-500', trend: '+2%' }
  ];

  const achievements = [
    { title: 'First Quiz Completed', icon: Trophy, color: 'text-yellow-500' },
    { title: '7-Day Streak', icon: Target, color: 'text-green-500' },
    { title: 'Top 10 Performer', icon: Medal, color: 'text-purple-500' },
    { title: 'Perfect Score', icon: Star, color: 'text-blue-500' }
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Sidebar */}
      <Sidebar  />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {greeting}, {studentData.name}! 👋
              </h1>
              <p className="text-gray-600">Ready to continue your {studentData.course} preparation?</p>
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
                  <div className="text-sm font-semibold text-gray-900">{studentData.name}</div>
                  <div className="text-xs text-gray-500">{studentData.course} Student</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Overall Progress</p>
                    <p className="text-3xl font-bold text-gray-900">{studentData.overallProgress}%</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl shadow-lg">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                </div>
                <Progress value={studentData.overallProgress} className="h-2" />
                <p className="text-xs text-green-600 mt-2 font-medium">+5% from last week</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Current Streak</p>
                    <p className="text-3xl font-bold text-gray-900">{studentData.currentStreak} days</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-lg">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-6 rounded-full ${
                        i < (studentData.currentStreak % 7) ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-green-600 mt-2 font-medium">Keep it up! 🔥</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Quizzes Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{studentData.totalQuizzes}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">Rank #{studentData.rank}</Badge>
                  <span className="text-xs text-gray-500">of {studentData.totalStudents}</span>
                </div>
                <p className="text-xs text-purple-600 mt-2 font-medium">Top 1% performer! 🏆</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Score</p>
                    <p className="text-3xl font-bold text-gray-900">{studentData.averageScore}%</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(studentData.averageScore / 20) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-orange-600 mt-2 font-medium">Excellent performance! ⭐</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-1">
              <TabsTrigger value="overview" className="rounded-xl font-medium">Overview</TabsTrigger>
              <TabsTrigger value="quizzes" className="rounded-xl font-medium">Quizzes</TabsTrigger>
              <TabsTrigger value="mock-tests" className="rounded-xl font-medium">Mock Tests</TabsTrigger>
              <TabsTrigger value="performance" className="rounded-xl font-medium">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Active Quiz */}
                <Card className="lg:col-span-2 glass-card border-0 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3">
                      <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                        <Play className="h-5 w-5 text-white" />
                      </div>
                      <span>Active Quiz</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeQuizzes.length > 0 ? (
                      <div className="space-y-4">
                        {activeQuizzes.map((quiz) => (
                          <div key={quiz.id} className="border border-gray-200 rounded-2xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="font-bold text-xl text-gray-900 mb-2">{quiz.title}</h3>
                                <Badge variant="secondary" className="bg-green-100 text-green-800">{quiz.course}</Badge>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-gray-600 mb-1">Time Remaining</div>
                                <div className="text-2xl font-bold text-red-600 flex items-center space-x-1">
                                  <Timer className="h-5 w-5" />
                                  <span>{quiz.timeRemaining}</span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-sm font-medium">
                                <span>Progress</span>
                                <span>{quiz.completed}/{quiz.total} questions</span>
                              </div>
                              <Progress value={(quiz.completed / quiz.total) * 100} className="h-3" />
                            </div>
                            <Button className="w-full mt-6 h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                              <Link href={`/quiz/${quiz.id}`}>
                                <Play className="mr-2 h-5 w-5" />
                                Continue Quiz
                              </Link>
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                          <Clock className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-lg font-medium">No active quizzes</p>
                        <p className="text-sm">Start a new quiz to begin practicing</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions & Achievements */}
                <div className="space-y-6">
                  <Card className="glass-card border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="h-5 w-5 text-purple-600" />
                        <span>Quick Actions</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                        <Link href="/quiz/create-mock">
                          <Brain className="h-5 w-5 mr-2" />
                          Create Mock Test
                        </Link>
                      </Button>
                      <Button variant="outline" className="w-full h-12 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl font-medium" asChild>
                        <Link href="/student/analytics">
                          <BarChart3 className="h-5 w-5 mr-2" />
                          View Analytics
                        </Link>
                      </Button>
                      <Button variant="outline" className="w-full h-12 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-medium" asChild>
                        <Link href="/student/profile">
                          <User className="h-5 w-5 mr-2" />
                          Edit Profile
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-card border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Sparkles className="h-5 w-5 text-yellow-600" />
                        <span>Achievements</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        {achievements.map((achievement, index) => (
                          <div key={index} className="text-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <achievement.icon className={`h-6 w-6 mx-auto mb-2 ${achievement.color}`} />
                            <p className="text-xs font-medium text-gray-700">{achievement.title}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Upcoming Quizzes */}
              <Card className="glass-card border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <span>Upcoming Quizzes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {upcomingQuizzes.map((quiz) => (
                      <div key={quiz.id} className="border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-all duration-300 bg-white">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 mb-2">{quiz.title}</h3>
                            <div className="flex items-center space-x-2 mb-3">
                              <Badge variant="secondary">{quiz.course}</Badge>
                              <Badge variant={quiz.difficulty === 'Hard' ? 'destructive' : quiz.difficulty === 'Medium' ? 'default' : 'secondary'}>
                                {quiz.difficulty}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4" />
                            <span>{quiz.date} at {quiz.time}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4" />
                            <span>{quiz.duration}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span>{quiz.questions} questions</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4" />
                            <span>{quiz.participants} participants</span>
                          </div>
                        </div>
                        
                        <Button className="w-full mt-4 h-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium" size="sm">
                          Set Reminder
                          <Bell className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quizzes" className="space-y-6">
              <Card className="glass-card border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl">
                      <CheckCircle className="h-5 w-5 text-white" />
                    </div>
                    <span>Completed Quizzes</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {completedQuizzes.map((quiz) => (
                      <div key={quiz.id} className="flex items-center justify-between p-6 border border-gray-200 rounded-2xl hover:shadow-lg transition-all duration-300 bg-white">
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-gray-900 mb-2">{quiz.title}</h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>Completed on {quiz.date}</span>
                            <Badge variant="outline">Rank: {quiz.rank}/{quiz.totalParticipants}</Badge>
                            <span className="text-green-600 font-medium">{quiz.improvement}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-green-600 mb-1">{quiz.score}%</div>
                          <Badge variant="secondary">{quiz.course}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mock-tests" className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-gray-900">Mock Tests</h2>
                <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                  <Link href="/quiz/create-mock">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Test
                  </Link>
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mockTests.map((test) => (
                  <Card key={test.id} className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                    <CardHeader>
                      <CardTitle className="text-xl">{test.title}</CardTitle>
                      <CardDescription className="text-gray-600">
                        {test.questions} questions • {test.duration}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Difficulty</span>
                          <Badge variant={test.difficulty === 'Hard' ? 'destructive' : 'secondary'}>
                            {test.difficulty}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Best Score</span>
                          <span className="font-bold text-lg text-green-600">{test.bestScore}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Attempts</span>
                          <span className="text-sm font-medium">{test.attempts}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Last Attempted</span>
                          <span className="text-sm">{test.lastAttempted}</span>
                        </div>
                        <Button className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium">
                          <Play className="h-4 w-4 mr-2" />
                          Start Test
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-6">
              <Card className="glass-card border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <span>Subject-wise Performance</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {performanceData.map((subject) => (
                      <div key={subject.subject} className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${subject.color}`}></div>
                            <span className="font-semibold text-lg">{subject.subject}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-semibold text-green-600">{subject.trend}</span>
                            <span className="text-xl font-bold">{subject.score}%</span>
                          </div>
                        </div>
                        <Progress value={subject.progress} className="h-3" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}