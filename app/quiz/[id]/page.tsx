'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Flag, 
  CheckCircle, 
  AlertCircle,
  BookOpen,
  Eye,
  EyeOff,
  Save,
  Send
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

export default function QuizPlayer() {
  const params = useParams();
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{[key: number]: string}>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(2700); // 45 minutes in seconds
  const [showNavigationPanel, setShowNavigationPanel] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock quiz data
  const quizData = {
    id: params.id,
    title: 'Physics - Mechanics',
    course: 'MDCAT',
    totalQuestions: 50,
    duration: 45,
    instructions: [
      'Read each question carefully before selecting your answer',
      'You can mark questions for review and come back to them later',
      'Make sure to submit your quiz before the time expires',
      'Each question carries equal marks'
    ],
    questions: [
      {
        id: 1,
        question: 'What is the SI unit of force?',
        options: ['Newton', 'Joule', 'Watt', 'Pascal'],
        explanation: 'The SI unit of force is Newton (N), named after Isaac Newton.'
      },
      {
        id: 2,
        question: 'Which of the following is a vector quantity?',
        options: ['Speed', 'Distance', 'Velocity', 'Time'],
        explanation: 'Velocity is a vector quantity as it has both magnitude and direction.'
      },
      {
        id: 3,
        question: 'What is the acceleration due to gravity on Earth?',
        options: ['9.8 m/s²', '10 m/s²', '9.6 m/s²', '8.9 m/s²'],
        explanation: 'The standard value for acceleration due to gravity on Earth is 9.8 m/s².'
      }
    ]
  };

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Auto-save effect
  useEffect(() => {
    const autoSave = setInterval(() => {
      // Save current state to localStorage or API
      localStorage.setItem(`quiz-${params.id}`, JSON.stringify({
        selectedAnswers,
        markedForReview: Array.from(markedForReview),
        currentQuestion,
        timeRemaining
      }));
    }, 10000); // Auto-save every 10 seconds

    return () => clearInterval(autoSave);
  }, [selectedAnswers, markedForReview, currentQuestion, timeRemaining, params.id]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionId: number, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleMarkForReview = (questionId: number) => {
    setMarkedForReview(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear saved state
    localStorage.removeItem(`quiz-${params.id}`);
    
    // Redirect to results
    router.push(`/quiz/${params.id}/results`);
  };

  const getQuestionStatus = (questionIndex: number) => {
    const questionId = quizData.questions[questionIndex].id;
    const isAnswered = selectedAnswers[questionId];
    const isMarked = markedForReview.has(questionId);
    
    if (isAnswered && isMarked) return 'answered-marked';
    if (isAnswered) return 'answered';
    if (isMarked) return 'marked';
    return 'not-answered';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'answered': return 'bg-green-500';
      case 'marked': return 'bg-yellow-500';
      case 'answered-marked': return 'bg-blue-500';
      default: return 'bg-gray-300';
    }
  };

  const currentQuestionData = quizData.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / quizData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{quizData.title}</h1>
                  <p className="text-sm text-gray-600">{quizData.course}</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-red-600" />
                <span className="text-lg font-mono font-semibold text-red-600">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNavigationPanel(!showNavigationPanel)}
              >
                {showNavigationPanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-2">Panel</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Main Quiz Area */}
          <div className="flex-1">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">
                    Question {currentQuestion + 1} of {quizData.questions.length}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkForReview(currentQuestionData.id)}
                      className={markedForReview.has(currentQuestionData.id) ? 'bg-yellow-100' : ''}
                    >
                      <Flag className="h-4 w-4 mr-1" />
                      {markedForReview.has(currentQuestionData.id) ? 'Unmark' : 'Mark for Review'}
                    </Button>
                  </div>
                </div>
                <Progress value={progress} className="mt-2" />
              </CardHeader>
              
              <CardContent className="space-y-6">
                <div className="text-lg font-medium leading-relaxed">
                  {currentQuestionData.question}
                </div>
                
                <div className="space-y-3">
                  {currentQuestionData.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <input
                        type="radio"
                        id={`option-${index}`}
                        name={`question-${currentQuestionData.id}`}
                        value={option}
                        checked={selectedAnswers[currentQuestionData.id] === option}
                        onChange={() => handleAnswerSelect(currentQuestionData.id, option)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label
                        htmlFor={`option-${index}`}
                        className="flex-1 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + index)}.</span>
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between items-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestion === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    {currentQuestion === quizData.questions.length - 1 ? (
                      <Button 
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Submitting...' : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Quiz
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setCurrentQuestion(prev => Math.min(quizData.questions.length - 1, prev + 1))}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Navigation Panel */}
          {showNavigationPanel && (
            <div className="w-80">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Question Navigation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Legend */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-green-500 rounded"></div>
                        <span className="text-sm">Answered</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                        <span className="text-sm">Marked for Review</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-blue-500 rounded"></div>
                        <span className="text-sm">Answered & Marked</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-gray-300 rounded"></div>
                        <span className="text-sm">Not Answered</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Question Grid */}
                    <div className="grid grid-cols-5 gap-2">
                      {quizData.questions.map((_, index) => (
                        <Button
                          key={index}
                          variant={currentQuestion === index ? "default" : "outline"}
                          size="sm"
                          className={`h-10 w-10 p-0 ${getStatusColor(getQuestionStatus(index))}`}
                          onClick={() => setCurrentQuestion(index)}
                        >
                          {index + 1}
                        </Button>
                      ))}
                    </div>
                    
                    <Separator />
                    
                    {/* Summary */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Questions:</span>
                        <span>{quizData.questions.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Answered:</span>
                        <span>{Object.keys(selectedAnswers).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Marked for Review:</span>
                        <span>{markedForReview.size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Not Answered:</span>
                        <span>{quizData.questions.length - Object.keys(selectedAnswers).length}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}