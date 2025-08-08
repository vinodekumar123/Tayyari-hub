'use client'

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
import { X, Edit, Trash, Plus } from 'lucide-react';

export default function Page() {
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

  // Fetch all subjects
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

  // Fetch all courses
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

  // Create a new subject
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

  // Update a subject
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

  // Delete a subject
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

  // Create a new course
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

  // Update a course
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

  // Delete a course
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

  // Add a chapter to a subject
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
    } catch (error) {
      console.error('Error adding chapter:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete a chapter
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 md:mb-8">
        <motion.h1 
          className="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-4 sm:mb-0"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Course Management
        </motion.h1>
        <div className="flex space-x-2 sm:space-x-4">
          <button
            className="bg-green-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-green-600 transition-all flex items-center"
            onClick={() => {
              setNewSubject({ name: '', chapters: [] });
              setEditSubject(null);
              setShowSubjectModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Subject
          </button>
          <button
            className="bg-blue-500 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg hover:bg-blue-600 transition-all flex items-center"
            onClick={() => {
              setNewCourse({ name: '', description: '', selectedSubjectIds: [] });
              setEditCourse(null);
              setShowCourseModal(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Course
          </button>
        </div>
      </div>

      {/* Subjects List */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Subjects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {subjects.map((sub) => (
              <motion.div
                key={sub.id}
                className="bg-white rounded-xl shadow-lg p-4 flex justify-between items-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div>
                  <strong className="text-gray-800">{sub.name}</strong>
                  <ul className="ml-4 mt-2 space-y-1">
                    {Object.keys(sub.chapters || {}).map((ch, idx) => (
                      <li key={idx} className="text-gray-600 text-sm flex items-center">
                        <span>• {ch}</span>
                        <button
                          className="ml-2 text-red-500 hover:text-red-600"
                          onClick={() => deleteChapter(sub.id, ch)}
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex space-x-2">
                  <button
                    className="text-blue-500 hover:text-blue-600"
                    onClick={() => {
                      setEditSubject({ id: sub.id, name: sub.name, chapters: Object.keys(sub.chapters || {}) });
                      setShowSubjectModal(true);
                    }}
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    className="text-red-500 hover:text-red-600"
                    onClick={() => deleteSubject(sub.id)}
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl p-6 w-full max-w-md"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                {editSubject ? 'Edit Subject' : 'Add New Subject'}
              </h2>
              <input
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
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
                <h3 className="text-lg font-semibold text-gray-700">Chapters</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(editSubject ? editSubject.chapters : newSubject.chapters).map((ch: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1">{ch}</span>
                      <button
                        className="text-red-500 hover:text-red-600"
                        onClick={() => {
                          const chapters = (editSubject ? editSubject.chapters : newSubject.chapters).filter((_: any, i: number) => i !== idx);
                          if (editSubject) {
                            setEditSubject({ ...editSubject, chapters });
                          } else {
                            setNewSubject({ ...newSubject, chapters });
                          }
                        }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Add Chapter"
                    value={chapterInput['new'] || ''}
                    onChange={(e) => setChapterInput({ ...chapterInput, new: e.target.value })}
                  />
                  <button
                    className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-all disabled:bg-green-300"
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
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  onClick={() => {
                    setShowSubjectModal(false);
                    setEditSubject(null);
                    setNewSubject({ name: '', chapters: [] });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-all disabled:bg-green-300"
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl p-6 w-full max-w-md"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                {editCourse ? 'Edit Course' : 'Create New Course'}
              </h2>
              <input
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
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
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                placeholder="Course Description"
                rows={4}
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
                <h3 className="text-lg font-semibold text-gray-700">Select Subjects</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {subjects.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2">
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
                      />
                      <span>{sub.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  onClick={() => {
                    setShowCourseModal(false);
                    setEditCourse(null);
                    setNewCourse({ name: '', description: '', selectedSubjectIds: [] });
                  }}
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-all disabled:bg-blue-300"
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

      {/* Courses List */}
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Courses</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {courses.map((course) => (
              <motion.div
                key={course.id}
                className="bg-white rounded-xl shadow-lg p-6 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button
                    className="text-blue-500 hover:text-blue-600"
                    onClick={() => {
                      setEditCourse({ id: course.id, name: course.name, description: course.description, selectedSubjectIds: course.subjectIds });
                      setShowCourseModal(true);
                    }}
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    className="text-red-500 hover:text-red-600"
                    onClick={() => deleteCourse(course.id)}
                  >
                    <Trash className="w-5 h-5" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-gray-800 pr-16">{course.name}</h2>
                <p className="text-gray-600 mt-2">{course.description || 'No description'}</p>
                
                <h3 className="text-lg font-semibold text-gray-700 mt-4">Subjects</h3>
                <ul className="space-y-4 mt-2">
                  {course.subjects.map((sub: any) => (
                    <li key={sub.id} className="border-l-4 border-blue-500 pl-4">
                      <strong className="text-gray-800">{sub.name}</strong>
                      <ul className="ml-4 mt-2 space-y-1">
                        {Object.keys(sub.chapters || {}).map((ch, idx) => (
                          <li key={idx} className="text-gray-600 text-sm flex items-center">
                            <span>• {ch}</span>
                            <button
                              className="ml-2 text-red-500 hover:text-red-600"
                              onClick={() => deleteChapter(sub.id, ch)}
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2 mt-2">
                        <input
                          className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Add Chapter"
                          value={chapterInput[sub.id] || ''}
                          onChange={(e) => setChapterInput({ ...chapterInput, [sub.id]: e.target.value })}
                        />
                        <button
                          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-all disabled:bg-green-300"
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
      </div>

      {loading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        </div>
      )}
    </div>
  );
}