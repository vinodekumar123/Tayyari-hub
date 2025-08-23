'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { db, auth } from '../../firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import {
  Tabs,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Edit,
  Phone,
  BookOpen,
  BarChart2,
  MapPin,
  Search,
  Filter,
  Trash2,
  X
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { FixedSizeList as VirtualList } from 'react-window';

type Course = {
  id: string;
  name: string;
  description: string;
  subjectIds: string[];
};

type Student = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  course?: string;
  university?: string;
  campus?: string;
  district?: string;
  degree?: string;
  plan?: string;
  uid?: string;
  premium?: boolean;
  admin?: boolean;
  superadmin?: boolean;
  status?: string;
  profileImage?: string;
  [key: string]: any;
};

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

export default function Enrollment() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [editData, setEditData] = useState<Partial<Student>>({});
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [searchField, setSearchField] = useState<string>('all');
  const router = useRouter();

  // Debounced search for performance
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

  // Fetch all students, batching if necessary
  const fetchAllStudents = async () => {
    setLoading(true);
    setFetchingAll(true);
    const batchSize = 500;
    let allStudents: Student[] = [];
    let lastVisible: any = null;
    let more = true;

    while (more) {
      const q = lastVisible
        ? query(
            collection(db, 'users'),
            orderBy('fullName'),
            startAfter(lastVisible),
            limit(batchSize)
          )
        : query(
            collection(db, 'users'),
            orderBy('fullName'),
            limit(batchSize)
          );
      const snapshot = await getDocs(q);
      const batch: Student[] = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(d.data().fullName || '')}&background=random&size=128`
      }));
      allStudents = [...allStudents, ...batch];
      lastVisible = snapshot.docs[snapshot.docs.length - 1];
      more = snapshot.docs.length === batchSize;
    }
    setStudents(allStudents);
    setLoading(false);
    setFetchingAll(false);
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await doc(db, 'users', user.uid);
        onSnapshot(userDoc, (doc) => {
          const data = doc.data();
          setIsSuperadmin(data?.superadmin === true);
        });
      } else {
        setIsSuperadmin(false);
      }
    });

    const unsubscribeCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      const data: Course[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Course));
      setCourses(data);
    });

    fetchAllStudents();

    return () => {
      unsubscribeAuth();
      unsubscribeCourses();
    };
    // eslint-disable-next-line
  }, []);

  // Filtering/search logic - optimized, safe, and user-friendly
  const filteredStudents = useMemo(() => {
    let filtered = students;

    // Debounced search term
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(student => {
        if (searchField === 'all') {
          return (
            (student.fullName || '').toLowerCase().includes(term) ||
            (student.email || '').toLowerCase().includes(term) ||
            (student.phone || '').includes(debouncedSearchTerm) ||
            (student.course || '').toLowerCase().includes(term) ||
            (student.district || '').toLowerCase().includes(term)
          );
        }
        if (searchField === 'fullName') return (student.fullName || '').toLowerCase().includes(term);
        if (searchField === 'email') return (student.email || '').toLowerCase().includes(term);
        if (searchField === 'phone') return (student.phone || '').includes(debouncedSearchTerm);
        if (searchField === 'course') return (student.course || '').toLowerCase().includes(term);
        if (searchField === 'district') return (student.district || '').toLowerCase().includes(term);
        return true;
      });
    }

    // User type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(student => {
        if (filterType === 'premium') return student.plan === 'premium';
        if (filterType === 'free') return student.plan === 'free' || !student.plan;
        if (filterType === 'admin') return student.admin === true;
        return true;
      });
    }

    // Course filter
    if (courseFilter !== 'all') {
      filtered = filtered.filter(student =>
        (student.course || '').toLowerCase() === courseFilter.toLowerCase()
      );
    }

    return filtered;
  }, [students, debouncedSearchTerm, filterType, courseFilter, searchField]);

  // For accessibility and better UX: highlight search term in results
  function highlightText(text: string, term: string) {
    if (!term || !text) return text;
    const regex = new RegExp(`(${term})`, 'gi');
    return text.split(regex).map((part, idx) =>
      regex.test(part) ? (
        <span key={idx} className="bg-yellow-200">{part}</span>
      ) : (
        part
      )
    );
  }

  // Virtual list item renderer
  const Row = ({ index, style }: { index: number; style: any }) => {
    const student = filteredStudents[index];
    if (!student) return null;
    return (
      <div style={style}>
        <Card key={student.id} className="shadow-xl mx-2 my-2">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-center">
              <div className="flex items-center space-x-3">
                <img src={student.profileImage} alt="Profile" className="w-12 h-12 rounded-full" />
                <div>
                  <h3 className="text-lg font-bold truncate max-w-[200px]">
                    {highlightText(student.fullName, debouncedSearchTerm)}
                  </h3>
                  <p className="text-sm text-gray-600 truncate max-w-[200px]">
                    {highlightText(student.email, debouncedSearchTerm)}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1 mt-2 sm:mt-0">
                <Badge className={`mt-1 ${student.plan === 'premium' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {student.plan === 'premium' ? 'Active' : 'Inactive'}
                </Badge>
                {student.admin && (
                  <Badge className="bg-blue-100 text-blue-700">Admin</Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 truncate">
              <Phone className="inline h-4 w-4 mr-1" />{highlightText(student.phone, debouncedSearchTerm)}
            </p>
            <p className="text-sm text-gray-600 truncate">
              <BookOpen className="inline h-4 w-4 mr-1" />{highlightText(student.course, debouncedSearchTerm)}
            </p>
            <p className="text-sm text-gray-600 truncate">
              <MapPin className="inline h-4 w-4 mr-1" />{highlightText(student.district, debouncedSearchTerm)}
            </p>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
              <Button variant="outline" size="sm" onClick={() => handleEditClick(student)}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push(`/admin/students/foradmin?studentId=${student.id}`)}>
                <BarChart2 className="h-4 w-4 mr-1" /> Check Results
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(student)}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const handleEditClick = (student: Student) => {
    setCurrentStudent(student);
    setEditData({ ...student });
    setEditModal(true);
  };

  const handleEditChange = <K extends keyof Student>(key: K, value: Student[K]) => {
    if (key === 'course' && value === 'none') {
      setEditData((prev) => ({ ...prev, [key]: '' }));
    } else {
      setEditData((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleEditSave = async () => {
    if (!editData.fullName?.trim() || !editData.phone?.trim()) {
      alert('Full name and phone are required.');
      return;
    }
    try {
      if (currentStudent?.id) {
        const { id, ...dataToUpdate } = editData;
        Object.keys(dataToUpdate).forEach(key => {
          if (dataToUpdate[key] === undefined) delete dataToUpdate[key];
        });
        await updateDoc(doc(db, 'users', currentStudent.id), dataToUpdate);
        setEditModal(false);
        setStudents(students =>
          students.map(s => (s.id === currentStudent.id ? { ...s, ...dataToUpdate } : s))
        );
      }
    } catch (err) {
      console.error('Error updating student:', err);
      alert('Failed to save changes.');
    }
  };

  const handleDeleteClick = (student: Student) => {
    setCurrentStudent(student);
    setDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (currentStudent?.id) {
      try {
        await deleteDoc(doc(db, 'users', currentStudent.id));
        setDeleteModal(false);
        setStudents(students.filter(student => student.id !== currentStudent.id));
      } catch (err) {
        console.error('Error deleting student:', err);
        alert('Failed to delete student.');
      }
    }
  };

  // Keyboard accessibility: clear search on Esc
  useEffect(() => {
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchTerm('');
    };
    window.addEventListener('keydown', escHandler);
    return () => window.removeEventListener('keydown', escHandler);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10 pr-10"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search students"
            />
            {searchTerm && (
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={searchField} onValueChange={setSearchField}>
            <SelectTrigger className="w-28" aria-label="Choose search field">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fields</SelectItem>
              <SelectItem value="fullName">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="course">Course</SelectItem>
              <SelectItem value="district">District</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-4 w-full sm:w-auto">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="premium">Premium Users</SelectItem>
                <SelectItem value="free">Free Users</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <BookOpen className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.name}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mb-2 text-gray-700 text-sm">
          Showing {filteredStudents.length} of {students.length} students
        </div>
        <Tabs defaultValue="students">
          <TabsContent value="students">
            <div className="relative" style={{ minHeight: 400 }}>
              {loading && (
                <div className="flex flex-col items-center justify-center mt-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-500 mb-4"></div>
                  Loading students...
                </div>
              )}
              {!loading && filteredStudents.length === 0 && (
                <p className="text-center text-gray-600 mt-6">
                  No students found.
                  <br />
                  <span className="text-xs text-gray-400">
                    Try searching by other fields or check your filters.
                  </span>
                </p>
              )}
              {!loading && filteredStudents.length > 0 && (
                <VirtualList
                  height={Math.min(filteredStudents.length * 180, 720)}
                  itemCount={filteredStudents.length}
                  itemSize={180}
                  width="100%"
                  overscanCount={6}
                >
                  {Row}
                </VirtualList>
              )}
              {fetchingAll && (
                <p className="text-center text-gray-400 mt-4">Loading all students...</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {currentStudent && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['fullName', 'email', 'phone', 'fatherName', 'district'].map((field) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={field} className="text-sm font-medium text-gray-700">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Input
                      id={field}
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={String(editData[field] ?? '')}
                      onChange={(e) => handleEditChange(field, e.target.value)}
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label htmlFor="course" className="text-sm font-medium text-gray-700">
                    Course
                  </Label>
                  <Select
                    value={editData.course ?? 'none'}
                    onValueChange={(value) => handleEditChange('course', value)}
                  >
                    <SelectTrigger id="course">
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {courses.map(course => (
                        <SelectItem key={course.id} value={course.name}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="plan" className="text-sm font-medium text-gray-700">
                  Plan
                </Label>
                <Select
                  value={editData.plan ?? 'free'}
                  onValueChange={(value) => handleEditChange('plan', value)}
                >
                  <SelectTrigger id="plan">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isSuperadmin && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="admin"
                    checked={editData.admin ?? false}
                    onChange={(e) => handleEditChange('admin', e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="admin" className="text-sm font-medium text-gray-700">
                    Admin
                  </Label>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Are you sure you want to delete <strong>{currentStudent?.fullName}</strong>? This action cannot be undone.
          </DialogDescription>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
