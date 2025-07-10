'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Trophy, 
  Target, 
  Clock, 
  CheckCircle, 
  XCircle, 
  BarChart3,
  BookOpen,
  ArrowRight,
  Download,
  Share2,
  RefreshCw,
  TrendingUp,
  Award,
  Star,
  Users,
  Calendar,
  Eye
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function QuizResults() {
  const params = useParams();
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(false);

  // Mock results data
  const results = {
    quizId: params.id,
    title: 'Physics - Mechanics',
    course: 'MDCAT',
    score: 85,
    totalQuestions: 50,
    correctAnswers: 42,
    incorrectAnswers: 6,
    skippedAnswers: 2,
    timeTaken: '38:45',
    totalTime: '45:00',
    rank: 12,
    totalParticipants: 234,
    percentile: 92,
    accuracy: 84,
    completedAt: new Date().toISOString(),
    improvement: '+8%'
  };

  const subjectWiseResults = [
    { subject: 'Mechanics', total: 20, correct: 18, percentage: 90, color: 'from-green-500 to-emerald-500' },
    { subject: 'Thermodynamics', total: 15, correct: 12, percentage: 80, color: 'from-blue-500 to-cyan-500' },
    { subject: 'Electromagnetism', total: 10, correct: 8, percentage: 80, color: 'from-purple-500 to-pink-500' },
    { subject: 'Modern Physics', total: 5, correct: 4, percentage: 80, color: 'from-orange-500 to-red-500' }
  ];

  const questionAnalysis = [
    {
      id: 1,
      question: 'What is the SI unit of force?',
      yourAnswer: 'Newton',
      correctAnswer: 'Newton',
      isCorrect: true,
      explanation: 'The SI unit of force is Newton (N), named after Isaac Newton.',
      difficulty: 'Easy',
      subject: 'Mechanics'
    },
    {
      id: 2,
      question: 'Which of the following is a vector quantity?',
      yourAnswer: 'Speed',
      correctAnswer: 'Velocity',
      isCorrect: false,
      explanation: 'Velocity is a vector quantity as it has both magnitude and direction, while speed is a scalar.',
      difficulty: 'Medium',
      subject: 'Mechanics'
    },
    {
      id: 3,
      question: 'What is the acceleration due to gravity on Earth?',
      yourAnswer: null,
      correctAnswer: '9.8 m/s²',
      isCorrect: false,
      explanation: 'The standard value for acceleration due to gravity on Earth is 9.8 m/s².',
      difficulty: 'Easy',
      subject: 'Mechanics'
    }
  ];

  useEffect(() => {
    if (results.score >= 80) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    }
  }, [results.score]);

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

  const scoreBadge = getScoreBadge(results.score);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 opacity-20 animate-pulse" />
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Quiz Results</h1>
                  <p className="text-sm text-gray-600">{results.title}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Link href="/dashboard/student">
                <Button size="sm">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Overview */}
        <div className="mb-8">
          <Card className="glass-card border-0 shadow-2xl overflow-hidden">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-2xl">
                      <div className="text-4xl font-bold text-white">{results.score}%</div>
                    </div>
                    {results.score >= 80 && (
                      <div className="absolute -top-2 -right-2 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce">
                        <Trophy className="h-6 w-6 text-yellow-800" />
                      </div>
                    )}
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {results.score >= 90 ? 'Outstanding Performance!' : 
                   results.score >= 75 ? 'Great Job!' : 
                   results.score >= 60 ? 'Good Effort!' : 'Keep Practicing!'}
                </h2>
                <Badge className={`${scoreBadge.color} px-4 py-2 text-lg font-medium`}>
                  {scoreBadge.text}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-white/50 rounded-2xl">
                  <div className="text-2xl font-bold text-green-600 mb-1">{results.correctAnswers}</div>
                  <div className="text-sm text-gray-600">Correct</div>
                </div>
                <div className="text-center p-4 bg-white/50 rounded-2xl">
                  <div className="text-2xl font-bold text-red-600 mb-1">{results.incorrectAnswers}</div>
                  <div className="text-sm text-gray-600">Incorrect</div>
                </div>
                <div className="text-center p-4 bg-white/50 rounded-2xl">
                  <div className="text-2xl font-bold text-yellow-600 mb-1">{results.skippedAnswers}</div>
                  <div className="text-sm text-gray-600">Skipped</div>
                </div>
                <div className="text-center p-4 bg-white/50 rounded-2xl">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{results.timeTaken}</div>
                  <div className="text-sm text-gray-600">Time Taken</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-purple-600" />
                <span>Accuracy</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600 mb-2">{results.accuracy}%</div>
              <Progress value={results.accuracy} className="h-3 mb-2" />
              <p className="text-sm text-gray-600">
                {results.correctAnswers} out of {results.totalQuestions - results.skippedAnswers} attempted
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Ranking</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 mb-2">#{results.rank}</div>
              <p className="text-sm text-gray-600 mb-2">
                Out of {results.totalParticipants} participants
              </p>
              <Badge variant="secondary">
                {results.percentile}th percentile
              </Badge>
            </CardContent>
          </Card>

          <Card className="glass-card border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span>Improvement</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 mb-2">{results.improvement}</div>
              <p className="text-sm text-gray-600">
                Compared to your last attempt
              </p>
              <div className="flex items-center mt-2 text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                Keep up the great work!
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analysis */}
        <Tabs defaultValue="subject-wise" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-1">
            <TabsTrigger value="subject-wise" className="rounded-xl font-medium">Subject Analysis</TabsTrigger>
            <TabsTrigger value="question-review" className="rounded-xl font-medium">Question Review</TabsTrigger>
            <TabsTrigger value="recommendations" className="rounded-xl font-medium">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="subject-wise" className="space-y-6">
            <Card className="glass-card border-0 shadow-xl">
              <CardHeader>
                <CardTitle>Subject-wise Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {subjectWiseResults.map((subject, index) => (
                    <div key={index} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${subject.color}`}></div>
                          <span className="font-semibold text-lg">{subject.subject}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{subject.correct}/{subject.total}</div>
                          <div className="text-sm text-gray-600">{subject.percentage}%</div>
                        </div>
                      </div>
                      <Progress value={subject.percentage} className="h-3" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="question-review" className="space-y-6">
            <Card className="glass-card border-0 shadow-xl">
              <CardHeader>
                <CardTitle>Question by Question Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {questionAnalysis.map((question, index) => (
                    <div key={question.id} className="border border-gray-200 rounded-2xl p-6 bg-white/50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-sm font-medium text-gray-600">Question {question.id}</span>
                            <Badge variant="outline">{question.subject}</Badge>
                            <Badge variant={question.difficulty === 'Easy' ? 'secondary' : question.difficulty === 'Medium' ? 'default' : 'destructive'}>
                              {question.difficulty}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-lg text-gray-900 mb-3">{question.question}</h3>
                        </div>
                        <div className="ml-4">
                          {question.isCorrect ? (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          ) : (
                            <XCircle className="h-6 w-6 text-red-600" />
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-1">Your Answer</div>
                          <div className={`p-3 rounded-lg ${
                            question.yourAnswer === null ? 'bg-gray-100 text-gray-500' :
                            question.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {question.yourAnswer || 'Not answered'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-600 mb-1">Correct Answer</div>
                          <div className="p-3 rounded-lg bg-green-100 text-green-800">
                            {question.correctAnswer}
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-blue-800 mb-2">Explanation</div>
                        <p className="text-blue-700">{question.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="glass-card border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                    <span>Study Recommendations</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <h4 className="font-semibold text-yellow-800 mb-2">Focus Areas</h4>
                      <ul className="text-yellow-700 space-y-1">
                        <li>• Thermodynamics concepts</li>
                        <li>• Vector quantities vs scalar quantities</li>
                        <li>• Modern Physics applications</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-2">Strengths</h4>
                      <ul className="text-green-700 space-y-1">
                        <li>• Excellent in Mechanics</li>
                        <li>• Strong problem-solving skills</li>
                        <li>• Good time management</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card border-0 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <span>Next Steps</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button className="w-full h-12 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] font-medium" asChild>
                      <Link href="/quiz/create-mock">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Take Another Quiz
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full h-12 border-2 border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl font-medium" asChild>
                      <Link href="/practice/thermodynamics">
                        <BookOpen className="h-4 w-4 mr-2" />
                        Practice Thermodynamics
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full h-12 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-medium" asChild>
                      <Link href="/dashboard/student">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Progress
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}