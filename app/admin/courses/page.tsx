'use client';

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/app/firebase';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  arrayRemove,
  getDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Edit, Trash, Plus, ChevronRight, Layers,
  BookOpen, Calendar, DollarSign, Tag, User,
  MoreVertical, Check, Search, ArrowLeft, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { Course, Series, Coupon } from '@/types';

// --- Types ---

interface Chapter {
  [key: string]: boolean;
}

// Subject and Course are largely compatible but Subject has a specific structure in this file with 'chapters'.
// We will keep local Subject/Course interfaces if they differ significantly or adapt them.
// Looking at types/index.ts, Course definition is generic. 
// Let's keep the specific internal interfaces for Subject/Chapter as they seem UI specific (Chapter object map)
// BUT we must remove Series/Coupon as we want to share them.

import { glassmorphism } from '@/lib/design-tokens';
interface LocalSubject {
  id: string;
  name: string;
  chapters: Chapter;
}

interface LocalCourse {
  id: string;
  name: string;
  description: string;
  subjectIds: string[];
  subjects?: LocalSubject[];
}

// ... Series/Coupon removed ...

// --- Utility Functions ---

const updateReferenceNameInQuestions = async (type: string, oldName: string, newName: string) => {
  try {
    const q = query(collection(db, 'questions'), where(type, '==', oldName));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d =>
      updateDoc(doc(db, 'questions', d.id), { [type]: newName })
    ));
  } catch (err) {
    console.error(`Error updating reference for ${type}:`, err);
  }
};

// --- Components ---

export default function Page() {
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [courses, setCourses] = useState<LocalCourse[]>([]);
  const [subjects, setSubjects] = useState<LocalSubject[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<LocalCourse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'subjects' | 'series'>('general');

  // Modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);

  // Fetch Data
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch Subjects
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      const subjectList = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LocalSubject));
      setSubjects(subjectList);

      // Fetch Courses
      const coursesSnap = await getDocs(collection(db, 'courses'));
      const courseList = await Promise.all(
        coursesSnap.docs.map(async docSnap => {
          const courseData = docSnap.data() as Omit<LocalCourse, 'id'>;
          const hydratedSubjects: LocalSubject[] = [];

          if (courseData.subjectIds?.length) {
            // We match existing subjects from the fetched list to avoid N+1 queries if possible, 
            // but for simplicity and real-time acc, we can filter from the subjectList we just fetched.
            hydratedSubjects.push(
              ...subjectList.filter(s => courseData.subjectIds.includes(s.id))
            );
          }

          return {
            id: docSnap.id,
            ...courseData,
            subjects: hydratedSubjects
          };
        })
      );
      setCourses(courseList);

      // Update selected course if active
      if (selectedCourse) {
        const updated = courseList.find(c => c.id === selectedCourse.id);
        if (updated) setSelectedCourse(updated);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- Handlers ---

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'courses', courseId));
      await fetchAllData();
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
        setView('list');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Navigation Bar */}
      {/* Standardized Header */}
      <div className="relative group mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
        <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {view === 'detail' && (
                  <button
                    onClick={() => { setView('list'); setSelectedCourse(null); }}
                    className="p-2 rounded-full hover:bg-white/20 transition-colors text-slate-600 dark:text-slate-300"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF]">
                  {view === 'detail' && selectedCourse ? selectedCourse.name : 'Course Management'}
                </h1>
              </div>
              <p className="text-muted-foreground font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]" />
                {courses.length} courses available
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSubjectModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all font-medium text-sm backdrop-blur-sm"
              >
                <Layers className="w-4 h-4" />
                Manage Subjects
              </button>
              <button
                onClick={() => setShowCourseModal(true)}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all font-bold text-sm"
              >
                <Plus className="w-4 h-4" />
                New Course
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <CourseListView
              key="list"
              courses={courses}
              onSelect={(c) => { setSelectedCourse(c); setView('detail'); setActiveTab('general'); }}
              onDelete={handleDeleteCourse}
            />
          ) : (
            selectedCourse && (
              <CourseDetailView
                key="detail"
                course={selectedCourse}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                refreshData={fetchAllData}
                allSubjects={subjects}
              />
            )
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <CreateCourseModal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        onSuccess={fetchAllData}
        subjects={subjects}
      />
      <ManageSubjectsModal
        isOpen={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        subjects={subjects}
        onUpdate={fetchAllData}
      />
    </div>
  );
}

