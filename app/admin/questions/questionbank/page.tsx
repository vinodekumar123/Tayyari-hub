'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  DocumentData,
  QueryDocumentSnapshot,
  updateDoc,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@radix-ui/react-select';
import { Pencil, Trash, Plus, Loader2, Download, Edit2 } from 'lucide-react';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import ReactSelect from 'react-select';

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
  createdAt?: Date;
  tags?: string[];
};

function parseCreatedAt(data: DocumentData): Date {
  if (data.createdAt instanceof Date) return data.createdAt;
  if (data.createdAt?.toDate) return data.createdAt.toDate();
  if (typeof data.createdAt === 'string') return new Date(data.createdAt);
  return new Date();
}

const PAGE_SIZE = 20;

const QuestionBankPage = () => {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  // Filtering
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedChapter, setSelectedChapter] = useState('all');
  const [search, setSearch] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  // Bulk edit UI
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState<'subject' | 'chapter' | 'difficulty' | 'addTag' | 'removeTag'>('subject');
  const [bulkEditSubject, setBulkEditSubject] = useState('all');
  const [bulkEditChapter, setBulkEditChapter] = useState('all');
  const [bulkEditValue, setBulkEditValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Selection
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  // Fetch questions (pagination & filtering)
  const fetchQuestions = async (reset = false) => {
    setLoading(reset);
    setFetchingMore(!reset);
    try {
      let q = collection(db, 'questions');
      let qArr: any[] = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)];
      if (selectedSubject !== 'all') qArr.push(where('subject', '==', selectedSubject));
      if (selectedChapter !== 'all') qArr.push(where('chapter', '==', selectedChapter));
      if (filterDifficulty !== 'all') qArr.push(where('difficulty', '==', filterDifficulty));
      let ref = query(q, ...qArr);
      if (!reset && lastVisible) ref = query(q, ...qArr, startAfter(lastVisible));
      const snapshot = await getDocs(ref);
      const fetched: Question[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Question, 'id'>),
        createdAt: parseCreatedAt(doc.data()),
      }));
      setQuestions(reset ? fetched : prev => [...prev, ...fetched]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.size === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };
  useEffect(() => { fetchQuestions(true); }, [selectedSubject, selectedChapter, filterDifficulty]);

  // Unique lists
  const uniqueSubjects = useMemo(() =>
    Array.from(new Set(questions.map(q => q.subject).filter((s): s is string => !!s)))
  , [questions]);
  const uniqueChapters = useMemo(() => {
    let pool = questions;
    if (bulkEditDialogOpen && bulkEditSubject !== 'all') {
      pool = questions.filter(q => q.subject === bulkEditSubject);
    } else if (selectedSubject !== 'all') {
      pool = questions.filter(q => q.subject === selectedSubject);
    }
    return Array.from(new Set(pool.map(q => q.chapter).filter((c): c is string => !!c)));
  }, [questions, selectedSubject, bulkEditDialogOpen, bulkEditSubject]);
  const uniqueDifficulties = useMemo(() =>
    Array.from(new Set(questions.map(q => q.difficulty).filter((d): d is string => !!d)))
  , [questions]);
  const uniqueYears = useMemo(() =>
    Array.from(new Set(questions.map(q => q.year).filter((y): y is string => !!y)))
  , [questions]);
  const uniqueTags = useMemo(() =>
    Array.from(new Set(questions.flatMap(q => q.tags || []))).map(tag => ({ label: tag, value: tag }))
  , [questions]);

  // Filtering (client-side for search, year, tags)
  const filteredQuestions = useMemo(() => {
    let qlist = [...questions];
    if (search) {
      const s = search.toLowerCase();
      qlist = qlist.filter(q =>
        q.course?.toLowerCase().includes(s) ||
        q.subject?.toLowerCase().includes(s) ||
        q.chapter?.toLowerCase().includes(s) ||
        q.questionText?.toLowerCase().includes(s)
      );
    }
    if (filterYear !== 'all') qlist = qlist.filter(q => q.year === filterYear);
    if (filterTags.length > 0) qlist = qlist.filter(q => q.tags?.some(t => filterTags.includes(t)));
    return qlist;
  }, [questions, search, filterYear, filterTags]);

  // Bulk Edit Handler (with chapter logic)
  const handleBulkEdit = async () => {
    if (selectedQuestions.length === 0) return alert('Select questions to bulk edit.');
    setIsDeleting(true);
    try {
      for (let i = 0; i < selectedQuestions.length; i += 500) {
        const batch = writeBatch(db);
        selectedQuestions.slice(i, i + 500).forEach(id => {
          const qRef = doc(db, 'questions', id);
          if (bulkEditField === 'subject') batch.update(qRef, { subject: bulkEditValue });
          if (bulkEditField === 'difficulty') batch.update(qRef, { difficulty: bulkEditValue });
          if (bulkEditField === 'chapter') {
            batch.update(qRef, { subject: bulkEditSubject, chapter: bulkEditChapter });
          }
          if (bulkEditField === 'addTag') batch.update(qRef, { tags: Array.from(new Set([...(questions.find(q => q.id === id)?.tags || []), bulkEditValue])) });
          if (bulkEditField === 'removeTag') batch.update(qRef, { tags: (questions.find(q => q.id === id)?.tags || []).filter(t => t !== bulkEditValue) });
        });
        await batch.commit();
      }
      setBulkEditDialogOpen(false);
      fetchQuestions(true);
    } catch (e) {
      alert('Bulk edit failed.');
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  // Selection
  const handleSelectQuestion = useCallback((id: string) => {
    setSelectedQuestions(prev =>
      prev.includes(id) ? prev.filter(qid => qid !== id) : [...prev, id]
    );
  }, []);
  const handleSelectAll = () => {
    if (selectedQuestions.length === filteredQuestions.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(filteredQuestions.map(q => q.id));
    }
  };

  // CSV Export
  const exportToCSV = (exportQuestions: Question[], filename: string) => {
    const headers = [
      'questionText', 'options', 'correctAnswer', 'course', 'subject', 'chapter', 'difficulty',
      'explanation', 'topic', 'year', 'book', 'teacher', 'enableExplanation', 'tags',
    ];
    const escape = (text?: string) =>
      `"${(text ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
    const rows = exportQuestions.map((q) =>
      [
        escape(q.questionText),
        escape((q.options || []).join('|')),
        escape(q.correctAnswer),
        escape(q.course),
        escape(q.subject),
        escape(q.chapter),
        escape(q.difficulty),
        escape(q.explanation),
        escape(q.topic),
        escape(q.year),
        escape(q.book),
        escape(q.teacher),
        q.enableExplanation ? 'true' : 'false',
        escape((q.tags || []).join('|')),
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

  return (
    <div className="min-h-screen bg-white rounded-xl p-4 sm:p-6 lg:p-8">
      {/* Filter Bar */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex gap-2 w-full md:w-2/5">
          <Input
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2 w-full md:w-3/5">
          <Select value={selectedSubject} onValueChange={value => { setSelectedSubject(value); setSelectedChapter('all'); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueSubjects.map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled={selectedSubject === 'all'}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Chapter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueChapters.map(chapter => (
                <SelectItem key={chapter} value={chapter}>{chapter}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueDifficulties.map(diff => (
                <SelectItem key={diff} value={diff}>{diff}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {uniqueYears.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div style={{ minWidth: 160 }}>
            <ReactSelect
              isMulti
              options={uniqueTags}
              value={uniqueTags.filter(tag => filterTags.includes(tag.value))}
              onChange={vals => setFilterTags(vals.map(v => v.value))}
              placeholder="Tags"
              classNamePrefix="react-select"
            />
          </div>
        </div>
      </div>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-yellow-600 hover:bg-yellow-700 text-white"
            disabled={selectedQuestions.length === 0}
          >
            <Edit2 className="h-5 w-5 mr-2" />
            Bulk Edit
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Edit Selected Questions</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Select value={bulkEditField} onValueChange={val => setBulkEditField(val as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Edit Field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subject">Subject</SelectItem>
                <SelectItem value="difficulty">Difficulty</SelectItem>
                <SelectItem value="chapter">Chapter</SelectItem>
                <SelectItem value="addTag">Add Tag</SelectItem>
                <SelectItem value="removeTag">Remove Tag</SelectItem>
              </SelectContent>
            </Select>
            {/* Subject and Chapter cascading select for chapter edit */}
            {bulkEditField === 'chapter' && (
              <div className="flex gap-2">
                <Select value={bulkEditSubject} onValueChange={value => { setBulkEditSubject(value); setBulkEditChapter('all'); }}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select Subject</SelectItem>
                    {uniqueSubjects.map(subject => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={bulkEditChapter} onValueChange={setBulkEditChapter} disabled={bulkEditSubject === 'all'}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Select Chapter</SelectItem>
                    {questions.filter(q => q.subject === bulkEditSubject)
                      .map(q => q.chapter)
                      .filter((v, i, arr) => !!v && arr.indexOf(v) === i)
                      .map(chapter => (
                        <SelectItem key={chapter!} value={chapter!}>{chapter}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {/* For other fields */}
            {bulkEditField !== 'chapter' && (
              <Input
                placeholder={`Set ${bulkEditField}`}
                value={bulkEditValue}
                onChange={e => setBulkEditValue(e.target.value)}
                list={bulkEditField === 'addTag' || bulkEditField === 'removeTag' ? 'tag-list' : undefined}
              />
            )}
            <datalist id="tag-list">
              {uniqueTags.map(tag => <option key={tag.value} value={tag.value} />)}
            </datalist>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleBulkEdit}
              disabled={isDeleting || (
                bulkEditField === 'chapter'
                  ? (bulkEditSubject === 'all' || bulkEditChapter === 'all')
                  : !bulkEditValue
              )}
            >
              {isDeleting ? (<Loader2 className="h-5 w-5 mr-2 animate-spin" />) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question List */}
      <div className="mb-4 text-sm font-medium text-gray-700">
        Showing {filteredQuestions.length} of {questions.length} total questions
      </div>
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
      ) : filteredQuestions.length === 0 ? (
        <p className="text-center text-gray-500 text-lg mt-10">No questions found.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Checkbox
              checked={filteredQuestions.length > 0 && selectedQuestions.length === filteredQuestions.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600">
              Select All ({selectedQuestions.length}/{filteredQuestions.length})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {filteredQuestions.map((question, idx) => {
              const {
                id,
                questionText,
                options = [],
                correctAnswer,
                course,
                subject,
                chapter,
                difficulty,
                tags
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
                          <Badge variant="outline" className="border-blue-200 text-gray-700">{subject}</Badge>
                        )}
                        {chapter && (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-700">{chapter}</Badge>
                        )}
                        {difficulty && (
                          <Badge className="bg-green-100 text-green-800">{difficulty}</Badge>
                        )}
                        {tags?.map(tag => (
                          <Badge key={tag} className="bg-yellow-100 text-yellow-900">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 mt-4">
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
                      onClick={() => router.push(`/admin/questions/create?id=${id}`)}
                    >
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="hover:bg-red-700 text-white"
                      onClick={async () => {
                        if (!window.confirm('Are you sure?')) return;
                        await deleteDoc(doc(db, 'questions', id));
                        setQuestions(prev => prev.filter(qq => qq.id !== id));
                      }}
                    >
                      <Trash className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                  {question.createdAt && (
                    <p className="text-sm text-gray-500 mt-1">
                      Created on:{' '}
                      {question.createdAt instanceof Date
                        ? question.createdAt.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : new Date(question.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default QuestionBankPage;
