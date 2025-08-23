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
  X,
  User
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
      <div style={style} className="px-2 sm:px-4">
        <Card className="shadow-lg mb-2 hover:shadow-xl transition-shadow duration-200">
          <CardContent className="p-3 sm:p-4">
            {/* Header with profile and badges */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0">
                  <img 
                    src={student.profileImage} 
                    alt="Profile" 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover" 
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                    {highlightText(student.fullName || 'N/A', debouncedSearchTerm)}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {highlightText(student.email || 'No email', debouncedSearchTerm)}
                  </p>
                </div>
              </div>
              
              {/* Badges */}
              <div className="flex flex-wrap gap-1 sm:flex-col sm:items-end">
                <Badge 
                  className={`text-xs px-2 py-0.5 ${
                    student.plan === 'premium' 
                      ? 'bg-green-100 text-green-800 border-green-300' 
                      : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                  variant="outline"
                >
                  {student.plan === 'premium' ? 'Premium' : 'Free'}
                </Badge>
                {student.admin && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs px-2 py-0.5" variant="outline">
                    Admin
                  </Badge>
                )}
              </div>
            </div>

            {/* Student details in grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-2 truncate">
                <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {highlightText(student.phone || 'No phone', debouncedSearchTerm)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 truncate">
                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {highlightText(student.course || 'No course', debouncedSearchTerm)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 truncate sm:col-span-2">
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {highlightText(student.district || 'No district', debouncedSearchTerm)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <div className="grid grid-cols-2 sm:grid-cols-none sm:flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEditClick(student)}
                  className="text-xs px-2 py-1 h-8"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  <span className="hidden xs:inline">Edit</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => router.push(`/admin/students/foradmin?studentId=${student.id}`)}
                  className="text-xs px-2 py-1 h-8"
                >
                  <BarChart2 className="h-3 w-3 mr-1" />
                  <span className="hidden xs:inline">Results</span>
                </Button>
              </div>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => handleDeleteClick(student)}
                className="text-xs px-2 py-1 h-8 sm:w-auto"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                <span className="hidden xs:inline">Delete</span>
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
    <div className="min-h-screen bg-gray-50">
      <main className="w-full px-2 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-7xl mx-auto">
        {/* Search and filters section */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                className="pl-10 pr-10 text-sm"
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
            
            {/* Search field selector */}
            <Select value={searchField} onValueChange={setSearchField}>
              <SelectTrigger className="w-full sm:w-32" aria-label="Choose search field">
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
          </div>

          {/* Filter selectors */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
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

        {/* Results count */}
        <div className="mb-3 text-gray-700 text-xs sm:text-sm px-1">
          Showing {filteredStudents.length} of {students.length} students
          {fetchingAll && (
            <span className="ml-2 text-blue-600 animate-pulse">Loading all students...</span>
          )}
        </div>

        {/* Students list */}
        <Tabs defaultValue="students">
          <TabsContent value="students" className="mt-0">
            <div className="relative">
              {loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-t-2 border-b-2 border-blue-500 mb-3"></div>
                  <p className="text-gray-600 text-sm">Loading students...</p>
                </div>
              )}
              
              {!loading && filteredStudents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <User className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-center text-gray-600 text-sm sm:text-base mb-1">
                    No students found
                  </p>
                  <p className="text-center text-gray-400 text-xs sm:text-sm">
                    Try adjusting your search terms or filters
                  </p>
                </div>
              )}
              
              {!loading && filteredStudents.length > 0 && (
                <VirtualList
                  height={Math.min(filteredStudents.length * 200, 800)}
                  itemCount={filteredStudents.length}
                  itemSize={200}
                  width="100%"
                  overscanCount={5}
                >
                  {Row}
                </VirtualList>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Modal */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {currentStudent && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {['fullName', 'email', 'phone', 'fatherName', 'district'].map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field} className="text-sm font-medium text-gray-700">
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Input
                      id={field}
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={String(editData[field] ?? '')}
                      onChange={(e) => handleEditChange(field, e.target.value)}
                      className="w-full"
                    />
                  </div>
                ))}
                
                <div className="space-y-2">
                  <Label htmlFor="course" className="text-sm font-medium text-gray-700">
                    Course
                  </Label>
                  <Select
                    value={editData.course ?? 'none'}
                    onValueChange={(value) => handleEditChange('course', value)}
                  >
                    <SelectTrigger id="course" className="w-full">
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
              
              <div className="space-y-2">
                <Label htmlFor="plan" className="text-sm font-medium text-gray-700">
                  Plan
                </Label>
                <Select
                  value={editData.plan ?? 'free'}
                  onValueChange={(value) => handleEditChange('plan', value)}
                >
                  <SelectTrigger id="plan" className="w-full">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {isSuperadmin && (
                <div className="flex items-center space-x-3 pt-2">
                  <input
                    type="checkbox"
                    id="admin"
                    checked={editData.admin ?? false}
                    onChange={(e) => handleEditChange('admin', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Label htmlFor="admin" className="text-sm font-medium text-gray-700">
                    Make this user an admin
                  </Label>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setEditModal(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditSave}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={deleteModal} onOpenChange={setDeleteModal}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Confirm Delete</DialogTitle>
          </DialogHeader>
          <DialogDescription className="py-4">
            Are you sure you want to delete <strong className="text-gray-900">{currentStudent?.fullName}</strong>? 
            <br />
            <span className="text-red-600 text-sm">This action cannot be undone.</span>
          </DialogDescription>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDeleteModal(false)}
              className="w-full sm:w-auto order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              Delete Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
