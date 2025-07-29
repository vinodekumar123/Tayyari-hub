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
  startAfter
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
  DialogFooter
} from '@/components/ui/dialog';
import {
  Edit,
  Phone,
  BookOpen,
  BarChart2,
  MapPin,
  Search
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

// Types
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
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [editModal, setEditModal] = useState(false);
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
      limit(3),
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
        setFilteredStudents(newData);
      } else {
        const uniqueData = newData.filter(newStudent => !students.some(existing => existing.id === newStudent.id));
        if (uniqueData.length > 0) {
          setStudents(prev => [...prev, ...uniqueData]);
          setFilteredStudents(prev => [...prev, ...uniqueData]);
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

  // Handle search filtering
  useEffect(() => {
    const filtered = students.filter(student =>
      student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone.includes(searchTerm) ||
      student.course?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.district?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  const handleEditClick = (student: Student) => {
    setCurrentStudent(student);
    setEditData({ ...student });
    setEditModal(true);
  };

  const handleEditChange = <K extends keyof Student>(key: K, value: Student[K]) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
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
  }, [hasMore, loading, students]);

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
                          <Badge className={`mt-1 ${student.premium ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                            {student.premium ? 'Active' : 'Inactive'}
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
            <div className="space-y-3">
              {['fullName', 'email', 'phone', 'course', 'university', 'district', 'degree', 'plan'].map((field) => (
                <Input
                  key={field}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  value={String(editData[field] ?? '')}
                  onChange={(e) => handleEditChange(field, e.target.value)}
                />
              ))}
              {isSuperadmin && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editData.admin ?? false}
                    onChange={(e) => handleEditChange('admin', e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label>Admin</label>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button onClick={handleEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}