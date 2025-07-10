'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot
} from 'firebase/firestore';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';

import { Trash2, ArrowLeft, BookOpen, Plus, X, Pencil } from 'lucide-react';

export default function Courses() {
  const router = useRouter();

  const [courses, setCourses] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState({
    name: '',
    description: '',
    subjects: [] as string[],
    chapters: {} as { [subject: string]: { [chapter: string]: string[] } }
  });
  const [subjectInput, setSubjectInput] = useState('');
  const [chapterInput, setChapterInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [editingTopicIndex, setEditingTopicIndex] = useState<number | null>(null);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'courses'), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(fetched);
    });
    return () => unsubscribe();
  }, []);

  const createCourse = async () => {
    if (!newCourse.name.trim()) return;
    await addDoc(collection(db, 'courses'), newCourse);
    resetForm();
  };

  const deleteCourse = async (id: string) => {
    await deleteDoc(doc(db, 'courses', id));
  };

  const resetForm = () => {
    setNewCourse({ name: '', description: '', subjects: [], chapters: {} });
    setSubjectInput('');
    setChapterInput('');
    setTopicInput('');
    setSelectedSubject('');
    setSelectedChapter('');
    setEditingTopicIndex(null);
    setOpen(false);
  };

  const addSubject = () => {
    const trimmed = subjectInput.trim();
    if (trimmed && !newCourse.subjects.includes(trimmed)) {
      setNewCourse(prev => ({
        ...prev,
        subjects: [...prev.subjects, trimmed],
        chapters: { ...prev.chapters, [trimmed]: {} }
      }));
      setSubjectInput('');
    }
  };

  const removeSubject = (subject: string) => {
    setNewCourse(prev => {
      const updatedSubjects = prev.subjects.filter(s => s !== subject);
      const updatedChapters = { ...prev.chapters };
      delete updatedChapters[subject];
      return {
        ...prev,
        subjects: updatedSubjects,
        chapters: updatedChapters
      };
    });
    if (selectedSubject === subject) {
      setSelectedSubject('');
      setSelectedChapter('');
    }
  };

  const addChapter = () => {
    if (!selectedSubject || !chapterInput.trim()) return;

    setNewCourse(prev => {
      const chaptersForSubject = prev.chapters[selectedSubject] || {};
      return {
        ...prev,
        chapters: {
          ...prev.chapters,
          [selectedSubject]: {
            ...chaptersForSubject,
            [chapterInput]: []
          }
        }
      };
    });

    setChapterInput('');
  };

  const removeChapter = (chapter: string) => {
    setNewCourse(prev => {
      const updatedChapters = { ...prev.chapters[selectedSubject] };
      delete updatedChapters[chapter];
      return {
        ...prev,
        chapters: {
          ...prev.chapters,
          [selectedSubject]: updatedChapters
        }
      };
    });
    if (selectedChapter === chapter) setSelectedChapter('');
  };

  const addTopic = () => {
    if (!selectedSubject || !selectedChapter || !topicInput.trim()) return;

    setNewCourse(prev => {
      const currentTopics = prev.chapters[selectedSubject]?.[selectedChapter] || [];
      return {
        ...prev,
        chapters: {
          ...prev.chapters,
          [selectedSubject]: {
            ...prev.chapters[selectedSubject],
            [selectedChapter]: [...currentTopics, topicInput.trim()]
          }
        }
      };
    });

    setTopicInput('');
  };

  const removeTopic = (index: number) => {
    setNewCourse(prev => {
      const updatedTopics = [...(prev.chapters[selectedSubject]?.[selectedChapter] || [])];
      updatedTopics.splice(index, 1);
      return {
        ...prev,
        chapters: {
          ...prev.chapters,
          [selectedSubject]: {
            ...prev.chapters[selectedSubject],
            [selectedChapter]: updatedTopics
          }
        }
      };
    });
  };

  const updateTopic = (index: number, newVal: string) => {
    setNewCourse(prev => {
      const updatedTopics = [...(prev.chapters[selectedSubject]?.[selectedChapter] || [])];
      updatedTopics[index] = newVal;
      return {
        ...prev,
        chapters: {
          ...prev.chapters,
          [selectedSubject]: {
            ...prev.chapters[selectedSubject],
            [selectedChapter]: updatedTopics
          }
        }
      };
    });
  };