// --- Sub-Components ---

function CourseListView({ courses, onSelect, onDelete }: { courses: LocalCourse[], onSelect: (c: LocalCourse) => void, onDelete: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {courses.map(course => (
        <div
          key={course.id}
          className="group relative bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-indigo-900/20 transition-all duration-300 cursor-pointer"
          onClick={() => onSelect(course)}
        >
          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(course.id); }}
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            >
              <Trash className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{course.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{course.description || 'No description provided.'}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {course.subjectIds?.length || 0} Subjects
            </span>
          </div>
        </div>
      ))}

      {/* Empty State */}
      {courses.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Layers className="w-12 h-12 mb-4 opacity-20" />
          <p>No courses found. Create one to get started.</p>
        </div>
      )}
    </motion.div>
  );
}

function CourseDetailView({
  course,
  activeTab,
  setActiveTab,
  refreshData,
  allSubjects
}: {
  course: LocalCourse;
  activeTab: 'general' | 'subjects' | 'series';
  setActiveTab: (t: any) => void;
  refreshData: () => void;
  allSubjects: LocalSubject[];
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit backdrop-blur-sm sticky top-24 z-20 shadow-sm">
        {['general', 'subjects', 'series'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="min-h-[60vh]">
        {activeTab === 'general' && <GeneralTab course={course} refreshData={refreshData} />}
        {activeTab === 'subjects' && <SubjectsTab course={course} allSubjects={allSubjects} refreshData={refreshData} />}
        {activeTab === 'series' && <SeriesTab courseId={course.id} />}
      </div>
    </motion.div>
  );
}

// --- Detail Tabs ---

function GeneralTab({ course, refreshData }: { course: LocalCourse, refreshData: () => void }) {
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      if (name !== course.name) {
        await updateReferenceNameInQuestions('course', course.name, name);
      }
      await updateDoc(doc(db, 'courses', course.id), { name, description });
      refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">General Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Course Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white transition-all outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-900 text-slate-900 dark:text-white transition-all outline-none resize-none"
            />
          </div>
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleUpdate}
              disabled={loading || (name === course.name && description === course.description)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SubjectsTab({ course, allSubjects, refreshData }: { course: LocalCourse, allSubjects: LocalSubject[], refreshData: () => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(course.subjectIds || []);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'courses', course.id), { subjectIds: selectedIds });
      refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 h-fit">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Connected Subjects</h3>
          <button
            onClick={handleSave}
            disabled={JSON.stringify(selectedIds.sort()) === JSON.stringify((course.subjectIds || []).sort()) || loading}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {allSubjects.map(sub => (
            <label
              key={sub.id}
              className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${selectedIds.includes(sub.id)
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500'
                }`}
            >
              <input
                type="checkbox"
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-slate-600 dark:bg-slate-800 mr-3"
                checked={selectedIds.includes(sub.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds([...selectedIds, sub.id]);
                  else setSelectedIds(selectedIds.filter(id => id !== sub.id));
                }}
              />
              <span className="text-slate-700 dark:text-slate-300 font-medium">{sub.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-800/50">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Preview</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">This is how the subjects are structured within the course.</p>
        <div className="space-y-4">
          {allSubjects.filter(s => selectedIds.includes(s.id)).map(sub => (
            <div key={sub.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <strong className="block text-indigo-900 dark:text-indigo-300 font-semibold mb-2">{sub.name}</strong>
              <div className="flex flex-wrap gap-2">
                {Object.keys(sub.chapters || {}).map(ch => (
                  <span key={ch} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-md font-medium">
                    {ch}
                  </span>
                ))}
                {Object.keys(sub.chapters || {}).length === 0 && (
                  <span className="text-xs text-slate-400 italic">No chapters defined</span>
                )}
              </div>
            </div>
          ))}
          {selectedIds.length === 0 && (
            <p className="text-center text-slate-400 dark:text-slate-600 italic py-8">No subjects selected</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SeriesTab({ courseId }: { courseId: string }) {
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'series'), where('courseId', '==', courseId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Series));
      setSeriesList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this series?')) return;
    try {
      await deleteDoc(doc(db, 'series', id));
      fetchSeries();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Series Management</h3>
        <button
          onClick={() => { setEditingSeries(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all font-medium text-sm shadow-md shadow-indigo-200"
        >
          <Plus className="w-4 h-4" /> Add Series
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {seriesList.map(item => (
          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-md">{item.year}</span>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">{item.name}</h4>
                <p className="text-xs text-slate-400 font-mono">{item.uniqueId}</p>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingSeries(item); setShowModal(true); }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-4">
              <div className="flex justify-between">
                <span className="flex items-center gap-2"><Calendar className="w-3 h-3" /> Expires</span>
                <span className="font-medium">{item.expiryDate ? format(new Date(item.expiryDate), 'MMM dd, yyyy') : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2"><DollarSign className="w-3 h-3" /> Price</span>
                <span className="font-medium">PKR {item.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2"><User className="w-3 h-3" /> Created By</span>
                <span className="font-medium">{item.createdBy}</span>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-tight">Coupons</p>
              <div className="flex flex-wrap gap-2">
                {item.coupons?.map((c, i) => {
                  const discounted = item.price ? Math.round(item.price - (item.price * (c.discountPercentage || 0) / 100)) : 0;
                  return (
                    <span key={i} className="px-2 py-1 border border-dashed border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs rounded-md font-medium" title={`Usage: ${c.usageType}, Limit: ${c.limit}`}>
                      {c.name} {c.discountPercentage ? `(-${c.discountPercentage}% = ${discounted})` : ''}
                    </span>
                  );
                })}
                {(!item.coupons || item.coupons.length === 0) && (
                  <span className="text-xs text-slate-400">No coupons</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {showModal && (
        <SeriesModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchSeries(); }}
          courseId={courseId}
          seriesToEdit={editingSeries}
        />
      )}
    </div>
  );
}

// --- Modals ---

function SeriesModal({ isOpen, onClose, onSuccess, courseId, seriesToEdit }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, courseId: string, seriesToEdit: Series | null }) {
  const [formData, setFormData] = useState<Partial<Series>>({
    name: '',
    uniqueId: '',
    year: new Date().getFullYear().toString(),
    expiryDate: '',
    price: 0,
    createdBy: '',
    coupons: []
  });

  const [couponInput, setCouponInput] = useState<Coupon>({ name: '', usageType: 'Single', limit: 1, discountPercentage: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seriesToEdit) {
      setFormData(seriesToEdit);
    } else {
      setFormData({
        name: '',
        uniqueId: '',
        year: new Date().getFullYear().toString(),
        expiryDate: '',
        price: 0,
        createdBy: '',
        coupons: []
      });
    }
  }, [isOpen, seriesToEdit]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.uniqueId) return;
    setLoading(true);
    try {
      const payload = { ...formData, courseId, price: Number(formData.price) };

      if (seriesToEdit) {
        // @ts-ignore
        const { id, ...data } = payload;
        await updateDoc(doc(db, 'series', seriesToEdit.id), data);
      } else {
        await addDoc(collection(db, 'series'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addCoupon = () => {
    if (!couponInput.name) return;
    setFormData(prev => ({
      ...prev,
      coupons: [...(prev.coupons || []), couponInput]
    }));
    setCouponInput({ name: '', usageType: 'Single', limit: 1, discountPercentage: 0 });
  };

  const removeCoupon = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      coupons: prev.coupons?.filter((_, i) => i !== idx)
    }));
  };

  if (!isOpen) return null;

  const discountedPrice = formData.price && couponInput.discountPercentage
    ? Math.round(formData.price - (formData.price * couponInput.discountPercentage / 100))
    : formData.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{seriesToEdit ? 'Edit Series' : 'Create New Series'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Series Name</label>
              <input
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. MDCAT 2025 Special"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Unique ID</label>
              <input
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                value={formData.uniqueId}
                onChange={e => setFormData({ ...formData, uniqueId: e.target.value })}
                placeholder="SER-2025-001"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Year</label>
              <input
                type="number"
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Expiry Date</label>
              <input
                type="date"
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.expiryDate}
                onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Price (PKR)</label>
              <input
                type="number"
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Created By</label>
              <input
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={formData.createdBy}
                onChange={e => setFormData({ ...formData, createdBy: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2"><Tag className="w-4 h-4" /> Coupons</h4>
            <div className="flex gap-2 items-end mb-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl flex-wrap">
              <div className="flex-1 min-w-[120px] space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Code/Name</label>
                <input
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm"
                  placeholder="SAVE10"
                  value={couponInput.name}
                  onChange={e => setCouponInput({ ...couponInput, name: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="w-24 space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Usage</label>
                <select
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm"
                  value={couponInput.usageType}
                  onChange={e => setCouponInput({ ...couponInput, usageType: e.target.value as any })}
                >
                  <option value="Single">Single</option>
                  <option value="All">All Users</option>
                </select>
              </div>
              <div className="w-20 space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Limit</label>
                <input
                  type="number"
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm"
                  value={couponInput.limit}
                  onChange={e => setCouponInput({ ...couponInput, limit: Number(e.target.value) })}
                />
              </div>
              <div className="w-24 space-y-1">
                <label className="text-xs text-slate-500 dark:text-slate-400">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg text-sm"
                  value={couponInput.discountPercentage}
                  onChange={e => setCouponInput({ ...couponInput, discountPercentage: Number(e.target.value) })}
                />
              </div>
              <button
                onClick={addCoupon}
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-black dark:hover:bg-slate-600 text-sm font-medium h-[38px]"
              >
                Add
              </button>
            </div>

            {/* Live Price Calculation Display */}
            {couponInput.discountPercentage > 0 && (formData.price || 0) > 0 && (
              <div className="mb-4 text-sm text-slate-600 dark:text-slate-300 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800 flex items-center gap-2">
                <span className="font-semibold text-green-700 dark:text-green-400">Ref Price: {discountedPrice} PKR</span>
                <span className="text-xs">(Original: {formData.price}, Discount: {couponInput.discountPercentage}%)</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {formData.coupons?.map((c, i) => {
                const discounted = formData.price ? Math.round(formData.price - (formData.price * (c.discountPercentage || 0) / 100)) : 0;
                return (
                  <div key={i} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-800 shadow-sm text-sm">
                    <span className="font-bold">{c.name}</span>
                    <span className="text-xs opacity-70 dark:opacity-80">
                      ({c.usageType}, {c.discountPercentage}% off
                      {discounted > 0 ? ` -> ${discounted}` : ''})
                    </span>
                    <button onClick={() => removeCoupon(i)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </div>
                );
              })}
              {(!formData.coupons || formData.coupons.length === 0) && (
                <p className="text-sm text-slate-400 italic">No coupons added yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-950">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-medium transition-all">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all font-medium disabled:opacity-70 flex items-center gap-2"
          >
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {seriesToEdit ? 'Save Changes' : 'Create Series'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CreateCourseModal({ isOpen, onClose, onSuccess, subjects }: { isOpen: boolean, onClose: () => void, onSuccess: () => void, subjects: LocalSubject[] }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'courses'), {
        name,
        description,
        subjectIds: selectedSubjects,
        createdAt: serverTimestamp()
      });
      onSuccess();
      onClose();
      // Reset
      setName(''); setDescription(''); setSelectedSubjects([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl p-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Create New Course</h2>
        <div className="space-y-4">
          <input
            className="w-full p-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Course Name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <textarea
            className="w-full p-3 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Description"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Subjects</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-lg p-2">
              {subjects.map(sub => (
                <label key={sub.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(sub.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedSubjects([...selectedSubjects, sub.id]);
                      else setSelectedSubjects(selectedSubjects.filter(id => id !== sub.id));
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{sub.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!name || loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Course'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ManageSubjectsModal({ isOpen, onClose, subjects, onUpdate }: { isOpen: boolean, onClose: () => void, subjects: LocalSubject[], onUpdate: () => void }) {
  const [newSubjectName, setNewSubjectName] = useState('');
  const [loading, setLoading] = useState(false);

  // Chapter Management State
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [newChapterName, setNewChapterName] = useState('');

  const handleAddSubject = async () => {
    if (!newSubjectName) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'subjects'), { name: newSubjectName, chapters: {} });
      setNewSubjectName('');
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Delete this subject? It will be removed from all courses.')) return;
    setLoading(true);
    try {
      // Cleanup references
      const coursesSnap = await getDocs(collection(db, 'courses'));
      await Promise.all(coursesSnap.docs.map(async d => {
        if (d.data().subjectIds?.includes(id)) {
          await updateDoc(doc(db, 'courses', d.id), { subjectIds: arrayRemove(id) });
        }
      }));
      await deleteDoc(doc(db, 'subjects', id));
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddChapter = async (subjectId: string) => {
    if (!newChapterName.trim()) return;
    setLoading(true);
    try {
      // Use dot notation to update a specific key in the map
      await updateDoc(doc(db, 'subjects', subjectId), {
        [`chapters.${newChapterName.trim()}`]: true
      });
      setNewChapterName('');
      onUpdate();
    } catch (err) {
      console.error("Error adding chapter:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChapter = async (subjectId: string, chapterName: string) => {
    if (!confirm(`Remove chapter "${chapterName}"?`)) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'subjects', subjectId), {
        [`chapters.${chapterName}`]: deleteField()
      });
      onUpdate();
    } catch (err) {
      console.error("Error deleting chapter:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col max-h-[85vh]">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Manage Subjects & Chapters</h2>

        {/* Add Subject Input */}
        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 p-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg outline-none focus:border-indigo-500"
            placeholder="New Subject Name"
            value={newSubjectName}
            onChange={e => setNewSubjectName(e.target.value)}
          />
          <button
            onClick={handleAddSubject}
            disabled={!newSubjectName.trim() || loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            Add Subject
          </button>
        </div>

        {/* Subject List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
          {subjects.map(sub => {
            const isExpanded = expandedSubjectId === sub.id;
            const chapters = Object.keys(sub.chapters || {});

            return (
              <div key={sub.id} className={`bg-slate-50 dark:bg-slate-950 rounded-lg border transition-all ${isExpanded ? 'border-indigo-200 dark:border-indigo-900 shadow-sm' : 'border-transparent'}`}>
                {/* Subject Header */}
                <div
                  className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg"
                  onClick={() => setExpandedSubjectId(isExpanded ? null : sub.id)}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className="font-medium text-slate-700 dark:text-slate-300">{sub.name}</span>
                    <span className="text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-full">{chapters.length}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSubject(sub.id); }}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>

                {/* Chapters Section (Expanded) */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 pt-0 pl-9 space-y-3 border-t border-slate-100/50 dark:border-slate-800/50">
                        {/* New Chapter Input */}
                        <div className="flex gap-2 mt-3">
                          <input
                            className="flex-1 p-1.5 text-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded outline-none focus:border-indigo-500"
                            placeholder="Add Chapter..."
                            value={newChapterName}
                            onChange={(e) => setNewChapterName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddChapter(sub.id); }}
                            disabled={!newChapterName.trim() || loading}
                            className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Chapters List */}
                        <div className="space-y-1">
                          {chapters.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No chapters yet</p>
                          ) : (
                            chapters.map(chapter => (
                              <div key={chapter} className="flex justify-between items-center group/chapter p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded">
                                <span className="text-sm text-slate-600 dark:text-slate-400">{chapter}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteChapter(sub.id, chapter); }}
                                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover/chapter:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 text-right">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-medium">Close</button>
        </div>
      </motion.div>
    </div>
  );
}
