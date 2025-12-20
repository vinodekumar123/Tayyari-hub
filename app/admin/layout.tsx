'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/ui/sidebar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/app/firebase';

// Routes accessible by any authenticated user (including students)
const STUDENT_ACCESSIBLE_ROUTES = [
  '/admin/quizzes/quizebank',
  '/admin/quizzes/user-created-quizzes',
  '/admin/students/results',
  '/admin/student-profile'
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // If route is whitelisted, allow access immediately without strict admin check
        // We just needed to confirm they are logged in (which `if (user)` does)
        const isWhitelisted = STUDENT_ACCESSIBLE_ROUTES.some(route => pathname?.startsWith(route));

        if (isWhitelisted) {
          setLoading(false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().admin === true) {
            setLoading(false);
          } else {
            router.push('/'); // Redirect non-admins to home if accessing restricted admin pages
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          router.push('/');
        }
      } else {
        router.push('/'); // Redirect unauthenticated users to home (or login)
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {children}
      </main>
    </div>
  );
}