return (
  <div className="min-h-screen bg-gray-50">
    {/* Header */}
    <header className="bg-white shadow-sm border-b mb-6">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="h-9 w-9 bg-blue-600 flex items-center justify-center rounded-lg">
            <BookOpen className="text-white h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">Course Management</h1>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Create Course
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Course</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <Label>Course Name</Label>
                <Input value={newCourse.name} onChange={(e) => setNewCourse(prev => ({ ...prev, name: e.target.value }))} />
              </div>

              <div>
                <Label>Description</Label>
                <Input value={newCourse.description} onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))} />
              </div>

              <div>
                <Label>Subjects</Label>
                <div className="flex gap-2 mb-2">
                  <Input value={subjectInput} onChange={(e) => setSubjectInput(e.target.value)} placeholder="Add subject" />
                  <Button onClick={addSubject}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newCourse.subjects.map((subject) => (
                    <Badge
                      key={subject}
                      variant={selectedSubject === subject ? 'default' : 'outline'}
                      onClick={() => setSelectedSubject(subject)}
                      className="cursor-pointer"
                    >
                      {subject}
                      <X className="h-3 w-3 ml-1" onClick={(e) => { e.stopPropagation(); removeSubject(subject); }} />
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedSubject && (
                <div className="space-y-4">
                  <div>
                    <Label>Chapters for {selectedSubject}</Label>
                    <div className="flex gap-2 mb-2">
                      <Input value={chapterInput} onChange={(e) => setChapterInput(e.target.value)} placeholder="Add chapter" />
                      <Button onClick={addChapter}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.keys(newCourse.chapters[selectedSubject] || {}).map(chap => (
                        <Badge
                          key={chap}
                          variant={selectedChapter === chap ? 'default' : 'outline'}
                          onClick={() => setSelectedChapter(chap)}
                          className="cursor-pointer"
                        >
                          {chap}
                          <X className="h-3 w-3 ml-1" onClick={(e) => { e.stopPropagation(); removeChapter(chap); }} />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {selectedChapter && (
                    <div>
                      <Label>Topics for {selectedChapter}</Label>
                      <div className="flex gap-2 mb-2">
                        <Input value={topicInput} onChange={(e) => setTopicInput(e.target.value)} placeholder="Add topic" />
                        <Button onClick={addTopic}>Add</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(newCourse.chapters[selectedSubject]?.[selectedChapter] || []).map((topic, index) => (
                          <div key={index} className="flex items-center gap-2 bg-secondary px-2 py-1 rounded-md">
                            <Input
                              className="w-auto text-sm px-2 py-1 h-7"
                              value={topic}
                              onChange={(e) => updateTopic(index, e.target.value)}
                            />
                            <X className="h-4 w-4 text-red-600 cursor-pointer" onClick={() => removeTopic(index)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={createCourse}>Create Course</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </header>

    {/* Main Content */}
    <main className="max-w-7xl mx-auto px-4 pb-8">
      {courses.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">No courses available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="p-4 shadow-sm bg-white rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Course Title:</p>
                  <h3 className="text-lg font-bold text-gray-900">{course.name}</h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600"
                  onClick={() => deleteCourse(course.id)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>

              <p className="text-sm text-gray-600 mb-2">
                <span className="font-semibold">Description:</span> {course.description}
              </p>

              <div className="space-y-4">
                <p className="font-semibold text-sm text-gray-800">Subjects</p>
                {course.subjects?.map((subject: string) => (
                  <div key={subject} className="ml-2">
                    <p className="text-sm font-medium text-blue-800 mb-1">{subject}</p>
                    {Object.entries(course.chapters?.[subject] || {}).map(([chapter, topics]: any) => (
                      <div key={chapter} className="ml-4 mb-2">
                        <p className="text-sm font-semibold text-gray-700">Chapter: {chapter}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {topics.map((topic: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs px-2 py-1">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  </div>
);

}
