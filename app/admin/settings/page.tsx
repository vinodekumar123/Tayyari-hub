'use client';

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db, auth } from '../../firebase';

import * as RadixSelect from '@radix-ui/react-select';
import { toast } from 'sonner';

import type { FormState, SubjectItem } from '@/types';

export default function TeacherProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>({
    fullName: '',
    email: '',
    phone: '',
    metadata: {
      course: '',
      courseId: '',
      subject: '',
      subjectId: '',
      chapter: '',
      chapterId: '',
      topic: '',
      difficulty: '',
      year: '',
      book: '',
      teacher: '',
    },
    subjects: [],
  });

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const years = Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => (2000 + i).toString());

  const fetchCoursesFromFirestore = useCallback(async () => {
    const snapshot = await getDocs(collection(db, 'courses'));
    const courseData = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setAllCourses(courseData);
  }, []);

  const fetchAllSubjects = useCallback(async () => {
    const snapshot = await getDocs(collection(db, 'subjects'));
    const subjects = snapshot.docs.map((doc) => ({
      id: doc.id,
      name: (doc.data() as any).name || '',
      ...(doc.data() as any),
    }));
    setAllSubjects(subjects);
    setAvailableSubjects(subjects.map((s: any) => s.name));
  }, []);

  const fetchUserData = useCallback(async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
          const data = snapshot.data();
          setForm((prev) => ({
            ...prev,
            ...data,
            metadata: {
              ...prev.metadata,
              ...(data.metadata || {}),
            },
            subjects: Array.isArray(data.subjects) ? data.subjects : prev.subjects,
          }));

          if (data.subjects && Array.isArray(data.subjects) && data.subjects.length > 0) {
            const assignedIds = new Set(data.subjects);
            const validSubjects = allSubjects.filter(s => assignedIds.has(s.id) || assignedIds.has(s.name));
            if (validSubjects.length > 0) {
              setAvailableSubjects(validSubjects.map(s => s.name));
            } else {
              const assignedNames = data.subjects;
              setAvailableSubjects(Array.isArray(assignedNames) ? assignedNames : []);
            }
          }
      }
    } catch (err) {
      toast.error('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [allSubjects]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setForm((prev) => ({ ...prev, email: user.email || '' }));
        await fetchUserData(user.uid);
      }
    });

    fetchCoursesFromFirestore();
    fetchAllSubjects();

    return () => unsubscribe();
  }, [fetchUserData, fetchCoursesFromFirestore, fetchAllSubjects]);

  // Filter subjects whenever allSubjects or user form data changes
  const assignedSubjects = (form as any).subjects;
  useEffect(() => {
    // We check form.subjects if that exists, or we need to store assigned IDs separately.
    // The current form structure puts user fields in root of form. 
    // 'subjects' field in form state?
    // Looking at fetchUserData: setForm({ ...form, ...data }) puts firestore 'subjects' into 'form.subjects'.
    // Let's add 'subjects' to the form interface implicitly used here.

    const assigned = assignedSubjects;

    if (assigned && Array.isArray(assigned) && assigned.length > 0 && allSubjects.length > 0) {
      const assignedSet = new Set(assigned);
      const filtered = allSubjects.filter(s => assignedSet.has(s.id) || assignedSet.has(s.name));

      if (filtered.length > 0) {
        setAvailableSubjects(filtered.map(s => s.name));
      } else {
        // If we couldn't match IDs/Names against allSubjects objects, 
        // but we have assigned strings, utilize them directly if they look like names.
        // Assuming 'assigned' contains names or IDs.
        // Use the raw array if filtering against DB subjects failed (fallback)
        // But strictly speaking, we want names for the dropdown. 
        // If assigned are IDs and we failed to find them in allSubjects, we are in trouble.
        // Assuming they match.
        setAvailableSubjects(assigned);
      }
    } else if (allSubjects.length > 0 && !loading && userId) {
      // If user loaded but has no subjects? user might be Admin.
      // If Admin, show all? Or show none?
      // User request said: "only subjects of that teacher".
      // If no subjects assigned, empty list is correct.
      // But for safety, if user is NOT teacher (e.g. admin), maybe show all?
      // Let's re-read: "it will only subjects of that teacher". 
      // If I am admin, I might want all.
      // Checking role... Form doesn't explicitly store role in top level clearly, but data does.
      // Let's strictly follow "assigned subjects" logic.
      // If assigned is empty/null, and I am a teacher, I see nothing.
      // If I am superadmin, I might not have 'subjects' array.
      // Let's stick to: if subjects array exists, use it. If not, use all (default behavior for admins usually).
      if (!assigned || assigned.length === 0) {
        // If filtering was meant for teachers, we should keep all for others? 
        // Current code sets allSubjects by default.
      }
    }
  }, [allSubjects, assignedSubjects, loading, userId]);

  

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!userId) return;
      setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...form,
        metadata: {
          ...form.metadata,
          teacher: form.fullName,
        },
        updatedAt: new Date(),
      });
      toast.success('✅ Info saved successfully!');
    } catch (err) {
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCourseSelect = async (courseName: string) => {
    const selected = allCourses.find((c) => c.name === courseName);
    if (!selected) return;

    handleInputChange('course', courseName);
    handleInputChange('courseId', selected.id);
    handleInputChange('subject', '');
    handleInputChange('subjectId', '');
    handleInputChange('chapter', '');
    handleInputChange('chapterId', '');
    setAvailableChapters([]);
  };

  const handleSubjectSelect = async (subjectName: string) => {
    handleInputChange('subject', subjectName);
    handleInputChange('subjectId', '');
    handleInputChange('chapter', '');
    handleInputChange('chapterId', '');
    setAvailableChapters([]);

    const selectedSubject = allSubjects.find((s) => s.name === subjectName);
    if (!selectedSubject) return;

    handleInputChange('subjectId', selectedSubject.id);
    const chapters = selectedSubject.chapters || {};
    setAvailableChapters(Object.keys(chapters));
  };

  const handleChapterSelect = (chapterName: string) => {
    handleInputChange('chapter', chapterName);
    handleInputChange('chapterId', chapterName); // Adjust if you use unique IDs
  };

  if (loading)
    return <p className="text-center py-10">Loading profile...</p>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex justify-center">
      <div className="w-full bg-white shadow-lg rounded-lg p-8 space-y-8">
        <h2 className="text-2xl font-bold text-left">👨‍🏫 Teacher Profile</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-1">Full Name</label>
            <input
              className="w-full border px-3 py-2 rounded"
              value={form.fullName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, fullName: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block mb-1">Email</label>
            <input
              className="w-full border px-3 py-2 rounded bg-gray-100 cursor-not-allowed"
              value={form.email}
              readOnly
            />
          </div>
          <div>
            <label className="block mb-1">Phone</label>
            <input
              className="w-full border px-3 py-2 rounded"
              value={form.phone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Metadata Section */}
        <div className="space-y-6 border-t pt-6">
          <h3 className="text-xl font-semibold">📘 Question Metadata Defaults</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RadixDropdown
              label="Course"
              value={form.metadata?.course || ''}
              options={allCourses.map((c) => c.name)}
              onChange={handleCourseSelect}
            />
            <RadixDropdown
              label="Subject"
              value={form.metadata?.subject || ''}
              options={availableSubjects}
              onChange={handleSubjectSelect}
            />
            <RadixDropdown
              label="Chapter"
              value={form.metadata?.chapter || ''}
              options={availableChapters}
              onChange={handleChapterSelect}
              disabled={!form.metadata?.subject}
            />
            <RadixDropdown
              label="Difficulty"
              value={form.metadata?.difficulty || ''}
              options={difficulties}
              onChange={(val) => handleInputChange('difficulty', val)}
            />
            <RadixDropdown
              label="Year"
              value={form.metadata?.year || ''}
              options={years}
              onChange={(val) => handleInputChange('year', val)}
            />
            <div>
              <label className="block mb-1">Book</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={form.metadata?.book || ''}
                onChange={(e) =>
                  handleInputChange('book', e.target.value)
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RadixDropdown({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <label className="block mb-1">{label}</label>
      <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
        <RadixSelect.Trigger className="w-full border px-3 py-2 rounded text-left flex items-center justify-between">
          <RadixSelect.Value>
            {value || `Select ${label.toLowerCase()}`}
          </RadixSelect.Value>
          <RadixSelect.Icon className="ml-2">▼</RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Content className="bg-white border shadow rounded">
          <RadixSelect.Viewport>
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt}
                value={opt}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
              >
                <RadixSelect.ItemText>{opt}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Root>
    </div>
  );
}
