'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  startAfter,
  limit,
  getDocs,
  onSnapshot,
  doc,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

type Student = {
  id: string;
  FullName: string;
  Email?: string;
  Phone?: string;
};

export default function StudentPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  // 🔹 Fetch Students with Pagination
  const fetchStudents = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const studentsRef = collection(db, 'students');
      let q = query(studentsRef, orderBy('FullName'), limit(20));

      if (lastDoc) {
        q = query(studentsRef, orderBy('FullName'), startAfter(lastDoc), limit(20));
      }

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const newStudents = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Student, 'id'>),
        }));

        setStudents((prev) => [...prev, ...newStudents]);
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === 20);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastDoc]);

  // 🔹 Auth Listener (Superadmin check)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      let unsubscribeUser: (() => void) | undefined;
      if (user) {
        const userDoc = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDoc, (docSnap) => {
          const data = docSnap.data();
          setIsSuperadmin(data?.superadmin === true);
        });
      } else {
        setIsSuperadmin(false);
      }
      // Cleanup for both auth and user snapshot
      return () => {
        if (unsubscribeUser) unsubscribeUser();
      };
    });

    return () => {
      if (typeof unsubscribeAuth === 'function') {
        unsubscribeAuth();
      }
    };
  }, []);

  // 🔹 Initial Fetch (only run once!)
  useEffect(() => {
    fetchStudents();
    // We don't want to re-fetch if fetchStudents changes, so disable exhaustive-deps warning for this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔹 Filtered Students
  const filteredStudents = students.filter((s) =>
    s.FullName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">🎓 Students</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            {isSuperadmin && (
              <Button variant="secondary">➕ Add Student</Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
              <Card key={student.id}>
                <CardContent className="p-4 space-y-2">
                  <p className="font-semibold">{student.FullName}</p>
                  <p className="text-sm text-gray-600">{student.Email || 'No Email'}</p>
                  <p className="text-sm text-gray-600">{student.Phone || 'No Phone'}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
            </div>
          )}

          {hasMore && !loading && (
            <div className="flex justify-center mt-4">
              <Button onClick={fetchStudents}>Load More</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
