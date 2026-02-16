'use client';

import { useEffect, useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Users, Trophy, BarChart3, Settings, Plus,
  Database, Home, ChevronDown, ChevronRight, LogOut,
  ClipboardList, UserCircle, Menu, X, FileBarChart, Flag, Calendar, BrainCircuit, HelpCircle, ArrowLeftRight, Lock, Scissors, Wand2
} from 'lucide-react';
import logo from "../../app/assets/logo.png";
import Image from "next/image";
import { getAuth, signOut } from 'firebase/auth';
import { app } from '../../app/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFcmToken } from '@/hooks/useFcmToken';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { logoutUserSession } from '@/lib/sessionUtils';

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

// Static Student Menu - Defined outside to avoid re-creation
const STUDENT_MENU: Section[] = [
  {
    section: 'main_nav',
    title: 'Main Navigation',
    items: [
      { icon: Home, label: 'Dashboard', href: '/dashboard/student' },
      { icon: Calendar, label: 'Quiz Schedule', href: '/dashboard/student/schedule' },
      { icon: HelpCircle, label: 'How to Register', href: '/dashboard/student/how-to-register' },
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
      { icon: ClipboardList, label: 'Results', href: '/dashboard/student/results' },
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

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Global Stores
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, sidebarTriggerHidden, setLoading } = useUIStore();
  const { user } = useUserStore();

  // Local State
  const mobileOpen = sidebarOpen;
  const setMobileOpen = setSidebarOpen;
  const collapsed = sidebarCollapsed;

  const [expandedSections, setExpandedSections] = useState<string[]>(['main', 'content', 'users', 'ai', 'settings', 'student', 'main_nav', 'learning', 'practice', 'community', 'performance', 'account']);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  // Initialize FCM Token (safe to keep here)
  useFcmToken();

  // Derived State from Store
  const userRole = user?.role || 'student';
  const isAdminOrTeacher = userRole === 'admin' || userRole === 'superadmin' || userRole === 'teacher' || user?.admin === true;
  const isSuperAdmin = userRole === 'superadmin' || user?.superadmin === true;
  const isTeacher = userRole === 'teacher';

  // Memoized Admin Menu
  const adminMenu = useMemo<Section[]>(() => [
    {
      section: 'main',
      title: 'Dashboard',
      items: [
        {
          icon: Home,
          label: 'Dashboard',
          href: isTeacher ? '/dashboard/teacher' : '/dashboard/admin'
        },
        ...(isSuperAdmin ? [{ icon: BarChart3, label: 'Analytics & Stats', href: '/admin/statistics' }] : []),
        ...(isTeacher ? [
          { icon: ClipboardList, label: 'My Tasks', href: '/dashboard/teacher/tasks' },
          { icon: Flag, label: 'Reports', href: '/dashboard/teacher/reports' },
          { icon: BarChart3, label: 'My Performance', href: '/dashboard/teacher/stats' }
        ] : [
          { icon: ClipboardList, label: 'My Assigned Tasks', href: '/dashboard/admin/my-tasks' },
          { icon: BarChart3, label: 'My Revenue', href: '/dashboard/admin/my-stats' }
        ])
      ],
    },
    ...(!isTeacher ? [{
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
        ...(!isTeacher ? [{ icon: BookOpen, label: 'Courses', href: '/admin/courses' }] : []),
        ...(!isTeacher ? [{ icon: BookOpen, label: 'Bundle Management', href: '/admin/bundles' }] : []),
        ...(isTeacher ? [{ icon: Users, label: 'Community', href: '/dashboard/teacher/community' }] : []),

        { icon: BookOpen, label: 'Content Hub', href: '/admin/content' },
        ...(!isTeacher ? [{ icon: Users, label: 'Community', href: '/dashboard/admin/community' }] : []),

        { icon: Database, label: 'Question Bank', href: '/admin/questions/questionbank' },
        { icon: Plus, label: 'Add Question', href: '/admin/questions/create' },
        { icon: Database, label: 'Mock Questions', href: '/admin/mockquestions/questionbank' },
        { icon: Plus, label: 'Add Mock Question', href: '/admin/mockquestions/create' },
        { icon: Lock, label: 'Mock Access Control', href: '/admin/mock-tests/access-control' },
        { icon: ArrowLeftRight, label: 'Sync Questions', href: '/admin/sync' },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
        { icon: Plus, label: 'Create Quiz', href: '/admin/quizzes/create' },
        { icon: BookOpen, label: 'Knowledge Base', href: '/admin/knowledge-base' },
        { icon: Database, label: 'Manage KB', href: '/admin/knowledge-base/manage' },
        { icon: Flag, label: 'Reported Questions', href: '/admin/reports' },
        { icon: Database, label: 'Firestore Indexes', href: '/admin/indexes' },
      ],
    },
    {
      section: 'ai',
      title: 'AI Intelligence Hub',
      items: [
        { icon: BrainCircuit, label: 'Repeated Questions', href: '/admin/mockquestions/find-repeated' },
        { icon: BrainCircuit, label: 'AI Auto-Tagger', href: '/admin/questions/auto-tagger' },
        { icon: BrainCircuit, label: 'AI Tutor Test', href: '/admin/ai-tutor-test' },
        { icon: BarChart3, label: 'AI Tutor Analytics', href: '/admin/ai-tutor-analytics' },
        { icon: Scissors, label: 'AI Book Splitter', href: '/admin/book-splitter' },
        { icon: Wand2, label: 'AI MCQ Generator', href: '/dashboard/admin/ai-generator' },
      ],
    },
    ...(!isTeacher ? [{
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
  ], [isSuperAdmin, isTeacher, userRole]); // Dependencies

  // Effects
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Expand sections for admin
  useEffect(() => {
    if (isAdminOrTeacher) {
      setExpandedSections(prev => prev.includes('content') ? prev : [...prev, 'content']);
    }
  }, [isAdminOrTeacher]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    if (pathname === href) return true;
    const isDashboardRoot = href === '/dashboard/student' || href === '/dashboard/admin' || href === '/dashboard/teacher';
    if (isDashboardRoot) return false;
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

  // Decide which menu to show
  // Note: Originally `isAdmin` was nullable. Now we derive from store.
  // If user is loading, store `user` is null. 
  // Should we show nothing? Or skeleton?
  // Old code: `if (isAdmin === null) return null;`
  // We can check if user is loaded.
  // user object is null initially.
  // We should wait until we know?
  // But `useUserStore` has `isLoading`.
  // If no user, we might be logged out or loading.
  // Given Sidebar is usually protected, we assume user is present or loading.

  if (!user) return null; // Or return skeleton? null matches old behavior (isAdmin === null)

  const menu = isAdminOrTeacher ? adminMenu : STUDENT_MENU;

  return (
    <>
      <div className="md:hidden fixed top-4 left-4 z-[100]">
        {!mobileOpen && !sidebarTriggerHidden && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6 text-foreground" />
          </Button>
        )}
      </div>

      <div
        className={`fixed top-0 left-0 h-full z-[100] bg-background border-r border-border flex flex-col transition-transform duration-300
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:flex shrink-0`}
      >
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

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {showSignOutDialog && (
        <div className="fixed inset-0 z-[200] bg-black/40 flex items-center justify-center">
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
    </>
  );
}
