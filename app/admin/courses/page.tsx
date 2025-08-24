'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/app/firebase';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit, Trash, Plus, BookOpen, Layers, Info } from 'lucide-react';

// Confirm dialog
function ConfirmDialog({ open, onConfirm, onCancel, message }: { open: boolean, onConfirm: () => void, onCancel: () => void, message: string }) {
  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.8 }}
      >
        <div className="flex flex-col items-center">
          <Trash className="w-10 h-10 text-red-500 mb-2" />
          <h2 className="text-lg font-bold mb-2 text-gray-800">Confirm Delete</h2>
          <p className="mb-6 text-gray-600">{message}</p>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          <button
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition font-semibold"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Page() {
  // STATE
  const [courses, setCourses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [newCourse, setNewCourse] = useState({ name: '', description: '', selectedSubjectIds: [] as string[] });
  const [newSubject, setNewSubject] = useState({ name: '', chapters: [] as string[] });
  const [editCourse, setEditCourse] = useState<any | null>(null);
  const [editSubject, setEditSubject] = useState<any | null>(null);
  const [chapterInput, setChapterInput] = useState<{ [subjectId: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // Confirm Dialog State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // Confirm Handler
  const confirm = (msg: string, action: () => void) => {
    setConfirmMsg(msg);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  // Fetch Subjects
  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      const subjectList = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSubjects(subjectList);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Courses
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const courseList: any[] = await Promise.all(
        coursesSnap.docs.map(async (docSnap) => {
          const courseData = docSnap.data();
          courseData.id = docSnap.id;
          courseData.subjects = [];
          if (courseData.subjectIds?.length) {
            const subjectPromises = courseData.subjectIds.map(async (subId: string) => {
              const subRef = doc(db, 'subjects', subId);
              const subSnap = await getDoc(subRef);
              return subSnap.exists() ? { id: subSnap.id, ...subSnap.data() } : null;
            });
            courseData.subjects = (await Promise.all(subjectPromises)).filter(Boolean);
          }
          return courseData;
        })
      );
      setCourses(courseList);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // CRUD Subject
  const createSubject = async () => {
    if (!newSubject.name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'subjects'), {
        name: newSubject.name,
        chapters: newSubject.chapters.reduce((acc, ch) => ({ ...acc, [ch]: true }), {})
      });
      setNewSubject({ name: '', chapters: [] });
      setShowSubjectModal(false);
      await fetchSubjects();
    } catch (error) {
      console.error('Error creating subject:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSubject = async () => {
    if (!editSubject?.name.trim()) return;
    setLoading(true);
    try {
      const subRef = doc(db, 'subjects', editSubject.id);
      await updateDoc(subRef, {
        name: editSubject.name,
        chapters: editSubject.chapters.reduce((acc: any, ch: string) => ({ ...acc, [ch]: true }), {})
      });
      setEditSubject(null);
      setShowSubjectModal(false);
      await fetchSubjects();
      await fetchCourses();
    } catch (error) {
      console.error('Error updating subject:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteSubject = async (subjectId: string) => {
    setLoading(true);
    try {
      // Remove subject from all courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      await Promise.all(
        coursesSnap.docs.map(async (courseDoc) => {
          if (courseDoc.data().subjectIds?.includes(subjectId)) {
            await updateDoc(doc(db, 'courses', courseDoc.id), {
              subjectIds: arrayRemove(subjectId)
            });
          }
        })
      );
      await deleteDoc(doc(db, 'subjects', subjectId));
      await fetchSubjects();
      await fetchCourses();
    } catch (error) {
      console.error('Error deleting subject:', error);
    } finally {
      setLoading(false);
    }
  };

  // CRUD Course
  const createCourse = async () => {
    if (!newCourse.name.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'courses'), {
        name: newCourse.name,
        description: newCourse.description,
        subjectIds: newCourse.selectedSubjectIds
      });
      setNewCourse({ name: '', description: '', selectedSubjectIds: [] });
      setShowCourseModal(false);
      await fetchCourses();
    } catch (error) {
      console.error('Error creating course:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCourse = async () => {
    if (!editCourse?.name.trim()) return;
    setLoading(true);
    try {
      const courseRef = doc(db, 'courses', editCourse.id);
      await updateDoc(courseRef, {
        name: editCourse.name,
        description: editCourse.description,
        subjectIds: editCourse.selectedSubjectIds
      });
      setEditCourse(null);
      setShowCourseModal(false);
      await fetchCourses();
    } catch (error) {
      console.error('Error updating course:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCourse = async (courseId: string) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      await fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chapter
  const addChapter = async (subjectId: string, chapterName: string) => {
    if (!chapterName.trim()) return;
    setLoading(true);
    try {
      const subRef = doc(db, 'subjects', subjectId);
      const subSnap = await getDoc(subRef);
      if (!subSnap.exists()) return;

      const subject = subSnap.data();
      await updateDoc(subRef, {
        chapters: {
          ...subject.chapters,
          [chapterName]: true
        }
      });
      setChapterInput((prev) => ({ ...prev, [subjectId]: '' }));
      await fetchCourses();
      await fetchSubjects();
    } catch (error) {
      console.error('Error adding chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChapter = async (subjectId: string, chapterName: string) => {
    setLoading(true);
    try {
      const subRef = doc(db, 'subjects', subjectId);
      const subSnap = await getDoc(subRef);
      if (!subSnap.exists()) return;

      const subject = subSnap.data();
      const updatedChapters = { ...subject.chapters };
      delete updatedChapters[chapterName];
      await updateDoc(subRef, { chapters: updatedChapters });
      await fetchCourses();
      await fetchSubjects();
    } catch (error) {
      console.error('Error deleting chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchSubjects();
  }, [fetchCourses, fetchSubjects]);

  // Main UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100 p-6">
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center gap-4">
          <Layers className="w-10 h-10 text-blue-600" />
          <motion.h1
            className="text-4xl font-black text-blue-900 tracking-tight"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Course Management
          </motion.h1>
        </div>
        <div className="flex space-x-3">
          <button
            className="bg-green-600 text-white px-5 py-2 rounded-xl shadow hover:bg-green-700 transition flex items-center gap-2 font-bold"
            onClick={() => {
              setNewSubject({ name: '', chapters: [] });
              setEditSubject(null);
              setShowSubjectModal(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add Subject
          </button>
          <button
            className="bg-blue-600 text-white px-5 py-2 rounded-xl shadow hover:bg-blue-700 transition flex items-center gap-2 font-bold"
            onClick={() => {
              setNewCourse({ name: '', description: '', selectedSubjectIds: [] });
              setEditCourse(null);
              setShowCourseModal(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add Course
          </button>
        </div>
      </motion.div>

      {/* SUBJECTS */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <h2 className="text-2xl font-bold text-blue-800 mb-4 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" /> Subjects
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {subjects.map((sub) => (
              <motion.div
                key={sub.id}
                className="bg-white rounded-2xl shadow-xl p-6 flex flex-col justify-between border border-blue-100 hover:shadow-2xl transition"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.4 }}
              >
                <div>
                  <strong className="block text-xl font-bold text-blue-900 mb-1">{sub.name}</strong>
                  <ul className="ml-2 mt-3 space-y-2">
                    {Object.keys(sub.chapters || {}).length === 0 && (
                      <li className="text-gray-400 text-sm">No chapters</li>
                    )}
                    {Object.keys(sub.chapters || {}).map((ch, idx) => (
                      <li key={idx} className="text-gray-700 text-md flex items-center gap-2 group">
                        <span>• {ch}</span>
                        <button
                          className="ml-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                          onClick={() =>
                            confirm(`Are you sure you want to delete chapter "${ch}" from "${sub.name}"?`, () =>
                              deleteChapter(sub.id, ch)
                            )
                          }
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2 mt-4 justify-end">
                  <button
                    className="text-blue-500 hover:text-blue-700"
                    onClick={() => {
                      setEditSubject({ id: sub.id, name: sub.name, chapters: Object.keys(sub.chapters || {}) });
                      setShowSubjectModal(true);
                    }}
                    title="Edit Subject"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() =>
                      confirm(`Are you sure you want to delete subject "${sub.name}"?`, () => deleteSubject(sub.id))
                    }
                    title="Delete Subject"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Add/Edit Subject Modal */}
      <AnimatePresence>
        {showSubjectModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h2 className="text-2xl font-bold text-blue-700 mb-6">
                {editSubject ? 'Edit Subject' : 'Add New Subject'}
              </h2>
              <input
                className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                placeholder="Subject Name"
                value={editSubject ? editSubject.name : newSubject.name}
                onChange={(e) => {
                  const value = e.target.value;
                  if (editSubject) {
                    setEditSubject({ ...editSubject, name: value });
                  } else {
                    setNewSubject({ ...newSubject, name: value });
                  }
                }}
              />
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-blue-700">Chapters</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(editSubject ? editSubject.chapters : newSubject.chapters).map((ch: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1 text-md">{ch}</span>
                      <button
                        className="text-red-400 hover:text-red-600"
                        onClick={() => {
                          const chapters = (editSubject ? editSubject.chapters : newSubject.chapters).filter((_: any, i: number) => i !== idx);
                          if (editSubject) {
                            setEditSubject({ ...editSubject, chapters });
                          } else {
                            setNewSubject({ ...newSubject, chapters });
                          }
                        }}
                        title="Remove Chapter"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="flex-1 p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Add Chapter"
                    value={chapterInput['new'] || ''}
                    onChange={(e) => setChapterInput({ ...chapterInput, new: e.target.value })}
                  />
                  <button
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition disabled:bg-green-300 font-semibold"
                    onClick={() => {
                      const chapterName = chapterInput['new']?.trim();
                      if (chapterName) {
                        const chapters = editSubject
                          ? [...editSubject.chapters, chapterName]
                          : [...newSubject.chapters, chapterName];
                        if (editSubject) {
                          setEditSubject({ ...editSubject, chapters });
                        } else {
                          setNewSubject({ ...newSubject, chapters });
                        }
                        setChapterInput({ ...chapterInput, new: '' });
                      }
                    }}
                    disabled={loading || !chapterInput['new']?.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition font-semibold"
                  onClick={() => {
                    setShowSubjectModal(false);
                    setEditSubject(null);
                    setNewSubject({ name: '', chapters: [] });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-bold disabled:bg-green-200"
                  onClick={editSubject ? updateSubject : createSubject}
                  disabled={loading || !(editSubject ? editSubject.name : newSubject.name).trim()}
                >
                  {loading ? 'Saving...' : editSubject ? 'Update Subject' : 'Create Subject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Course Modal */}
      <AnimatePresence>
        {showCourseModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h2 className="text-2xl font-bold text-blue-700 mb-6">
                {editCourse ? 'Edit Course' : 'Create New Course'}
              </h2>
              <input
                className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                placeholder="Course Name"
                value={editCourse ? editCourse.name : newCourse.name}
                onChange={(e) => {
                  const value = e.target.value;
                  if (editCourse) {
                    setEditCourse({ ...editCourse, name: value });
                  } else {
                    setNewCourse({ ...newCourse, name: value });
                  }
                }}
              />
              <textarea
                className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                placeholder="Course Description"
                rows={3}
                value={editCourse ? editCourse.description : newCourse.description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (editCourse) {
                    setEditCourse({ ...editCourse, description: value });
                  } else {
                    setNewCourse({ ...newCourse, description: value });
                  }
                }}
              />
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-blue-700">Select Subjects</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {subjects.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={(editCourse ? editCourse.selectedSubjectIds : newCourse.selectedSubjectIds).includes(sub.id)}
                        onChange={(e) => {
                          const selected = e.target.checked
                            ? [...(editCourse ? editCourse.selectedSubjectIds : newCourse.selectedSubjectIds), sub.id]
                            : (editCourse ? editCourse.selectedSubjectIds : newCourse.selectedSubjectIds).filter((id: string) => id !== sub.id);
                          if (editCourse) {
                            setEditCourse({ ...editCourse, selectedSubjectIds: selected });
                          } else {
                            setNewCourse({ ...newCourse, selectedSubjectIds: selected });
                          }
                        }}
                        className="accent-blue-600"
                      />
                      <span className="text-blue-900">{sub.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition font-semibold"
                  onClick={() => {
                    setShowCourseModal(false);
                    setEditCourse(null);
                    setNewCourse({ name: '', description: '', selectedSubjectIds: [] });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-bold disabled:bg-blue-200"
                  onClick={editCourse ? updateCourse : createCourse}
                  disabled={loading || !(editCourse ? editCourse.name : newCourse.name).trim()}
                >
                  {loading ? 'Saving...' : editCourse ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COURSES */}
      <motion.div
        className="max-w-7xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold text-blue-800 mb-4 flex items-center gap-2">
          <Layers className="w-6 h-6 text-blue-400" /> Courses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {courses.map((course) => (
              <motion.div
                key={course.id}
                className="bg-white rounded-2xl shadow-xl p-8 relative border border-blue-100 hover:shadow-2xl transition flex flex-col"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.4 }}
              >
                <div className="absolute top-5 right-5 flex gap-2">
                  <button
                    className="text-blue-500 hover:text-blue-700"
                    onClick={() => {
                      setEditCourse({
                        id: course.id,
                        name: course.name,
                        description: course.description,
                        selectedSubjectIds: course.subjectIds
                      });
                      setShowCourseModal(true);
                    }}
                    title="Edit Course"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    className="text-red-500 hover:text-red-700"
                    onClick={() =>
                      confirm(`Are you sure you want to delete course "${course.name}"?`, () => deleteCourse(course.id))
                    }
                    title="Delete Course"
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
                <h2 className="text-xl font-black text-blue-900 mb-2">{course.name}</h2>
                <p className="text-blue-700 mb-6 flex gap-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  {course.description || 'No description'}
                </p>
                <h3 className="text-lg font-bold text-blue-700 mb-2">Subjects</h3>
                <ul className="space-y-4 mt-2">
                  {course.subjects.length === 0 && (
                    <li className="text-gray-400 text-sm ml-2">No subjects</li>
                  )}
                  {course.subjects.map((sub: any) => (
                    <li key={sub.id} className="border-l-4 border-blue-400 pl-4 bg-blue-50 rounded-lg py-2 mb-1">
                      <strong className="text-blue-900">{sub.name}</strong>
                      <ul className="ml-4 mt-2 space-y-1">
                        {Object.keys(sub.chapters || {}).length === 0 && (
                          <li className="text-gray-400 text-xs">No chapters</li>
                        )}
                        {Object.keys(sub.chapters || {}).map((ch, idx) => (
                          <li key={idx} className="text-gray-700 text-sm flex items-center gap-2 group">
                            <span>• {ch}</span>
                            <button
                              className="ml-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                              onClick={() =>
                                confirm(`Are you sure you want to delete chapter "${ch}" from "${sub.name}"?`, () =>
                                  deleteChapter(sub.id, ch)
                                )
                              }
                              title="Delete Chapter"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2 mt-2">
                        <input
                          className="flex-1 p-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Add Chapter"
                          value={chapterInput[sub.id] || ''}
                          onChange={(e) => setChapterInput({ ...chapterInput, [sub.id]: e.target.value })}
                        />
                        <button
                          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition disabled:bg-green-300"
                          onClick={() => addChapter(sub.id, chapterInput[sub.id] || '')}
                          disabled={loading || !chapterInput[sub.id]?.trim()}
                        >
                          Add
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onConfirm={() => {
          setConfirmOpen(false);
          confirmAction && confirmAction();
        }}
        onCancel={() => setConfirmOpen(false)}
        message={confirmMsg}
      />

      {/* Loading Spinner */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20 z-[100]">
          <div className="animate-spin rounded-full h-14 w-14 border-[5px] border-blue-600 border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}
