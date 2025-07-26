'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export default function CreateMockQuiz() {
  const router = useRouter();
  const [userCourse, setUserCourse] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [quizConfig, setQuizConfig] = useState({
    title: '',
    course: '',
    subject: '',
    chapter: '',
    totalQuestions: 10,
    duration: 60,
    maxPerSubject: 5,
  });

  useEffect(() => {
    const fetchUserCourse = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUserId(user.uid);
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const course = userSnap.data().course;
            setUserCourse(course);
            setQuizConfig((prev) => ({ ...prev, course }));
          }
        }
      });
    };
    fetchUserCourse();
  }, []);

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!userCourse) return;
      const courseDocs = await getDocs(collection(db, 'courses'));
      const course = courseDocs.docs.find((doc) => doc.data().name === userCourse);
      if (!course) return;
      const { subjectIds } = course.data();
      const subjectList = [];
      for (let id of subjectIds) {
        const subjectSnap = await getDoc(doc(db, 'subjects', id));
        if (subjectSnap.exists()) {
          subjectList.push({ id, name: subjectSnap.data().name });
        }
      }
      setSubjects(subjectList);
    };
    fetchSubjects();
  }, [userCourse]);

  useEffect(() => {
    const fetchChapters = async () => {
      const allChapters = [];
      for (const subject of subjects) {
        const subjectSnap = await getDoc(doc(db, 'subjects', subject.id));
        const data = subjectSnap.data();
        const chapterList = data.chapters ? Object.keys(data.chapters) : [];
        allChapters.push(...chapterList);
      }
      setChapters([...new Set(allChapters)]);
    };

    if (quizConfig.subject === '__all__') fetchChapters();
    else if (quizConfig.subject) {
      const subject = subjects.find((s) => s.name === quizConfig.subject);
      if (subject) {
        getDoc(doc(db, 'subjects', subject.id)).then((subjectSnap) => {
          const data = subjectSnap.data();
          const chapterList = data.chapters ? Object.keys(data.chapters) : [];
          setChapters(chapterList);
        });
      }
    }
  }, [quizConfig.subject, subjects]);

  useEffect(() => {
    const fetchQuestions = async () => {
      const questionDocs = await getDocs(collection(db, 'mock-questions'));
      const filtered = questionDocs.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (q) =>
            (quizConfig.subject === '__all__' || !quizConfig.subject || q.subject === quizConfig.subject) &&
            (quizConfig.chapter === '__all__' || !quizConfig.chapter || q.chapter === quizConfig.chapter)
        );
      setQuestions(filtered);
    };

    if (quizConfig.subject) fetchQuestions();
  }, [quizConfig.subject, quizConfig.chapter]);

  const handleSelectQuestion = (id: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
    );
  };

  const handleSelectAllQuestions = () => {
    setSelectedQuestions(questions.map((q) => q.id));
  };

  const handleDeselectAllQuestions = () => {
    setSelectedQuestions([]);
  };

  const shuffleArray = (array: any[]) => {
    return array.sort(() => Math.random() - 0.5);
  };

  const handleAutoSelect = () => {
    const questionsBySubject: Record<string, any[]> = {};
    questions.forEach((q) => {
      if (!questionsBySubject[q.subject]) questionsBySubject[q.subject] = [];
      questionsBySubject[q.subject].push(q);
    });

    let selected: string[] = [];

    for (const [subject, qList] of Object.entries(questionsBySubject)) {
      const shuffled = shuffleArray(qList);
      selected.push(...shuffled.slice(0, quizConfig.maxPerSubject).map((q) => q.id));
    }

    setSelectedQuestions(selected);
  };

  const handleSubmit = async () => {
    if (!quizConfig.title || !quizConfig.course || selectedQuestions.length === 0) {
      alert('Please fill all required fields and select questions');
      return;
    }

    if (!userId) {
      alert('User not authenticated');
      return;
    }

    const fullSelectedQuestions = questions
      .filter((q) => selectedQuestions.includes(q.id))
      .map((q) => ({
        id: q.id,
        questionText: q.questionText || '',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || '',
        showExplanation: false,
        subject: q.subject || 'Unknown',
      }));

    const quizPayload = {
      ...quizConfig,
      resultVisibility: 'immediate',
      selectedQuestions: fullSelectedQuestions,
      createdAt: Timestamp.now(),
    };

    try {
      await addDoc(collection(db, `users/${userId}/mock-quizzes`), quizPayload);
      alert('Mock quiz created successfully');
      router.push('/admin/mockquize/quizebank');
    } catch (error) {
      console.error('Error creating quiz:', error);
      alert('Failed to create quiz');
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-6">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold text-blue-700 mb-2">Create Your Own Test</h1>
        {userCourse && (
          <Badge className="text-base bg-blue-100 text-blue-700">Course: {userCourse}</Badge>
        )}
      </div>

      <Card className="mb-8 shadow-2xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Quiz Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Input
            placeholder="Quiz Title"
            value={quizConfig.title}
            onChange={(e) => setQuizConfig((prev) => ({ ...prev, title: e.target.value }))}
            className="text-lg"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              value={quizConfig.subject}
              onValueChange={(val) => setQuizConfig((prev) => ({ ...prev, subject: val, chapter: '' }))}
            >
              <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Subjects</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={quizConfig.chapter}
              onValueChange={(val) => setQuizConfig((prev) => ({ ...prev, chapter: val }))}
            >
              <SelectTrigger><SelectValue placeholder="Select Chapter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Chapters</SelectItem>
                {chapters.map((ch) => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700">Duration (min)</label>
              <Input
                type="number"
                min={1}
                value={quizConfig.duration}
                onChange={(e) => setQuizConfig((prev) => ({ ...prev, duration: Number(e.target.value) }))}
                className="text-lg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Max Questions per Subject</label>
              <Input
                type="number"
                min={1}
                value={quizConfig.maxPerSubject}
                onChange={(e) => setQuizConfig((prev) => ({ ...prev, maxPerSubject: Number(e.target.value) }))}
                className="text-lg"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button onClick={handleAutoSelect} variant="outline">Auto Select</Button>
            <Button onClick={handleSelectAllQuestions} variant="outline">Select All</Button>
            <Button onClick={handleDeselectAllQuestions} variant="outline">Deselect All</Button>
          </div>
        </CardContent>
      </Card>

      {quizConfig.subject && (
        <Card className="mb-8 shadow-2xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Select Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 max-h-[450px] overflow-y-auto pr-2">
            {Object.entries(
              questions.reduce((acc, q) => {
                const subject = q.subject || 'Unknown Subject';
                if (!acc[subject]) acc[subject] = [];
                acc[subject].push(q);
                return acc;
              }, {} as Record<string, any[]>)
            ).map(([subjectName, subjectQuestions]) => (
              <div key={subjectName}>
                <h3 className="text-lg font-semibold text-blue-700 mb-3 border-b pb-1">
                  📘 {subjectName}
                </h3>
                <div className="space-y-3">
                  {subjectQuestions.map((q) => (
                    <div key={q.id} className="flex items-start gap-3 p-4 bg-gray-50 border rounded-xl hover:shadow">
                      <Checkbox
                        checked={selectedQuestions.includes(q.id)}
                        onCheckedChange={() => handleSelectQuestion(q.id)}
                      />
                      <div className="text-gray-800 text-base" dangerouslySetInnerHTML={{ __html: q.questionText }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleSubmit}
        size="lg"
        className="w-full py-6 text-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white"
      >
        Create Quiz
      </Button>
    </div>
  );
}
