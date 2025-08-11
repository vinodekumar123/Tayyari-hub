'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
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
  deleteDoc
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
  Trash2
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

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

export default function Enrollment() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [editModal, setEditModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [editData, setEditData] = useState<Partial<Student>>({});
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const router = useRouter();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const fetchTrigger = useRef<NodeJS.Timeout | null>(null);

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

    fetchStudents();

    return () => {
      unsubscribeAuth();
      unsubscribeCourses();
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (observer.current) observer.current.disconnect();
      if (fetchTrigger.current) clearTimeout(fetchTrigger.current);
    };
  }, []);

  const fetchStudents = async (append = false) => {
    if (!hasMore && !append) return;
    setLoading(true);

    if (unsubscribeRef.current) unsubscribeRef.current();

    const studentsQuery = query(
      collection(db, 'users'),
      orderBy('fullName'),
      limit(1000),
      ...(append && lastDoc ? [startAfter(lastDoc)] : [])
    );
    const unsubscribe = onSnapshot(studentsQuery, (snapshot) => {
      const newData: Student[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.data().fullName || '')}&background=random&size=128`,
      }));

      if (!append) {
        setStudents(newData);
        applyFilters(newData);
      } else {
        const uniqueData = newData.filter(newStudent => !students.some(existing => existing.id === newStudent.id));
        if (uniqueData.length > 0) {
          setStudents(prev => [...prev, ...uniqueData]);
          applyFilters([...students, ...uniqueData]);
        }
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(newData.length === 3);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching students:', error);
      setLoading(false);
    });

    unsubscribeRef.current = unsubscribe;
  };

  const applyFilters = (studentList: Student[]) => {
    let filtered = studentList;

    // Apply search term filter
    filtered = filtered.filter(student =>
      student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone.includes(searchTerm) ||
      student.course?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.district?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply user type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(student => {
        if (filterType === 'premium') return student.plan === 'premium';
        if (filterType === 'free') return student.plan === 'free' || !student.plan;
        if (filterType === 'admin') return student.admin === true;
        return true;
      });
    }

    // Apply course filter
    if (courseFilter !== 'all') {
      filtered = filtered.filter(student => 
        student.course?.toLowerCase() === courseFilter.toLowerCase()
      );
    }

    setFilteredStudents(filtered);
  };

  useEffect(() => {
    applyFilters(students);
  }, [searchTerm, filterType, courseFilter, students]);

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
        setFilteredStudents(filteredStudents.filter(student => student.id !== currentStudent.id));
      } catch (err) {
        console.error('Error deleting student:', err);
        alert('Failed to delete student.');
      }
    }
  };

  useEffect(() => {
    const handleObserver = (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        if (fetchTrigger.current) clearTimeout(fetchTrigger.current);
        fetchTrigger.current = setTimeout(() => {
          fetchStudents(true);
        }, 300);
      }
    };
    observer.current = new IntersectionObserver(handleObserver, { threshold: 1 });
    const target = document.querySelector('#load-more-trigger');
    if (target) observer.current.observe(target);

    return () => {
      if (observer.current) observer.current.disconnect();
      if (fetchTrigger.current) clearTimeout(fetchTrigger.current);
    };
  }, [hasMore, loading]);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
        <Tabs defaultValue="students">
          <TabsContent value="students">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {loading && !filteredStudents.length ? (
                Array(3).fill(0).map((_, index) => (
                  <Card key={index} className="shadow-xl animate-pulse">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                          <div>
                            <div className="h-6 bg-gray-300 rounded w-32"></div>
                            <div className="h-4 bg-gray-300 rounded w-24 mt-1"></div>
                          </div>
                        </div>
                        <div className="h-6 bg-gray-300 rounded w-16 mt-2 sm:mt-0"></div>
                      </div>
                      <div className="h-4 bg-gray-300 rounded w-20"></div>
                      <div className="h-4 bg-gray-300 rounded w-24"></div>
                      <div className="h-8 bg-gray-300 rounded w-20 ml-auto"></div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                filteredStudents.map((student) => (
                  <Card key={student.id} className="shadow-xl">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <img src={student.profileImage} alt="Profile" className="w-12 h-12 rounded-full" />
                          <div>
                            <h3 className="text-lg font-bold truncate max-w-[200px]">{student.fullName}</h3>
                            <p className="text-sm text-gray-600 truncate max-w-[200px]">{student.email}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-1 mt-2 sm:mt-0">
                          <Badge className={`mt-1 ${student.plan === 'premium' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {student.plan === 'premium' ? 'Active' : 'Inactive'}
                          </Badge>
                          {student.admin && (
                            <Badge className="bg-blue-100 text-blue-700">
                              Admin
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 truncate"><Phone className="inline h-4 w-4 mr-1" /> {student.phone}</p>
                      <p className="text-sm text-gray-600 truncate"><BookOpen className="inline h-4 w-4 mr-1" /> {student.course}</p>
                      <p className="text-sm text-gray-600 truncate"><MapPin className="inline h-4 w-4 mr-1" /> {student.district}</p>
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
                ))
              )}
              {hasMore && <div id="load-more-trigger" className="h-1"></div>}
            </div>
            {!loading && filteredStudents.length === 0 && (
              <p className="text-center text-gray-600 mt-6">No students found.</p>
            )}
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