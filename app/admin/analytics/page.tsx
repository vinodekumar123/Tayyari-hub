'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Trophy, 
  BookOpen,
  Calendar,
  Download,
  Filter,
  Eye,
  Target,
  Clock,
  Award,
  Zap,
  Brain
} from 'lucide-react';
import Link from 'next/link';

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedCourse, setSelectedCourse] = useState('all');

  const analyticsData = {
    overview: {
      totalStudents: 1250,
      activeStudents: 892,
      totalQuizzes: 156,
      completionRate: 78.5,
      averageScore: 76.3,
      improvement: '+12.5%'
    },
    studentEngagement: [
      { day: 'Mon', active: 120, completed: 89 },
      { day: 'Tue', active: 135, completed: 102 },
      { day: 'Wed', active: 98, completed: 76 },
      { day: 'Thu', active: 156, completed: 134 },
      { day: 'Fri', active: 189, completed: 167 },
      { day: 'Sat', active: 234, completed: 198 },
      { day: 'Sun', active: 198, completed: 156 }
    ],
    topPerformers: [
      { name: 'Ahmad Hassan', course: 'MDCAT', score: 95.2, quizzes: 45 },
      { name: 'Fatima Ali', course: 'ECAT', score: 93.8, quizzes: 38 },
      { name: 'Ali Khan', course: 'MDCAT', score: 92.5, quizzes: 42 },
      { name: 'Sara Ahmed', course: 'LAT', score: 91.7, quizzes: 35 },
      { name: 'Hassan Ali', course: 'ECAT', score: 90.9, quizzes: 40 }
    ],
    coursePerformance: [
      { course: 'MDCAT', students: 650, avgScore: 78.5, completion: 82, color: 'from-blue-500 to-cyan-500' },
      { course: 'ECAT', students: 420, avgScore: 75.2, completion: 79, color: 'from-green-500 to-emerald-500' },
      { course: 'LAT', students: 180, avgScore: 73.8, completion: 75, color: 'from-purple-500 to-pink-500' }
    ],
    subjectAnalysis: [
      { subject: 'Biology', avgScore: 82.1, difficulty: 'Medium', attempts: 2340 },
      { subject: 'Chemistry', avgScore: 76.8, difficulty: 'Hard', attempts: 2156 },
      { subject: 'Physics', avgScore: 74.2, difficulty: 'Hard', attempts: 1987 },
      { subject: 'Mathematics', avgScore: 79.5, difficulty: 'Medium', attempts: 1654 }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/admin" className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Analytics Dashboard</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 3 months</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900">{analyticsData.overview.totalStudents}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                +8.2% from last month
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Students</p>
                  <p className="text-3xl font-bold text-gray-900">{analyticsData.overview.activeStudents}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-lg">
                  <Zap className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                +12.5% from last month
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-3xl font-bold text-gray-900">{analyticsData.overview.completionRate}%</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl shadow-lg">
                  <Target className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                +3.2% from last month
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Average Score</p>
                  <p className="text-3xl font-bold text-gray-900">{analyticsData.overview.averageScore}%</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl shadow-lg">
                  <Award className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                {analyticsData.overview.improvement}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Analytics */}
        <Tabs defaultValue="engagement" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-1">
            <TabsTrigger value="engagement" className="rounded-xl font-medium">Student Engagement</TabsTrigger>
            <TabsTrigger value="performance" className="rounded-xl font-medium">Course Performance</TabsTrigger>
            <TabsTrigger value="subjects" className="rounded-xl font-medium">Subject Analysis</TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl font-medium">Top Performers</TabsTrigger>
          </TabsList>

          <TabsContent value="engagement" className="space-y-6">
            <Card className="glass-card border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  <span>Weekly Student Engagement</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 flex items-end justify-between space-x-2">
                  {analyticsData.studentEngagement.map((day, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                      <div className="w-full space-y-1">
                        <div 
                          className="bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg transition-all duration-500 hover:from-blue-600 hover:to-blue-400"
                          style={{ height: `${(day.active / 250) * 200}px` }}
                        />
                        <div 
                          className="bg-gradient-to-t from-green-500 to-green-300 rounded-t-lg transition-all duration-500 hover:from-green-600 hover:to-green-400"
                          style={{ height: `${(day.completed / 250) * 200}px` }}
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900">{day.day}</div>
                        <div className="text-xs text-gray-600">{day.active}/{day.completed}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center space-x-6 mt-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-300 rounded"></div>
                    <span className="text-sm text-gray-600">Active Students</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-green-300 rounded"></div>
                    <span className="text-sm text-gray-600">Quiz Completions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {analyticsData.coursePerformance.map((course, index) => (
                <Card key={index} className="glass-card border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{course.course}</span>
                      <Badge variant="secondary">{course.students} students</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Average Score</span>
                          <span className="font-semibold">{course.avgScore}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full bg-gradient-to-r ${course.color} transition-all duration-500`}
                            style={{ width: `${course.avgScore}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Completion Rate</span>
                          <span className="font-semibold">{course.completion}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="h-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${course.completion}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="subjects" className="space-y-6">
            <Card className="glass-card border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  <span>Subject-wise Analysis</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {analyticsData.subjectAnalysis.map((subject, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-white/50 rounded-2xl hover:bg-white/70 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center">
                          <BookOpen className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{subject.subject}</h3>
                          <p className="text-sm text-gray-600">{subject.attempts} total attempts</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 mb-1">{subject.avgScore}%</div>
                        <Badge variant={
                          subject.difficulty === 'Easy' ? 'secondary' :
                          subject.difficulty === 'Medium' ? 'default' : 'destructive'
                        }>
                          {subject.difficulty}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-6">
            <Card className="glass-card border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  <span>Top Performers</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.topPerformers.map((student, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-white/50 rounded-2xl hover:bg-white/70 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="relative">
                          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold">#{index + 1}</span>
                          </div>
                          {index === 0 && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                              <Trophy className="h-3 w-3 text-yellow-800" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{student.name}</h3>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{student.course}</Badge>
                            <span className="text-sm text-gray-600">{student.quizzes} quizzes</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">{student.score}%</div>
                        <div className="text-sm text-gray-600">Average Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}