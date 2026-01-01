'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from '@/components/ui/sidebar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { useUserStore } from '@/stores/useUserStore';
import { useUIStore } from '@/stores/useUIStore';

// Routes accessible by any authenticated user (including students)
const STUDENT_ACCESSIBLE_ROUTES = [
  '/admin/quizzes/quizebank',
  '/admin/quizzes/user-created-quizzes',
  '/admin/students/results',
  '/admin/student-profile',
  '/admin/students/responses',
  '/admin/students/user-responses'
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Use Zustand stores instead of local useState
  const { user, isLoading, setUser, setLoading, isAdmin } = useUserStore();
  const { setLoading: setUILoading } = useUIStore();

  useEffect(() => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // If route is whitelisted, allow access immediately without strict admin check
        const isWhitelisted = STUDENT_ACCESSIBLE_ROUTES.some(route => pathname?.startsWith(route));

        if (isWhitelisted) {
          // For whitelisted routes, load user data for both students and admins
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            const userData = userDoc.data();

            console.log('🔍 Admin Layout (Whitelisted): Loaded user', { uid: firebaseUser.uid, role: userData?.role });

            // Set user in Zustand for both students and admins
            const userForStore = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              fullName: userData?.fullName || '',
              phone: userData?.phone,
              admin: userData?.admin,
              // Include enrollment and plan so whitelisted student pages can filter correctly
              course: userData?.course || null,
              plan: userData?.plan || 'free',
              superadmin: userData?.superadmin, // Added superadmin field
              role: (userData?.admin === true || userData?.admin === 'true') ? 'admin' as const : 'student' as const,
              photoURL: firebaseUser.photoURL,
              stats: userData?.stats,
            };

            console.log('✅ Admin Layout (Whitelisted): Setting user in Zustand');
            setUser(userForStore);
          } catch (error) {
            console.error('❌ Admin Layout (Whitelisted): Error loading user', error);
          }

          setLoading(false);
          setUILoading('auth', false);
          return;
        }

        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          const userData = userDoc.data();

          console.log('🔍 Admin Layout: Loaded user data for', firebaseUser.uid, { admin: userData?.admin });

          if (userDoc.exists()) {
            const isAdmin = userData?.admin === true || userData?.admin === 'true' || userData?.role === 'admin';
            const isSuperAdmin = userData?.superadmin === true || userData?.role === 'superadmin';
            const isTeacher = userData?.role === 'teacher' || userData?.teacher === true;

            if (isAdmin || isSuperAdmin || isTeacher) {
              const userForStore = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                fullName: userData?.fullName || '',
                phone: userData?.phone,
                admin: userData?.admin,
                superadmin: userData?.superadmin,
                course: userData?.course || null,
                plan: userData?.plan || (isAdmin ? 'admin' : 'teacher'),
                role: (isAdmin ? 'admin' : (isTeacher ? 'teacher' : 'student')) as any,
                photoURL: firebaseUser.photoURL,
                stats: userData?.stats,
              };
              console.log('✅ Admin Layout: Setting user in Zustand store', { role: userForStore.role });
              setUser(userForStore);
            } else {
              console.warn('⛔ Admin Layout: Access denied for user', firebaseUser.uid);
              router.push('/');
            }
          } else {
            router.push('/');
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setLoading(false);
          setUILoading('auth', false);
          router.push('/');
        }
      } else {
        setLoading(false);
        setUILoading('auth', false);
        router.push('/auth/login');
      }
    });

    return () => unsubscribe();
  }, [pathname, router, setUser, setLoading, setUILoading]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004AAD] mx-auto"></div>
          <p className="text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
