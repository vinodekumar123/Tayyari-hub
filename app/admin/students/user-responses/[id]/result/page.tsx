'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '@/app/firebase';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, CheckCircle, XCircle, Circle, Clock, BarChart3, Target, BookOpen } from 'lucide-react';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  subject?: string;
  chapter?: string;
  difficulty?: string;
}

interface AttemptDetailed {
  questionId: string;
  questionText: string;
  selected: string | undefined;
  correct: string | undefined;
  isCorrect: boolean;
  explanation?: string;
  options: string[];
  chapter?: string;
  subject?: string;
  difficulty?: string;
}

interface QuizData {
  name: string;
  subject: string;
  chapters: string[];
  selectedQuestions: Question[];
}

const UserQuizResultPage: React.FC = () => {
  const params = useParams();
  const quizId = params?.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [detailed, setDetailed] = useState<AttemptDetailed[]>([]);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [skippedQuestions, setSkippedQuestions] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [subjectStats, setSubjectStats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'wrong' | 'skipped'>('overview');
  const { width, height } = useWindowSize();

  useEffect(() => {
    onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!quizId || !user) return;

      // Get quiz details
      const quizDoc = doc(db, 'user-quizzes', quizId);
      const quizSnap = await getDoc(quizDoc);
      if (!quizSnap.exists()) return;

      const quizData = quizSnap.data();
      // Get attempt (result) for current user
      const attemptDoc = doc(db, 'users', user.uid, 'quizAttempts', quizId);
      const attemptSnap = await getDoc(attemptDoc);
      if (!attemptSnap.exists()) return;

      const attemptData = attemptSnap.data();
      const questions: Question[] = quizData.selectedQuestions || [];
      const answers: Record<string, string> = attemptData.answers || {};
      const detailed: AttemptDetailed[] = attemptData.detailed || [];

      setQuiz({
        name: quizData.name || 'Untitled Quiz',
        subject: quizData.subject || 'N/A',
        chapters: quizData.chapters || [],
        selectedQuestions: questions,
      });
      setAnswers(answers);
      setDetailed(detailed);

      // Calculate stats
      let correct = 0;
      let wrong = 0;
      let skipped = 0;
      questions.forEach((q, idx) => {
        const userAnswer = answers[q.id];
        if (!userAnswer || userAnswer === '') {
          skipped++;
        } else if (userAnswer === q.correctAnswer) {
          correct++;
        } else {
          wrong++;
        }
      });
      setScore(correct);
      setWrongAnswers(wrong);
      setSkippedQuestions(skipped);

      // Subject-wise stats
      const subjectStatsMap: Record<string, any> = {};
      questions.forEach(q => {
        const subject = q.subject || 'General';
        if (!subjectStatsMap[subject]) {
          subjectStatsMap[subject] = {
            subject,
            total: 0, correct: 0, wrong: 0, skipped: 0, percentage: 0
          };
        }
        const stats = subjectStatsMap[subject];
        stats.total++;
        const userAnswer = answers[q.id];
        if (!userAnswer || userAnswer === '') stats.skipped++;
        else if (userAnswer === q.correctAnswer) stats.correct++;
        else stats.wrong++;
        stats.percentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
      });
      setSubjectStats(Object.values(subjectStatsMap));

      if (correct / questions.length >= 0.7) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 6000);
      }
    };
    load();
  }, [quizId, user]);

  if (!quiz) return <p className="text-center py-10">Loading result...</p>;

  const groupedBySubject = quiz.selectedQuestions.reduce((acc, q) => {
    const subj = q.subject || 'General';
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  const wrongQuestions = quiz.selectedQuestions.filter(q => {
    const userAnswer = answers[q.id];
    return userAnswer && userAnswer !== q.correctAnswer;
  });

  const skippedQuestionsList = quiz.selectedQuestions.filter(q => {
    const userAnswer = answers[q.id];
    return !userAnswer || userAnswer === '';
  });

  const totalQuestions = quiz.selectedQuestions.length;
  const percentage = (score / totalQuestions) * 100;
  let remark = 'Needs Improvement';
  if (percentage === 100) remark = '🏆 Perfect Score! Outstanding!';
  else if (percentage >= 90) remark = '🔥 Excellent Performance!';
  else if (percentage >= 70) remark = '🎉 Great Job!';
  else if (percentage >= 50) remark = '👍 Good Effort';
  else remark = '📘 Keep Practicing';

  // Render similar question card as admin
  const renderQuestionCard = (q: Question, idx: number, showSubject: boolean = false) => {
    const userAnswer = answers[q.id];
    const isCorrect = userAnswer === q.correctAnswer;
    const isSkipped = !userAnswer || userAnswer === '';

    return (
      <Card key={q.id} className="mb-6 shadow-md border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900 flex gap-2 items-center">
            <span>Q{idx + 1}.</span>
            <span dangerouslySetInnerHTML={{ __html: q.questionText }} />
            {isSkipped && (
              <Badge variant="secondary" className="ml-auto bg-yellow-100 text-yellow-800">
                <Clock className="w-3 h-3 mr-1" />
                Skipped
              </Badge>
            )}
            {showSubject && q.subject && (
              <Badge variant="outline" className="ml-auto">
                {q.subject}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.options.map((opt, i) => {
            const isSelected = opt === userAnswer;
            const isAnswer = opt === q.correctAnswer;

            let style = 'border-gray-300';
            let icon = <Circle className="text-gray-400 w-4 h-4 mr-2" />;

            if (isAnswer) {
              style = 'border-green-500 bg-green-100';
              icon = <CheckCircle className="text-green-600 w-5 h-5 mr-2" />;
            } else if (isSelected && !isAnswer) {
              style = 'border-red-500 bg-red-100';
              icon = <XCircle className="text-red-600 w-5 h-5 mr-2" />;
            }

            return (
              <div
                key={i}
                className={`flex items-center p-4 rounded-lg border text-base font-medium ${style}`}
              >
                {icon}
                {String.fromCharCode(65 + i)}. {opt}
              </div>
            );
          })}

          {q.explanation && (
            <div className="bg-blue-50 border border-blue-200 p-4 text-blue-800 rounded-lg flex items-start gap-3">
              <Info className="h-5 w-5 mt-1" />
              <p>{q.explanation}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white px-6 py-10 mx-auto">
      {showConfetti && (
        <>
          <Confetti width={width} height={height} />
          <div className="text-4xl text-center font-bold my-6 animate-bounce">
            🎉 Congratulations! 🎉
          </div>
        </>
      )}

      {/* Main Result Card */}
      <Card className="mb-10 shadow-2xl border-0">
        <CardHeader className="bg-blue-600 rounded-t-xl text-white p-6">
          <CardTitle className="text-3xl font-bold">{quiz.name} - Result</CardTitle>
        </CardHeader>
        <CardContent className="bg-white p-6 space-y-4 rounded-b-xl text-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-green-100 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium">✅ Correct</p>
              <p className="text-2xl font-bold text-green-800">{score}</p>
            </div>
            <div className="bg-red-100 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">❌ Wrong</p>
              <p className="text-2xl font-bold text-red-800">{wrongAnswers}</p>
            </div>
            <div className="bg-yellow-100 rounded-lg p-4">
              <p className="text-sm text-yellow-800 font-medium">⏭️ Skipped</p>
              <p className="text-2xl font-bold text-yellow-800">{skippedQuestions}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium">📘 Subject</p>
              <p className="text-lg font-semibold text-blue-800">{quiz.subject}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-4">
              <p className="text-sm text-purple-800 font-medium">📊 Score</p>
              <p className="text-xl font-bold text-purple-800">{percentage.toFixed(1)}%</p>
            </div>
          </div>
          <div className="text-center pt-4">
            <Badge className="text-base px-4 py-2 rounded-full bg-indigo-600 text-white animate-pulse">
              {remark}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Tabs */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-lg shadow-md">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            All Questions
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'subjects'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Subject Analysis
          </button>
          <button
            onClick={() => setActiveTab('wrong')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'wrong'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <XCircle className="w-4 h-4" />
            Wrong Answers ({wrongAnswers})
          </button>
          <button
            onClick={() => setActiveTab('skipped')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'skipped'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            Skipped ({skippedQuestions})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {Object.entries(groupedBySubject).map(([subject, questions]) => (
            <div key={subject} className="mb-8">
              <h2 className="text-2xl font-bold text-blue-700 mb-4 flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                {subject}
              </h2>
              {questions.map((q, idx) => renderQuestionCard(q, idx))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-blue-700 mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Subject-wise Performance
          </h2>
          
          <div className="grid gap-4">
            {subjectStats.map((stats) => (
              <Card key={stats.subject} className="shadow-md">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{stats.subject}</h3>
                    <Badge 
                      className={`px-3 py-1 ${
                        stats.percentage >= 70 
                          ? 'bg-green-100 text-green-800' 
                          : stats.percentage >= 50
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {stats.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                      <p className="text-sm text-blue-800">Total</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{stats.correct}</p>
                      <p className="text-sm text-green-800">Correct</p>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{stats.wrong}</p>
                      <p className="text-sm text-red-800">Wrong</p>
                    </div>
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{stats.skipped}</p>
                      <p className="text-sm text-yellow-800">Skipped</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${stats.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'wrong' && (
        <div>
          <h2 className="text-2xl font-bold text-red-700 mb-6 flex items-center gap-2">
            <XCircle className="w-6 h-6" />
            Wrong Answers ({wrongAnswers})
          </h2>
          {wrongQuestions.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-700 mb-2">Perfect!</h3>
                <p className="text-gray-600">You didn't get any questions wrong. Great job!</p>
              </CardContent>
            </Card>
          ) : (
            wrongQuestions.map((q, idx) => renderQuestionCard(q, idx, true))
          )}
        </div>
      )}

      {activeTab === 'skipped' && (
        <div>
          <h2 className="text-2xl font-bold text-yellow-700 mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Skipped Questions ({skippedQuestions})
          </h2>
          {skippedQuestionsList.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="p-8 text-center">
                <Target className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-blue-700 mb-2">Well Done!</h3>
                <p className="text-gray-600">You attempted all questions. Great effort!</p>
              </CardContent>
            </Card>
          ) : (
            skippedQuestionsList.map((q, idx) => renderQuestionCard(q, idx, true))
          )}
        </div>
      )}
    </div>
  );
};

export default UserQuizResultPage;
