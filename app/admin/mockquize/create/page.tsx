'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  Timestamp,
  query,
  orderBy,
  where,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'; // Assuming you have a RadioGroup component

// Helper to format date
const formatDate = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
};

export default function CreateMockQuiz() {
  const router = useRouter();
  const [userCourse, setUserCourse] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<any[]>([]);
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

  // For date filtering
  const [dateFilter, setDateFilter] = useState<string>(''); // ISO string
  const [dateOptions, setDateOptions] = useState<string[]>([]); // Available dates in questions

  // Memoized counts for UX
  const subjectQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) => {
      counts[q.subject] = (counts[q.subject] || 0) + 1;
    });
    return counts;
  }, [questions]);

  const chapterQuestionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach((q) => {
      counts[q.chapter] = (counts[q.chapter] || 0) + 1;
    });
    return counts;
  }, [questions]);

  // --- Fetch user and course ---
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

  // --- Fetch Subjects ---
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

  // --- Fetch Chapters ---
  useEffect(() => {
    const fetchChapters = async () => {
      const allChapters: string[] = [];
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

  // --- Fetch Questions (optimized and with date info) ---
  useEffect(() => {
    const fetchQuestions = async () => {
      let q = collection(db, 'mock-questions');
      let questionQuery = query(q, orderBy('createdAt', 'desc'));
      const questionDocs = await getDocs(questionQuery);
      const filtered = questionDocs.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt ? d.data().createdAt : null,
        }))
        .filter(
          (q) =>
            (quizConfig.subject === '__all__' || !quizConfig.subject || q.subject === quizConfig.subject) &&
            (quizConfig.chapter === '__all__' || !quizConfig.chapter || q.chapter === quizConfig.chapter)
        );
      setQuestions(filtered);

      // Update available dates for filter dropdown (unique, descending)
      const dates = [
        ...new Set(
          filtered
            .map((q) =>
              q.createdAt
                ? (q.createdAt instanceof Timestamp
                    ? q.createdAt.toDate().toISOString().slice(0, 10)
                    : new Date(q.createdAt).toISOString().slice(0, 10))
                : null
            )
            .filter(Boolean)
        ),
      ].sort((a, b) => (a < b ? 1 : -1));
      setDateOptions(dates);
    };

    if (quizConfig.subject) fetchQuestions();
  }, [quizConfig.subject, quizConfig.chapter]);

  // --- Apply date filter on questions ---
  useEffect(() => {
    if (!dateFilter) setFilteredQuestions(questions);
    else {
      setFilteredQuestions(
        questions.filter((q) => {
          if (!q.createdAt) return false;
          const d = q.createdAt instanceof Timestamp
            ? q.createdAt.toDate().toISOString().slice(0, 10)
            : new Date(q.createdAt).toISOString().slice(0, 10);
          return d === dateFilter;
        })
      );
    }
  }, [questions, dateFilter]);

  // --- Select/Deselect Logic ---
  const handleSelectQuestion = (id: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((q) => q !== id) : [...prev, id]
    );
  };

  const handleSelectAllQuestions = () => {
    setSelectedQuestions(filteredQuestions.map((q) => q.id));
  };

  const handleDeselectAllQuestions = () => {
    setSelectedQuestions([]);
  };

  // --- Auto Select: pick top N (maxPerSubject) most recent questions per subject ---
  const handleAutoSelect = () => {
    const questionsBySubject: Record<string, any[]> = {};
    filteredQuestions.forEach((q) => {
      if (!questionsBySubject[q.subject]) questionsBySubject[q.subject] = [];
      questionsBySubject[q.subject].push(q);
    });

    let selected: string[] = [];

    for (const [subject, qList] of Object.entries(questionsBySubject)) {
      // Already sorted by createdAt desc
      selected.push(...qList.slice(0, quizConfig.maxPerSubject).map((q) => q.id));
    }
    setSelectedQuestions(selected);
  };

  // --- Submit Quiz ---
  const handleSubmit = async () => {
    if (!quizConfig.title || !quizConfig.course || selectedQuestions.length === 0) {
      alert('Please fill all required fields and select questions');
      return;
    }

    if (!userId) {
      alert('User not authenticated');
      return;
    }

    const fullSelectedQuestions = filteredQuestions
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
          <Badge className="text-base bg-blue-100 text-blue-700">
            Course: {userCourse}
          </Badge>
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
              <SelectTrigger>
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  All Subjects
                  <span className="ml-2 text-xs text-gray-500">
                    ({questions.length})
                  </span>
                </SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                    <span className="ml-2 text-xs text-gray-500">
                      ({subjectQuestionCounts[s.name] || 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={quizConfig.chapter}
              onValueChange={(val) => setQuizConfig((prev) => ({ ...prev, chapter: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Chapter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">
                  All Chapters
                  <span className="ml-2 text-xs text-gray-500">
                    ({questions.length})
                  </span>
                </SelectItem>
                {chapters.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                    <span className="ml-2 text-xs text-gray-500">
                      ({chapterQuestionCounts[ch] || 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by Created Date</label>
            <Select
              value={dateFilter}
              onValueChange={setDateFilter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  All Dates
                  <span className="ml-2 text-xs text-gray-500">
                    ({questions.length})
                  </span>
                </SelectItem>
                {dateOptions.map((date) => (
                  <SelectItem key={date} value={date}>
                    {date}
                    <span className="ml-2 text-xs text-gray-500">
                      ({questions.filter(q => {
                        const d = q.createdAt instanceof Timestamp
                          ? q.createdAt.toDate().toISOString().slice(0, 10)
                          : new Date(q.createdAt).toISOString().slice(0, 10);
                        return d === date;
                      }).length})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-500">Questions: {filteredQuestions.length}</span>
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
              <label className="text-sm font-medium text-gray-700">
                Max Questions per Subject
              </label>
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
            <Button onClick={handleAutoSelect} variant="outline">Auto Select (Top recent)</Button>
            <Button onClick={handleSelectAllQuestions} variant="outline">Select All</Button>
            <Button onClick={handleDeselectAllQuestions} variant="outline">Deselect All</Button>
          </div>
        </CardContent>
      </Card>

      {quizConfig.subject && (
        <Card className="mb-8 shadow-2xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl">
              Select Questions ({filteredQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 max-h-[450px] overflow-y-auto pr-2">
            {Object.entries(
              filteredQuestions.reduce((acc, q) => {
                const subject = q.subject || 'Unknown Subject';
                if (!acc[subject]) acc[subject] = [];
                acc[subject].push(q);
                return acc;
              }, {} as Record<string, any[]>)
            ).map(([subjectName, subjectQuestions]) => (
              <div key={subjectName}>
                <h3 className="text-lg font-semibold text-blue-700 mb-3 border-b pb-1">
                  📘 {subjectName} <span className="text-xs text-gray-400">({subjectQuestions.length})</span>
                </h3>
                <div className="space-y-3">
                  {/* RadioGroup for large radios: allow single or multiple depending on UX, here we use checkbox for multi-select */}
                  {subjectQuestions.map((q) => (
                    <div key={q.id} className="flex items-start gap-3 p-4 bg-gray-50 border rounded-xl hover:shadow">
                      <Checkbox
                        checked={selectedQuestions.includes(q.id)}
                        onCheckedChange={() => handleSelectQuestion(q.id)}
                        className="!w-7 !h-7 mt-1 border-2 border-blue-500"
                      />
                      <div className="flex-1">
                        <div
                          className="text-gray-800 text-base"
                          dangerouslySetInnerHTML={{ __html: q.questionText }}
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          Created: {q.createdAt ? formatDate(q.createdAt) : 'N/A'}
                        </div>
                      </div>
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
