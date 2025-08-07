'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import * as RadixSelect from '@radix-ui/react-select';
import { toast } from 'sonner';

export default function TeacherProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
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
  });

  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<{ id: string; name: string }[]>([]);
  const [availableChapters, setAvailableChapters] = useState<string[]>([]);
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const years = Array.from({ length: new Date().getFullYear() - 2000 + 1 }, (_, i) => (2000 + i).toString());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setForm((prev) => ({ ...prev, email: user.email || '' }));
        await fetchUserData(user.uid);
      }
    });

    fetchCoursesFromFirestore();
    return () => unsubscribe();
  }, []);

  const fetchCoursesFromFirestore = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'courses'));
      const courseData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAllCourses(courseData);
    } catch (err) {
      console.error('Error fetching courses:', err);
      toast.error('Failed to load courses.');
    }
  };

  const fetchUserData = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        setForm({
          ...form,
          ...data,
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
            ...(data.metadata || {}),
          },
        });
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      toast.error('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setForm((prev) => ({
      ...prev,
      metadata: { ...(prev.metadata || {}), [field]: value },
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
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCourseSelect = async (courseName: string) => {
    const selected = allCourses.find((c) => c.name === courseName);
    if (!selected) {
      console.warn(`Course ${courseName} not found`);
      return;
    }

    handleInputChange('course', courseName);
    handleInputChange('courseId', selected.id);
    handleInputChange('subject', '');
    handleInputChange('subjectId', '');
    handleInputChange('chapter', '');
    handleInputChange('chapterId', '');
    setAvailableChapters([]);
    setAvailableSubjects([]);

    try {
      const subjectsArray: { id: string; name: string }[] = [];
      for (const subjectId of selected.subjectIds || []) {
        const subjectRef = doc(db, 'subjects', subjectId);
        const subjectSnap = await getDoc(subjectRef);
        if (subjectSnap.exists()) {
          const subjectData = subjectSnap.data();
          if (subjectData.name) {
            subjectsArray.push({ id: subjectId, name: subjectData.name });
          }
        }
      }
      setAvailableSubjects(subjectsArray);
    } catch (err) {
      console.error('Error fetching subjects:', err);
      toast.error('Failed to load subjects.');
    }
  };

  const handleSubjectSelect = async (subjectName: string) => {
    if (!subjectName) return;

    handleInputChange('subject', subjectName);
    handleInputChange('chapter', '');
    handleInputChange('chapterId', '');
    setAvailableChapters([]);

    const selectedSubject = availableSubjects.find((s) => s.name === subjectName);
    if (!selectedSubject) {
      console.warn('Selected subject not found');
      return;
    }

    handleInputChange('subjectId', selectedSubject.id);

    try {
      const subjectRef = doc(db, 'subjects', selectedSubject.id);
      const subjectSnap = await getDoc(subjectRef);
      if (subjectSnap.exists()) {
        const subjectData = subjectSnap.data();
        const chapters = subjectData.chapters || {};
        setAvailableChapters(Object.keys(chapters));
      }
    } catch (err) {
      console.error('Error fetching subject data:', err);
      toast.error('Failed to load chapters.');
    }
  };

  const handleChapterSelect = (chapterName: string) => {
    handleInputChange('chapter', chapterName);
    handleInputChange('chapterId', chapterName); // Adjust if chapter has a separate ID
  };

  if (loading) return <p className="text-center py-10">Loading profile...</p>;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex justify-center">
      <div className="w-full max-w-4xl bg-white shadow-lg rounded-lg p-8 space-y-8">
        <h2 className="text-2xl font-bold text-left">👨‍🏫 Teacher Profile</h2>

        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-1">Full Name</label>
            <input
              className="w-full border px-3 py-2 rounded"
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
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
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-6 border-t pt-6">
          <h3 className="text-xl font-semibold">📘 Question Metadata Defaults</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RadixDropdown
              label="Course"
              value={form.metadata.course || ''}
              options={allCourses.map((c) => c.name)}
              onChange={handleCourseSelect}
            />
            <RadixDropdown
              label="Subject"
              value={form.metadata.subject || ''}
              options={availableSubjects.map((s) => s.name)}
              onChange={handleSubjectSelect}
              disabled={!form.metadata.course}
            />
            <RadixDropdown
              label="Chapter"
              value={form.metadata.chapter || ''}
              options={availableChapters}
              onChange={handleChapterSelect}
              disabled={!form.metadata.subject}
            />
            <RadixDropdown
              label="Difficulty"
              value={form.metadata.difficulty || ''}
              options={difficulties}
              onChange={(val) => handleInputChange('difficulty', val)}
            />
            <RadixDropdown
              label="Year"
              value={form.metadata.year || ''}
              options={years}
              onChange={(val) => handleInputChange('year', val)}
            />
            <div>
              <label className="block mb-1">Book</label>
              <input
                className="w-full border px-3 py-2 rounded"
                value={form.metadata.book || ''}
                onChange={(e) => handleInputChange('book', e.target.value)}
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
      <RadixSelect.Root value={value || ''} onValueChange={onChange} disabled={disabled}>
        <RadixSelect.Trigger className="w-full border px-3 py-2 rounded text-left flex items-center justify-between">
          <RadixSelect.Value placeholder={`Select ${label.toLowerCase()}`}>
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
