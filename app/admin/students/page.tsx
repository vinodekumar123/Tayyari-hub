'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { db } from '../../firebase';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Users,
  Search,
  Download,
  UserPlus,
  Edit,
  Phone,
  BookOpen,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function Enrollment() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
const [students, setStudents] = useState<Student[]>([]);
  const [editModal, setEditModal] = useState(false);
const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
const [editData, setEditData] = useState<Partial<Student>>({});
type Student = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  course?: string;
  university?: string;
  campus?: string;
  city?: string;
  degree?: string;
  plan?: string;
  uid?: string;
  premium?: boolean;
  [key: string]: any; // ✅ index signature
};

useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
    const data: Student[] = snapshot.docs.map(doc => {
      const raw = doc.data();
      return {
        id: doc.id,
        fullName: raw.fullName || '',
        email: raw.email || '',
        phone: raw.phone || '',
        course: raw.course || '',
        university: raw.university,
        campus: raw.campus,
        city: raw.city,
        degree: raw.degree,
        plan: raw.plan,
        uid: raw.uid,
        premium: raw.premium,
        status: raw.status,
        profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(raw.fullName || '')}&background=random&size=128`,
      };
    });
    setStudents(data);
  });

  return () => unsubscribe();
}, []);



  const filteredStudents = students.filter(student => {
    const matchesSearch = (student.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (student.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesCourse = selectedCourse === 'all' || student.course === selectedCourse;
    const matchesStatus = selectedStatus === 'all' || (selectedStatus === 'active' ? student.premium : student.status === selectedStatus);
    return matchesSearch && matchesCourse && matchesStatus;
  });

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
      const { id, ...dataToUpdate } = editData; // remove id before saving
      await updateDoc(doc(db, 'users', currentStudent.id), dataToUpdate);
      setEditModal(false);
    }
  } catch (err) {
    console.error('Error updating student:', err);
    alert('Failed to save changes.');
  }
};

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="students">
       
          {/* All Students */}
          <TabsContent value="students">
            <Card className="mb-6">
              <CardContent className="p-4 space-y-4">
                <Input
                  placeholder="Search students by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="flex flex-col md:flex-row gap-4">
                  <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)} className="border border-gray-300 rounded-md px-4 py-2">
                    <option value="all">All Courses</option>
                    <option value="MDCAT">MDCAT</option>
                    <option value="ECAT">ECAT</option>
                    <option value="LAT">LAT</option>
                  </select>
                  <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="border border-gray-300 rounded-md px-4 py-2">
                    <option value="all">All Status</option>
                    <option value="active">Active (Premium)</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStudents.map((student) => (
                <Card key={student.id} className="shadow-xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <img src={student.profileImage} alt="Profile" className="w-12 h-12 rounded-full" />
                        <div>
                          <h3 className="text-lg font-bold">{student.fullName}</h3>
                          <p className="text-sm text-gray-600">{student.email}</p>
                        </div>
                      </div>
                      <Badge className={`mt-1 ${student.premium ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {student.premium ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600"><Phone className="inline h-4 w-4 mr-1" /> {student.phone}</p>
                    <p className="text-sm text-gray-600"><BookOpen className="inline h-4 w-4 mr-1" /> {student.course}</p>
                    <div className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(student)}>
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {/* Edit Student Dialog */}
      <Dialog open={editModal} onOpenChange={setEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          {currentStudent && (
            <div className="space-y-3">
             {['fullName', 'email', 'phone', 'course', 'university', 'campus', 'city', 'degree', 'plan', 'uid'].map((field) => (
  <Input
    key={field}
    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
    value={String(editData[field] ?? '')}
    onChange={(e) => handleEditChange(field, e.target.value)}
  />
))}

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
