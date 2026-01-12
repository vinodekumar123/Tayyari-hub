'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Users, Trophy, BarChart3, Settings, Plus,
  Database, Home, ChevronDown, ChevronRight, LogOut,
  ClipboardList, UserCircle, Menu, X, FileBarChart, Flag, Calendar, BrainCircuit
} from 'lucide-react';
import logo from "../../app/assets/logo.png";
import Image from "next/image";
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../app/firebase';
import { ensureSessionActive, subscribeToSession, updateSessionHeartbeat, logoutUserSession } from '@/lib/sessionUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ModeToggle } from '@/components/mode-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useFcmToken } from '@/hooks/useFcmToken';
import { useUIStore } from '@/stores/useUIStore'; // Added import
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';

type MenuItem = {
  icon: React.ElementType;
  label: string;
  href?: string;
  badge?: string | null;
  onClick?: () => void;
};

type Section = {
  section: string;
  title: string;
  items: MenuItem[];
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [expandedSections, setExpandedSections] = useState<string[]>(['main', 'content', 'users', 'settings', 'student', 'main_nav', 'learning', 'practice', 'community', 'performance', 'account']);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  const { setLoading } = useUIStore(); // Added hook usage

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Refs for cleanup
  const unsubscribeSessionRef = useRef<() => void | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize FCM Token
  useFcmToken();

  const [userRole, setUserRole] = useState<string>('student');

  useEffect(() => {
    // Sync role state when admin/superadmin changes (simplified)
    // Ideally we fetch this in the auth effect
  }, [isAdmin, isSuperAdmin]);

  const adminMenu: Section[] = [
    {
      section: 'main',
      title: 'Dashboard',
      items: [
        {
          icon: Home,
          label: 'Dashboard',
          href: userRole === 'teacher' ? '/dashboard/teacher' : '/dashboard/admin'
        },
        ...(isSuperAdmin ? [{ icon: BarChart3, label: 'Analytics & Stats', href: '/admin/statistics' }] : []),
        ...(userRole === 'teacher' ? [
          { icon: ClipboardList, label: 'My Tasks', href: '/dashboard/teacher/tasks' },
          { icon: Flag, label: 'Reports', href: '/dashboard/teacher/reports' },
          { icon: BarChart3, label: 'My Performance', href: '/dashboard/teacher/stats' }
        ] : [
          // Admins also get personal tasks/stats
          { icon: ClipboardList, label: 'My Assigned Tasks', href: '/dashboard/admin/my-tasks' },
          { icon: BarChart3, label: 'My Revenue', href: '/dashboard/admin/my-stats' }
        ])
      ],
    },
    // Admin Task Management
    ...(!userRole.includes('teacher') ? [{
      section: 'tasks',
      title: 'Task Management',
      items: [
        { icon: ClipboardList, label: 'Manage Tasks', href: '/admin/tasks' }
      ]
    }] : []),

    {
      section: 'content',
      title: 'Content Management',
      items: [
        // Courses: Admin/SuperAdmin only
        ...(!userRole.includes('teacher') ? [{ icon: BookOpen, label: 'Courses', href: '/admin/courses' }] : []),
        ...(!userRole.includes('teacher') ? [{ icon: BookOpen, label: 'Bundle Management', href: '/admin/bundles' }] : []),
        ...(userRole.includes('teacher') ? [{ icon: Users, label: 'Community', href: '/dashboard/teacher/community' }] : []),

        { icon: BookOpen, label: 'Content Hub', href: '/admin/content' },
        ...(!userRole.includes('teacher') ? [{ icon: Users, label: 'Community', href: '/dashboard/admin/community' }] : []),

        { icon: Database, label: 'Question Bank', href: '/admin/questions/questionbank' },
        { icon: Plus, label: 'Add Question', href: '/admin/questions/create' },
        { icon: Database, label: 'Mock Questions', href: '/admin/mockquestions/questionbank' },
        { icon: Plus, label: 'Add Mock Question', href: '/admin/mockquestions/create' },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
        { icon: Plus, label: 'Create Quiz', href: '/admin/quizzes/create' },
        { icon: BrainCircuit, label: 'AI Auto-Tagger', href: '/admin/questions/auto-tagger' },
        { icon: Flag, label: 'Reported Questions', href: '/admin/reports' },
      ],
    },
    // User Management: Admin/SuperAdmin only
    ...(!userRole.includes('teacher') ? [{
      section: 'users',
      title: 'User Management',
      items: [
        { icon: Users, label: 'Students', href: '/admin/students' },
        { icon: FileBarChart, label: 'Results', href: '/admin/results' },
        { icon: UserCircle, label: 'Login Sessions', href: '/admin/users/sessions' },
      ],
    }] : []),
    {
      section: 'settings',
      title: 'Profile',
      items: [{ icon: Settings, label: 'Settings', href: '/admin/settings' }],
    },
  ];

  const studentMenu: Section[] = [
    {
      section: 'main_nav',
      title: 'Main Navigation',
      items: [
        { icon: Home, label: 'Dashboard', href: '/dashboard/student' },
        { icon: Calendar, label: 'Quiz Schedule', href: '/dashboard/student/schedule' },
      ],
    },
    {
      section: 'learning',
      title: 'Learning / Study Tools',
      items: [
        { icon: BookOpen, label: 'Syllabus', href: '/dashboard/student/syllabus' },
        { icon: BookOpen, label: 'Study Zone', href: '/dashboard/study' },
        { icon: BookOpen, label: 'Flashcards', href: '/dashboard/student/flashcards' },
      ],
    },
    {
      section: 'practice',
      title: 'Practice / Testing',
      items: [
        { icon: Trophy, label: 'Quizzes', href: '/dashboard/student/quiz-bank' },
        { icon: Plus, label: 'Create Your Own Test', href: '/quiz/create-mock' },
        { icon: Trophy, label: 'Your Created Tests', href: '/dashboard/student/user-created-quizzes' },
      ],
    },
    {
      section: 'community',
      title: 'Community / Engagement',
      items: [
        { icon: Users, label: 'Community', href: '/dashboard/student/community' },
        { icon: Trophy, label: 'Leaderboard', href: '/dashboard/leaderboard' },
      ],
    },
    {
      section: 'performance',
      title: 'Performance / Reports',
      items: [
        { icon: ClipboardList, label: 'Results', href: '/admin/students/results' },
        { icon: Flag, label: 'My Reports', href: '/dashboard/student/reports' },
      ],
    },
    {
      section: 'account',
      title: 'Account',
      items: [
        { icon: Settings, label: 'Settings & Security', href: '/dashboard/student/settings' },
      ],
    },
  ];

  useEffect(() => {
    // Force expand 'content' section for admin so they see the new Report link
    if (isAdmin) {
      setExpandedSections(prev => prev.includes('content') ? prev : [...prev, 'content']);
    }
  }, [isAdmin]);

  useEffect(() => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          // Auto-ensure session is active (Initial Check)
          ensureSessionActive(user).catch((err) => {
            if (err.message && (err.message.includes("revoked") || err.message.includes("blocked"))) {
              setSessionExpiredOpen(true);
            }
          });

          // Real-time Session Status Listener
          const unsub = subscribeToSession(user, (status) => {
            if (status === 'revoked') {
              setSessionExpiredOpen(true);
            }
          });
          // @ts-ignore
          unsubscribeSessionRef.current = unsub;

          // Heartbeat: Update session active timestamp every 5 minutes
          const hbInterval = setInterval(() => {
            updateSessionHeartbeat(user);
          }, 5 * 60 * 1000);
          heartbeatIntervalRef.current = hbInterval;

          const data = snap.data();
          const role = data.role || (data.superadmin ? 'superadmin' : (data.admin ? 'admin' : 'student'));
          setUserRole(role);

          const isAdminOrTeacher = role === 'admin' || role === 'superadmin' || role === 'teacher' || data.admin === true;

          setIsAdmin(isAdminOrTeacher);
          setIsSuperAdmin(role === 'superadmin' || data.superadmin === true);
          const isAdminUser = data.admin === true || data.role === 'admin' || data.role === 'superadmin';
          const isSuperAdminUser = data.superadmin === true || data.role === 'superadmin';
          const isTeacherUser = data.role === 'teacher';

          setIsAdmin(isAdminUser || isTeacherUser); // Teachers can access Admin Layout
          setIsSuperAdmin(isSuperAdminUser);

          // Store role for menu logic
          // A better approach is to store the whole user object or specific role state
          // For now, we rely on local variables inside the effect, but we need state for rendering.
          // Let's add a state for role.
        } else {
          // User exists but has no document (New user/Onboarding pending)
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setUserRole('student');
        }
      } else {
        // User logged out: Cleanup listeners immediately
        if (unsubscribeSessionRef.current) {
          // @ts-ignore
          unsubscribeSessionRef.current();
          unsubscribeSessionRef.current = null;
        }
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        setIsAdmin(false);
        setIsSuperAdmin(false);
        setUserRole('student'); // Default to student if no user
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeSessionRef.current) {
        // @ts-ignore
        unsubscribeSessionRef.current();
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []); // Empty dependency array means runs once. But adminMenu accesses state. 
  // IMPORTANT: adminMenu is defined inside component body, so on every render it effectively captures current isSuperAdmin.
  // The useEffect sets state, triggering re-render, which re-defines adminMenu with correct items.
  // The only issue is `setExpandedSections` in useEffect references `adminMenu`. 
  // Since `adminMenu` depends on `isSuperAdmin` which is false initially, it won't expand validly on first load.
  // Let's fix that by moving setExpandedSections to a separate effect or just relying on isAdminUser check inside the effect. 
  // Actually, the previous code used `adminMenu` inside useEffect. Since adminMenu is const in function body, it's newly created on every render.
  // Inside useEffect (closure), `adminMenu` refers to the one created during the *first* render (where isSuperAdmin is false).
  // So initial expansion might miss the new item, but that's fine.



  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (pathname === href) return true;

    // Dashboard roots should only be active on exact match
    const isDashboardRoot = href === '/dashboard/student' || href === '/dashboard/admin' || href === '/dashboard/teacher';
    if (isDashboardRoot) return false;

    // Sub-path matching (e.g. /quiz-bank active on /quiz-bank/detail)
    // Ensures we don't match /dashboard/stud for /dashboard/student
    return pathname.startsWith(href) && (pathname[href.length] === '/' || pathname.length === href.length);
  };

  const handleSignOut = async () => {
    const auth = getAuth(app);
    if (auth.currentUser) {
      await logoutUserSession(auth.currentUser.uid);
    }
    await signOut(auth);
    router.push('/');
  };

  const handleSessionExpiredConfirm = async () => {
    const auth = getAuth(app);
    await signOut(auth);
    window.location.href = '/auth/login';
  };

  if (isAdmin === null) return null;

  const menu = isAdmin ? adminMenu : studentMenu;

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        {!mobileOpen && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6 text-foreground" />
          </Button>
        )}
      </div>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full z-50 bg-background border-r border-border flex flex-col transition-transform duration-300
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:flex`}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center space-x-3">
              <Image src={logo} alt="Tayyari Hub Logo" className="h-10 w-auto" priority />
            </div>
          ) : (
            <BookOpen className="h-6 w-6 text-purple-700" />
          )}

          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="md:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-10">
          {menu.map((section) => (
            <div key={section.section}>
              <button
                onClick={() => toggleSection(section.section)}
                className={`flex items-center justify-between w-full text-left text-sm font-semibold text-foreground mb-3 ${collapsed ? 'hidden' : 'block'}`}
              >
                <span className="text-base font-bold">{section.title}</span>
                {expandedSections.includes(section.section) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {expandedSections.includes(section.section) && (
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href!}
                      onClick={() => {
                        if (!isActive(item.href)) {
                          setLoading('navigation', true);
                        }
                        if (mobileOpen) setMobileOpen(false);
                      }}
                    >
                      <div
                        className={`flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-all duration-200 group ${isActive(item.href)
                          ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 shadow-sm dark:from-purple-900/50 dark:to-blue-900/50 dark:text-purple-300'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon
                            className={`h-10 w-5 ${isActive(item.href)
                              ? 'text-purple-800 dark:text-purple-400'
                              : 'text-muted-foreground group-hover:text-foreground'
                              }`}
                          />
                          {!collapsed && <span className="font-semibold text-base">{item.label}</span>}
                        </div>
                        {!collapsed && item.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Sign Out */}
          <div
            onClick={() => setShowSignOutDialog(true)}
            className="flex items-center justify-between px-3 py-2 rounded-sm text-sm cursor-pointer transition-all duration-200 text-muted-foreground hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30"
          >
            <div className="flex items-center space-x-3">
              <LogOut className="h-5 w-5 text-red-500 group-hover:text-red-700" />
              {!collapsed && <span className="font-semibold text-base">Sign Out</span>}
            </div>
          </div>
        </nav>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sign Out Dialog */}
      {showSignOutDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Are you sure?</h2>
            <p className="text-sm text-gray-600 mb-4">Do you really want to sign out?</p>
            <div className="flex justify-end space-x-2">
              <Button variant="secondary" onClick={() => setShowSignOutDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Session Expired Dialog - BLOCKING */}
      <Dialog open={sessionExpiredOpen} onOpenChange={(open) => {
        // FORCE OPEN: Do not match 'open' state if it's trying to close (false)
        // Only allow closing via the specific confirm button logic if we wanted, 
        // but here `onOpenChange` is triggered by clicking outside. We explicitly IGNORE false to keep it open.
        if (open) setSessionExpiredOpen(true);
      }}>
        <DialogContent className="sm:max-w-md [&>button]:hidden"> {/* Hide defaults close X button via CSS if needed, or preventDefault */}
          <DialogHeader>
            <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-center text-xl">Session Expired</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Your session has been expired or revoked by an administrator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center mt-4">
            <Button onClick={handleSessionExpiredConfirm} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white">
              Okay, Log in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
