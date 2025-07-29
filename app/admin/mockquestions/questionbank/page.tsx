'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash, Plus, Loader2, Download, Import } from 'lucide-react';
import { Label } from 'recharts';
const QuestionBankPage = () => {
  const router = useRouter();

  type Question = {
    id: string;
    questionText: string;
    options: string[];
    correctAnswer: string;
    course?: string;
    subject?: string;
    chapter?: string;
    difficulty?: string;
    explanation?: string;
    topic?: string;
    year?: string;
    book?: string;
    teacher?: string;
    enableExplanation?: boolean;
  };

  const [questions, setQuestions] = useState<Question[]>([]);
  const [filtered, setFiltered] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'subject' | 'all'>('selected');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'mock-questions'));
        const fetched: Question[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Question, 'id'>),
        }));
        setQuestions(fetched);
        setFiltered(fetched);
      } catch (error) {
        console.error('Error fetching questions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keyword = e.target.value.toLowerCase();
    setSearch(keyword);
    const filtered = questions.filter(
      (q) =>
        q.course?.toLowerCase().includes(keyword) ||
        q.subject?.toLowerCase().includes(keyword) ||
        q.chapter?.toLowerCase().includes(keyword)
    );
    setFiltered(filtered);
    setSelectedQuestions([]);
  };

  const handleSelectQuestion = (id: string) => {
    setSelectedQuestions((prev) =>
      prev.includes(id) ? prev.filter((qid) => qid !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedQuestions.length === filtered.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(filtered.map((q) => q.id));
    }
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to delete this question?');
    if (!confirm) return;

    try {
      await deleteDoc(doc(db, 'mock-questions', id));
      const updated = questions.filter((q) => q.id !== id);
      setQuestions(updated);
      setFiltered(updated);
      setSelectedQuestions((prev) => prev.filter((qid) => qid !== id));
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (deleteMode === 'selected' && selectedQuestions.length === 0) {
      alert('Please select at least one question to delete.');
      return;
    }

    const confirm = window.confirm(
      `Are you sure you want to delete ${
        deleteMode === 'selected'
          ? `${selectedQuestions.length} selected question(s)`
          : deleteMode === 'subject'
          ? `all questions for subject "${selectedSubject}"`
          : 'all questions'
      }? This action cannot be undone.`
    );
    if (!confirm) return;

    setIsDeleting(true);
    try {
      if (deleteMode === 'selected') {
        for (const id of selectedQuestions) {
          await deleteDoc(doc(db, 'mock-questions', id));
        }
        const updated = questions.filter((q) => !selectedQuestions.includes(q.id));
        setQuestions(updated);
        setFiltered(updated);
        setSelectedQuestions([]);
      } else if (deleteMode === 'subject') {
        const q = query(collection(db, 'mock-questions'), where('subject', '==', selectedSubject));
        const snapshot = await getDocs(q);
        for (const doc of snapshot.docs) {
          await deleteDoc(doc.ref);
        }
        const updated = questions.filter((q) => q.subject !== selectedSubject);
        setQuestions(updated);
        setFiltered(updated);
        setSelectedQuestions([]);
      } else if (deleteMode === 'all') {
        const snapshot = await getDocs(collection(db, 'mock-questions'));
        for (const doc of snapshot.docs) {
          await deleteDoc(doc.ref);
        }
        setQuestions([]);
        setFiltered([]);
        setSelectedQuestions([]);
      }
      setIsBulkDeleteDialogOpen(false);
      setSelectedSubject('');
    } catch (error) {
      console.error('Error during bulk delete:', error);
      alert('Failed to delete questions.');
    } finally {
      setIsDeleting(false);
    }
  };

  const exportToCSV = (exportQuestions: Question[], filename: string) => {
    const headers = [
      'questionText',
      'options',
      'correctAnswer',
      'course',
      'subject',
      'chapter',
      'difficulty',
      'explanation',
      'topic',
      'year',
      'book',
      'teacher',
      'enableExplanation',
    ];
    const rows = exportQuestions.map((q) =>
      [
        `"${q.questionText.replace(/"/g, '""')}"`,
        `"${q.options.map((opt) => opt.replace(/"/g, '""')).join('|')}"`,
        `"${q.correctAnswer?.replace(/"/g, '""') || ''}"`,
        `"${q.course?.replace(/"/g, '""') || ''}"`,
        `"${q.subject?.replace(/"/g, '""') || ''}"`,
        `"${q.chapter?.replace(/"/g, '""') || ''}"`,
        `"${q.difficulty?.replace(/"/g, '""') || ''}"`,
        `"${q.explanation?.replace(/"/g, '""') || ''}"`,
        `"${q.topic?.replace(/"/g, '""') || ''}"`,
        `"${q.year?.replace(/"/g, '""') || ''}"`,
        `"${q.book?.replace(/"/g, '""') || ''}"`,
        `"${q.teacher?.replace(/"/g, '""') || ''}"`,
        q.enableExplanation ? 'true' : 'false',
      ].join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = (mode: 'all' | 'subject', subject?: string) => {
    const exportQuestions =
      mode === 'all' ? questions : questions.filter((q) => q.subject === subject);
    const filename =
      mode === 'all'
        ? 'all_mock_questions.csv'
        : `mock_questions_${subject?.replace(/\s+/g, '_').toLowerCase()}.csv`;
    exportToCSV(exportQuestions, filename);
  };

  const uniqueSubjects = Array.from(new Set(questions.map((q) => q.subject).filter((s): s is string => !!s)));

  return (
    <div className="min-h-screen bg-white rounded-xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            📘 Question Bank
          </h1>
          <span className="text-sm sm:text-base text-gray-600">
            (Total Questions: {questions.length})
          </span>
        </div>
        <div className="flex gap-3">
          <Button
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            onClick={() => router.push('/admin/mockquestions/create')}
          >
            <Plus className="h-5 w-5 mr-2" />
            New Question
          </Button>
          <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full sm:w-auto hover:bg-red-700 text-white"
              >
                <Trash className="h-5 w-5 mr-2" />
                Bulk Delete
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Bulk Delete Questions</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Delete Mode</Label>
                  <Select value={deleteMode} onValueChange={(val) => setDeleteMode(val as 'selected' | 'subject' | 'all')}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select delete mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="selected">Selected Questions</SelectItem>
                      <SelectItem value="subject">By Subject</SelectItem>
                      <SelectItem value="all">All Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {deleteMode === 'subject' && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Subject</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueSubjects.map((subject) => (
                          <SelectItem key={subject} value={subject}>
                            {subject}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {deleteMode === 'selected' && (
                  <p className="text-sm text-gray-600">
                    {selectedQuestions.length} question(s) selected
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsBulkDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isDeleting || (deleteMode === 'selected' && selectedQuestions.length === 0) || (deleteMode === 'subject' && !selectedSubject)}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                <Download className="h-5 w-5 mr-2" />
                Export CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">Export Questions to CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Export Mode</Label>
                  <Select
                    defaultValue="all"
                    onValueChange={(val) =>
                      val === 'all'
                        ? handleExportCSV('all')
                        : setSelectedSubject('')
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select export mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Questions</SelectItem>
                      <SelectItem value="subject">By Subject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Subject</Label>
                  <Select
                    value={selectedSubject}
                    onValueChange={(val) => {
                      setSelectedSubject(val);
                      if (val) handleExportCSV('subject', val);
                    }}
                    disabled={questions.length === 0}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueSubjects.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubject('')}
                >
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-full sm:max-w-xl">
        <Input
          placeholder="Search by course, subject, or chapter..."
          value={search}
          onChange={handleSearch}
          className="w-full py-6 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse bg-white shadow-md">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="h-6 bg-gray-100 rounded"></div>
                <div className="h-6 bg-gray-100 rounded"></div>
              </div>
              <div className="flex justify-end gap-2">
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-lg mt-10">No questions found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              checked={selectedQuestions.length === filtered.length && filtered.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600">
              Select All ({selectedQuestions.length}/{filtered.length})
            </span>
          </div>
          {filtered.map((question, idx) => {
            const {
              id,
              questionText,
              options = [],
              correctAnswer,
              course,
              subject,
              chapter,
              difficulty,
            } = question;

            return (
              <Card
                key={id}
                className="p-4 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl"
              >
                <div className="flex items-start gap-3 mb-4">
                  <Checkbox
                    checked={selectedQuestions.includes(id)}
                    onCheckedChange={() => handleSelectQuestion(id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-start gap-1">
                      {idx + 1}.{' '}
                      <span
                        className="prose max-w-prose inline"
                        dangerouslySetInnerHTML={{ __html: questionText }}
                      />
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {course && <Badge className="bg-blue-100 text-blue-800">{course}</Badge>}
                      {subject && (
                        <Badge variant="outline" className="border-blue-200 text-gray-700">
                          {subject}
                        </Badge>
                      )}
                      {chapter && (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                          {chapter}
                        </Badge>
                      )}
                      {difficulty && (
                        <Badge className="bg-green-100 text-green-800">{difficulty}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 mb-4">
                  {options.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-md border text-sm ${
                        opt === correctAnswer
                          ? 'bg-green-100 border-green-400 text-green-900'
                          : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300 hover:bg-gray-100 text-gray-700"
                    onClick={() => router.push(`/admin/mockquestions/create?id=${id}`)}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="hover:bg-red-700 text-white"
                    onClick={() => handleDelete(id)}
                  >
                    <Trash className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestionBankPage;