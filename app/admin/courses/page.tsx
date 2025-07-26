'use client';

import { useEffect, useState } from 'react';
import { db } from '../../firebase';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  updateDoc,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, BookOpen, Plus, Pencil, X } from 'lucide-react';

// TypeScript Interfaces
interface Course {
  id: string;
  name: string;
  description: string;
  subjectIds: string[];
}

interface Subject {
  id: string;
  name: string;
  chapters: { [chapter: string]: string[] };
}

interface CourseFormData {
  name: string;
  description: string;
  subjectIds: string[];
}

interface SubjectFormData {
  name: string;
  chapters: { [chapter: string]: string[] };
}

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newCourse, setNewCourse] = useState<CourseFormData>({
    name: '',
    description: '',
    subjectIds: [],
  });
  const [newSubject, setNewSubject] = useState<SubjectFormData>({
    name: '',
    chapters: {},
  });
  const [chapterInput, setChapterInput] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  const [topicInput, setTopicInput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [openSubjectDialog, setOpenSubjectDialog] = useState<boolean>(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [isLoadingCourses, setIsLoadingCourses] = useState<boolean>(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribeCourses = onSnapshot(collection(db, 'courses'), (snapshot: QuerySnapshot<DocumentData>) => {
      const coursesData: Course[] = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name as string,
        description: doc.data().description as string,
        subjectIds: (doc.data().subjectIds as string[]) || [],
      }));
      setCourses(coursesData);
      setIsLoadingCourses(false);
    }, (error) => {
      setError('Failed to load courses');
      setIsLoadingCourses(false);
    });

    const unsubscribeSubjects = onSnapshot(collection(db, 'subjects'), (snapshot: QuerySnapshot<DocumentData>) => {
      const subjectsData: Subject[] = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name as string,
        chapters: (doc.data().chapters as { [chapter: string]: string[] }) || {},
      }));
      setSubjects(subjectsData);
      setIsLoadingSubjects(false);
    }, (error) => {
      setError('Failed to load subjects');
      setIsLoadingSubjects(false);
    });

    return () => {
      unsubscribeCourses();
      unsubscribeSubjects();
    };
  }, []);

  const checkDuplicateCourse = async (name: string, excludeId: string | null): Promise<boolean> => {
    const q = query(collection(db, 'courses'), where('name', '==', name.trim()));
    return new Promise((resolve) => {
      onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        resolve(snapshot.docs.some(doc => doc.id !== excludeId));
      });
    });
  };

  const checkDuplicateSubject = async (name: string, excludeId: string | null): Promise<boolean> => {
    const q = query(collection(db, 'subjects'), where('name', '==', name.trim()));
    return new Promise((resolve) => {
      onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
        resolve(snapshot.docs.some(doc => doc.id !== excludeId));
      });
    });
  };

  const saveCourse = async () => {
    if (!newCourse.name.trim()) {
      setError('Course name is required');
      return;
    }

    const isDuplicate = await checkDuplicateCourse(newCourse.name, editingCourseId);
    if (isDuplicate) {
      setError('A course with this name already exists');
      return;
    }

    try {
      if (editingCourseId) {
        await updateDoc(doc(db, 'courses', editingCourseId), newCourse);
      } else {
        await addDoc(collection(db, 'courses'), newCourse);
      }
      resetForm();
      setError(null);
    } catch (err) {
      setError('Failed to save course. Please try again.');
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'courses', id));
      setError(null);
    } catch (err) {
      setError('Failed to delete course. Please try again.');
    }
  };

  const handleEditCourse = (course: Course) => {
    setNewCourse({
      name: course.name,
      description: course.description,
      subjectIds: course.subjectIds,
    });
    setEditingCourseId(course.id);
    setOpen(true);
  };

  const resetForm = () => {
    setNewCourse({ name: '', description: '', subjectIds: [] });
    setEditingCourseId(null);
    setOpen(false);
    setError(null);
  };

  const toggleSubject = (id: string) => {
    setNewCourse(prev => {
      const alreadySelected = prev.subjectIds.includes(id);
      return {
        ...prev,
        subjectIds: alreadySelected
          ? prev.subjectIds.filter(sid => sid !== id)
          : [...prev.subjectIds, id],
      };
    });
  };

  const saveSubject = async () => {
    if (!newSubject.name.trim()) {
      setError('Subject name is required');
      return;
    }

    const isDuplicate = await checkDuplicateSubject(newSubject.name, editingSubjectId);
    if (isDuplicate) {
      setError('A subject with this name already exists');
      return;
    }

    try {
      if (editingSubjectId) {
        await updateDoc(doc(db, 'subjects', editingSubjectId), newSubject);
      } else {
        await addDoc(collection(db, 'subjects'), newSubject);
      }
      setNewSubject({ name: '', chapters: {} });
      setChapterInput('');
      setTopicInput('');
      setSelectedChapter('');
      setEditingSubjectId(null);
      setOpenSubjectDialog(false);
      setError(null);
    } catch (err) {
      setError('Failed to save subject. Please try again.');
    }
  };

  const deleteSubject = async (id: string) => {
    try {
      const isUsed = courses.some(course => course.subjectIds.includes(id));
      if (isUsed) {
        setError('Cannot delete subject used in courses');
        return;
      }
      await deleteDoc(doc(db, 'subjects', id));
      setError(null);
    } catch (err) {
      setError('Failed to delete subject. Please try again.');
    }
  };

  const handleEditSubject = (subject: Subject) => {
    setNewSubject({
      name: subject.name,
      chapters: subject.chapters,
    });
    setEditingSubjectId(subject.id);
    setOpenSubjectDialog(true);
  };

  const addChapter = () => {
    const chapter = chapterInput.trim();
    if (!chapter) {
      setError('Chapter name is required');
      return;
    }
    if (newSubject.chapters[chapter]) {
      setError('This chapter already exists in the subject');
      return;
    }
    setNewSubject(prev => ({
      ...prev,
      chapters: { ...prev.chapters, [chapter]: [] },
    }));
    setChapterInput('');
    setError(null);
  };

  const addTopic = () => {
    if (!selectedChapter) {
      setError('Please select a chapter first');
      return;
    }
    if (!topicInput.trim()) {
      setError('Topic name is required');
      return;
    }
    if (newSubject.chapters[selectedChapter].includes(topicInput.trim())) {
      setError('This topic already exists in the chapter');
      return;
    }
    setNewSubject(prev => {
      const updated = [...(prev.chapters[selectedChapter] || []), topicInput.trim()];
      return {
        ...prev,
        chapters: { ...prev.chapters, [selectedChapter]: updated },
      };
    });
    setTopicInput('');
    setError(null);
  };

  const deleteTopic = (chapter: string, topicIndex: number) => {
    setNewSubject(prev => {
      const updated = [...prev.chapters[chapter]];
      updated.splice(topicIndex, 1);
      return {
        ...prev,
        chapters: { ...prev.chapters, [chapter]: updated },
      };
    });
  };

  // Skeleton Loader Component
  const SkeletonCard = () => (
    <Card className="p-6 bg-white shadow-md rounded-xl animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
          <div className="h-6 w-48 bg-gray-200 rounded"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 w-32 bg-gray-200 rounded"></div>
        <div className="h-4 w-full bg-gray-200 rounded"></div>
        <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white shadow-sm">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <BookOpen className="text-white h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Course Management</h1>
          </div>
          <div className="flex gap-3">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 transition-colors">
                  <Plus className="h-4 w-4 mr-2" /> New Course
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl">{editingCourseId ? 'Edit Course' : 'Create Course'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                  {error && (
                    <Alert variant="destructive" className="animate-in fade-in">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Course Name</Label>
                    <Input
                      value={newCourse.name}
                      onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                      className="mt-1"
                      placeholder="Enter course name"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Description</Label>
                    <Input
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                      className="mt-1"
                      placeholder="Enter course description"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Select Subjects</Label>
                    <div className="mt-2 max-h-64 overflow-y-auto space-y-3 rounded-md border p-4 bg-gray-50">
                      {isLoadingSubjects ? (
                        <div className="space-y-2">
                          <div className="h-5 w-full bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-5 w-full bg-gray-200 rounded animate-pulse"></div>
                        </div>
                      ) : subjects.length === 0 ? (
                        <p className="text-sm text-gray-500">No subjects available</p>
                      ) : (
                        subjects.map(subject => (
                          <div key={subject.id} className="flex items-center gap-3">
                            <Checkbox
                              checked={newCourse.subjectIds.includes(subject.id)}
                              onCheckedChange={() => toggleSubject(subject.id)}
                              className="h-5 w-5"
                            />
                            <span className="text-sm text-gray-800">{subject.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={saveCourse}
                      className="bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      {editingCourseId ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={openSubjectDialog} onOpenChange={setOpenSubjectDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-gray-300 hover:bg-gray-100 transition-colors">
                  New Subject
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl">{editingSubjectId ? 'Edit Subject' : 'Create Subject'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5">
                  {error && (
                    <Alert variant="destructive" className="animate-in fade-in">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Subject Name</Label>
                    <Input
                      value={newSubject.name}
                      onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                      className= "mt-1"
                      placeholder="Enter subject name"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Add Chapter</Label>
                    <div className="flex gap-3 mt-1">
                      <Input
                        value={chapterInput}
                        onChange={(e) => setChapterInput(e.target.value)}
                        placeholder="Chapter name"
                        className="flex-1"
                      />
                      <Button onClick={addChapter} className="bg-blue-600 hover:bg-blue-700">
                        Add
                      </Button>
                    </div>
                    <div className="mt-3 space-y-3">
                      {Object.keys(newSubject.chapters).map(chapter => (
                        <div
                          key={chapter}
                          className="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-center">
                            <strong
                              onClick={() => setSelectedChapter(chapter)}
                              className="cursor-pointer text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              {chapter}
                            </strong>
                            <X
                              className="w-5 h-5 text-red-500 cursor-pointer hover:text-red-600 transition-colors"
                              onClick={() => {
                                setNewSubject(prev => {
                                  const updated = { ...prev.chapters };
                                  delete updated[chapter];
                                  return { ...prev, chapters: updated };
                                });
                                if (selectedChapter === chapter) setSelectedChapter('');
                              }}
                            />
                          </div>
                          <div className="mt-2 ml-2 flex flex-wrap gap-2">
                            {(newSubject.chapters[chapter] || []).map((topic, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center"
                              >
                                {topic}
                                <X
                                  className="w-3 h-3 ml-1 inline cursor-pointer text-red-500 hover:text-red-600"
                                  onClick={() => deleteTopic(chapter, idx)}
                                />
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedChapter && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Add Topics to {selectedChapter}</Label>
                      <div className="flex gap-3 mt-1">
                        <Input
                          value={topicInput}
                          onChange={(e) => setTopicInput(e.target.value)}
                          placeholder="Topic name"
                          className="flex-1"
                        />
                        <Button onClick={addTopic} className="bg-blue-600 hover:bg-blue-700">
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button
                      onClick={saveSubject}
                      className="bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      {editingSubjectId ? 'Update' : 'Save'} Subject
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className=" mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-5">Subjects</h2>
          {isLoadingSubjects ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, idx) => (
                <SkeletonCard key={idx} />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No subjects available. Create one to get started.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map(subject => (
                <Card
                  key={subject.id}
                  className="p-6 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{subject.name}</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        onClick={() => handleEditSubject(subject)}
                      >
                        <Pencil className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                        onClick={() => deleteSubject(subject.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  {Object.entries(subject.chapters).map(([chapter, topics]) => (
                    <div key={chapter} className="mt-3">
                      <p className="text-sm font-medium text-gray-700">Chapter: {chapter}</p>
                      <ul className="mt-2 space-y-1">
                        {topics.map((topic, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-center">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                            {topic}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-5">Courses</h2>
        {isLoadingCourses ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No courses available. Create one to get started.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="p-6 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Course</p>
                    <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                      onClick={() => handleEditCourse(course)}
                    >
                      <Pencil className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      onClick={() => deleteCourse(course.id)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  <span className="font-medium">Description:</span> {course.description}
                </p>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Subjects</p>
                  {(course.subjectIds || []).map((sid: string) => {
                    const subj = subjects.find(s => s.id === sid);
                    return (
                      <div key={sid} className="mb-4 ml-2">
                        <p className="text-sm font-semibold text-blue-600">{subj?.name || 'Unknown Subject'}</p>
                        {subj?.chapters && Object.entries(subj.chapters).map(([chapter, topics]) => (
                          <div key={chapter} className="mt-2 ml-3">
                            <p className="text-sm font-medium text-gray-700">Chapter: {chapter}</p>
                            <ul className="mt-1 space-y-1">
                              {topics.map((topic, idx) => (
                                <li key={idx} className="text-sm text-gray-600 flex items-center">
                                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                                  {topic}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}