"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc, setDoc, getDocs, where, query } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth } from '../../firebase';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, CheckCircle, XCircle, Circle, ArrowLeft, Flag, Lock, Bookmark } from 'lucide-react';
import Confetti from 'react-confetti';
import useWindowSize from 'react-use/lib/useWindowSize';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import RichTextEditor from '@/components/RichTextEditor';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  graceMark?: boolean;
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
}

interface QuizData {
  title: string;
  selectedQuestions: Question[];
}

const ResultPageContent: React.FC = () => {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id');
  const [user, setUser] = useState<User | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const { width, height } = useWindowSize();
  const router = useRouter();

  // Report State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedQuestionForReport, setSelectedQuestionForReport] = useState<Question | null>(null);
  const [reportIssue, setReportIssue] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  // Enrollment / Upgrade State
  const [hasPaidEnrollment, setHasPaidEnrollment] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [enrollmentCheckDone, setEnrollmentCheckDone] = useState(false);

  // Fetch Enrollment Status
  useEffect(() => {
    if (!user) return;
    const checkEnrollments = async () => {
      try {
        const q = query(
          collection(db, 'enrollments'),
          where('studentId', '==', user.uid),
          where('status', '==', 'active')
        );
        const snapshot = await getDocs(q);
        // Check if ANY active enrollment has price > 0
        const isPaidUser = snapshot.docs.some(doc => {
          const data = doc.data();
          return data.price > 0;
        });

        // Also check if user is admin (implicitly allowed)
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const isAdmin = userDoc.exists() && (userDoc.data().admin === true || userDoc.data().superadmin === true);

        setHasPaidEnrollment(isPaidUser || isAdmin);
      } catch (error) {
        console.error("Error checking enrollments:", error);
      } finally {
        setEnrollmentCheckDone(true);
      }
    };
    checkEnrollments();
  }, [user]);

  useEffect(() => {
    onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!quizId || !user) return;

    const load = async () => {
      const quizSnap = await getDoc(doc(db, 'quizzes', quizId));
      const attemptSnap = await getDoc(doc(db, 'users', user.uid, 'quizAttempts', quizId));

      if (!quizSnap.exists() || !attemptSnap.exists()) return;

      const quizData = quizSnap.data();
      const attemptData = attemptSnap.data();

      const questions: Question[] = quizData.selectedQuestions || [];
      const answers: Record<string, string> = attemptData.answers || {};

      setQuiz({
        title: quizData.title || 'Untitled Quiz',
        selectedQuestions: questions
      });
      setUserAnswers(answers);

      const correct = questions.filter(q => q.graceMark || answers[q.id] === q.correctAnswer).length;
      const wrong = questions.length - correct;

      setScore(correct);
      setCorrectCount(correct);
      setWrongCount(wrong);

      await setDoc(doc(db, 'users', user.uid, 'results', quizId), {
        score: correct,
        total: questions.length,
        timestamp: new Date(),
        answers
      });
    };

    load();
  }, [quizId, user]);

  const openReportModal = (q: Question) => {
    if (!enrollmentCheckDone) {
      toast.info("Checking permission...");
      return;
    }

    if (!hasPaidEnrollment) {
      setUpgradeDialogOpen(true);
      return;
    }

    setSelectedQuestionForReport(q);
    setReportIssue('');
    setReportModalOpen(true);
  };

  const handleReportSubmit = async () => {
    if (!selectedQuestionForReport || !user || !quizId || !reportIssue.trim()) return;
    setIsReporting(true);
    try {
      // Fetch fresh question data to ensure we have subject, options, etc.
      let questionData = { ...selectedQuestionForReport };
      try {
        const freshSnap = await getDoc(doc(db, 'questions', selectedQuestionForReport.id));
        if (freshSnap.exists()) {
          const fresh = freshSnap.data() as Question;
          // Merge fresh data, prioritizing fresh data but keeping ID/context
          questionData = {
            ...selectedQuestionForReport,
            ...fresh,
            id: selectedQuestionForReport.id
          };
        }
      } catch (err) {
        console.warn("Could not fetch fresh question data, using quiz snapshot:", err);
      }

      // Save FULL details for robust reporting
      await addDoc(collection(db, 'reported_questions'), {
        quizId,
        questionId: questionData.id,
        questionText: questionData.questionText,
        options: Array.isArray(questionData.options) ? questionData.options : [],
        correctAnswer: questionData.correctAnswer || '',
        subject: questionData.subject || 'Uncategorized', // Default if missing
        topic: questionData.topic || '',
        difficulty: questionData.difficulty || '',

        studentId: user.uid,
        studentName: user.displayName || user.email || 'Student',
        issue: reportIssue,
        status: 'pending',
        createdAt: new Date(),
        type: 'quiz_result_report'
      });
      toast.success("Report Submitted", { description: "Admins will review this question." });
      setReportModalOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit report");
    } finally {
      setIsReporting(false);
    }
  };

  const handleSaveToFlashcards = async (question: Question) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'flashcards', question.id), {
        ...question,
        savedAt: serverTimestamp(),
        isDeleted: false
      });
      toast.success("Saved to Flashcards");
    } catch (error) {
      console.error("Error saving flashcard:", error);
      toast.error("Failed to save flashcard");
    }
  };


  if (!quiz) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  const total = quiz.selectedQuestions.length;
  const percentage = (score / total) * 100;
  let remark = '';
  if (percentage >= 90) remark = 'Excellent Work! 🌟';
  else if (percentage >= 70) remark = 'Good Job! 👍';
  else if (percentage >= 50) remark = 'Keep Practicing! 📚';
  else remark = 'Don\'t Give Up! 💪';

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans select-none">
      {percentage >= 70 && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => {
              setTimeout(() => {
                router.push('/dashboard/student');
              }, 300);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <Card className="mb-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-extrabold text-gray-800">{quiz.title} - Result</CardTitle>
          </CardHeader>
          <CardContent className="text-xl space-y-2">
            <p>✅ Score: <span className="font-bold text-green-600">{score}</span> / {total}</p>
            <p>✔️ Correct: <span className="text-green-700">{correctCount}</span></p>
            <p>❌ Wrong: <span className="text-red-600">{wrongCount}</span></p>
            <p className="font-semibold text-lg">{remark}</p>
            <Badge className={`text-white text-sm px-3 py-1 rounded-full ${percentage >= 90
              ? 'bg-green-600'
              : percentage >= 70
                ? 'bg-yellow-500'
                : 'bg-red-500'
              }`}>
              {percentage.toFixed(2)}%
            </Badge>

            {/* Grace Mark Disclaimer */}
            {quiz.selectedQuestions.some(q => q.graceMark) && (
              <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded-lg text-sm flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Grace marks were awarded for questions with no correct option ensuring fair scoring.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Dialog */}
        <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report Question Issue</DialogTitle>
              <DialogDescription>
                Describe the issue with this question (e.g. wrong answer, typo, check failed).
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-600 italic">
                {selectedQuestionForReport && (
                  <div dangerouslySetInnerHTML={{ __html: selectedQuestionForReport.questionText }} />
                )}
              </div>
              <div className="mb-4">
                <RichTextEditor
                  value={reportIssue}
                  onChange={setReportIssue}
                  placeholder="Describe the mistake... (You can paste images or use the toolbar)"
                  className="min-h-[200px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportModalOpen(false)}>Cancel</Button>
              <Button onClick={handleReportSubmit} disabled={isReporting}>
                {isReporting ? 'Submitting...' : 'Submit Report'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upgrade Required Dialog */}
        <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-600">
                <Lock className="w-5 h-5" /> Feature Locked
              </DialogTitle>
              <DialogDescription className="text-base pt-2">
                Reporting questions is a premium feature available only to paid users.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center">
              <p className="text-gray-600 mb-4">
                Please enroll in any <strong>Paid Series</strong> to unlock question reporting and other premium benefits.
              </p>
            </div>
            <DialogFooter className="sm:justify-center">
              <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>Close</Button>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white" onClick={() => router.push('/dashboard/student')}>
                Explore Paid Series
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {quiz.selectedQuestions.map((q, idx) => {
          const userAnswer = userAnswers[q.id];
          const isCorrect = userAnswer === q.correctAnswer;

          return (
            <Card key={q.id} className="mb-6 shadow-md border border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  <div className="flex justify-between">
                    <span>Question {idx + 1}</span>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => openReportModal(q)}>
                      <Flag className="w-4 h-4 mr-1" /> Report Issue
                    </Button>
                    <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => handleSaveToFlashcards(q)}>
                      <Bookmark className="w-4 h-4 mr-1" /> Save
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 text-lg font-medium text-gray-800" dangerouslySetInnerHTML={{ __html: q.questionText }} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.options.map((opt, i) => {
                    const isSelected = userAnswer === opt;
                    const isAnswer = q.correctAnswer === opt;
                    let optionClass = "p-3 rounded-lg border text-base ";

                    if (q.graceMark) {
                      optionClass += "bg-yellow-100 border-yellow-300 text-yellow-800";
                    } else if (isAnswer) {
                      optionClass += "bg-green-100 border-green-300 text-green-800 font-bold shadow-sm";
                    } else if (isSelected && !isAnswer) {
                      optionClass += "bg-red-100 border-red-300 text-red-800";
                    } else {
                      optionClass += "bg-gray-50 border-gray-200 text-gray-600";
                    }

                    return (
                      <div key={i} className={optionClass}>
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0">
                            {isAnswer ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                              isSelected ? <XCircle className="w-5 h-5 text-red-600" /> :
                                <Circle className="w-5 h-5 text-gray-400" />}
                          </div>
                          <span>{opt}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Explanation:</p>
                  <div className="mt-1 text-gray-700 bg-blue-50/50 p-3 rounded-md" dangerouslySetInnerHTML={{ __html: q.explanation || 'No explanation provided.' }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default ResultPageContent;
