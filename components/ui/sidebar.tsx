'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Users, Trophy, BarChart3, Settings, Plus,
  Database, Home, ChevronDown, ChevronRight, LogOut,
  ClipboardList, UserCircle, Menu, X, FileBarChart
} from 'lucide-react';
import logo from "../../app/assets/logo.png";
import Image from "next/image";
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../app/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

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

  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Memoized menu configs for perf
  const adminMenu = useMemo(() => [
    {
      section: 'main',
      title: 'Admin Dashboard',
      items: [{ icon: Home, label: 'Dashboard', href: '/dashboard/admin' }],
    },
    {
      section: 'content',
      title: 'Content Management',
      items: [
        { icon: BookOpen, label: 'Courses', href: '/admin/courses' },
        { icon: Database, label: 'Question Bank', href: '/admin/questions/questionbank' },
        { icon: Plus, label: 'Add Question', href: '/admin/questions/create' },
        { icon: Database, label: 'Mock Questions', href: '/admin/mockquestions/questionbank' },
        { icon: Plus, label: 'Add Mock Question', href: '/admin/mockquestions/create' },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
        { icon: Plus, label: 'Create Quiz', href: '/admin/quizzes/create' },
      ],
    },
    {
      section: 'users',
      title: 'User Management',
      items: [
        { icon: Users, label: 'Students', href: '/admin/students' },
        { icon: FileBarChart, label: 'Results', href: '/admin/results' },
      ],
    },
    {
      section: 'settings',
      title: 'Admin Profile',
      items: [{ icon: Settings, label: 'Settings', href: '/admin/settings' }],
    },
  ], []);

  const studentMenu = useMemo(() => [
    {
      section: 'student',
      title: 'Student Panel',
      items: [
        { icon: Home, label: 'Dashboard', href: '/dashboard/student' },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
        { icon: ClipboardList, label: 'Results', href: '/admin/students/results' },
        { icon: UserCircle, label: 'Profile Settings', href: '/admin/student-profile' },
      ],
    },
  ], []);

  // Fetch user role and expand all sections by role
  useEffect(() => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          const isAdminUser = data.admin === true;
          setIsAdmin(isAdminUser);
          setExpandedSections(
            (isAdminUser ? adminMenu : studentMenu).map((section) => section.section)
          );
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, [adminMenu, studentMenu]);

  // Memoized active link checker
  const isActive = useCallback(
    (href?: string) => !!href && pathname.startsWith(href),
    [pathname]
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  // Sidebar collapse toggle, persists in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);
  const handleCollapse = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const handleSignOut = async () => {
    const auth = getAuth(app);
    await signOut(auth);
    router.push('/');
  };

  if (isAdmin === null) return null;
  const menu = isAdmin ? adminMenu : studentMenu;

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        {!mobileOpen && (
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6 text-gray-800" />
          </Button>
        )}
      </div>

      {/* Sidebar */}
      <motion.div
        initial={{ x: -280 }}
        animate={{ x: mobileOpen || !collapsed ? 0 : -280 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className={`fixed top-0 left-0 h-full z-50 bg-white border-r border-gray-200 flex flex-col 
          shadow-xl transition-all duration-300
          ${collapsed ? 'w-16' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:flex`}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-gradient-to-r from-purple-50 to-blue-50">
          {!collapsed ? (
            <div className="flex items-center space-x-3">
              <Image src={logo} alt="Tayyari Hub Logo" className="h-10 w-auto" width={40} height={40} priority />
              <span className="font-extrabold text-lg text-purple-900">Tayyari Hub</span>
            </div>
          ) : (
            <BookOpen className="h-7 w-7 text-purple-700" />
          )}
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={handleCollapse} aria-label="Collapse sidebar">
              {collapsed ? <ChevronRight /> : <ChevronLeft />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="md:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-8">
          {menu.map((section, i) => (
            <div key={section.section} className="mb-2">
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.section)}
                  aria-expanded={expandedSections.includes(section.section)}
                  className="flex items-center justify-between w-full text-left text-sm font-bold text-gray-900 mb-2 focus:outline-none"
                >
                  <span>{section.title}</span>
                  <motion.span
                    animate={{ rotate: expandedSections.includes(section.section) ? 180 : 0 }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.span>
                </button>
              )}

              <AnimatePresence initial={false}>
                {(expandedSections.includes(section.section) || collapsed) && (
                  <motion.div
                    key={section.section}
                    initial="collapsed"
                    animate="open"
                    exit="collapsed"
                    variants={{
                      open: { opacity: 1, height: 'auto' },
                      collapsed: { opacity: 0, height: 0 }
                    }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="space-y-1"
                  >
                    {section.items.map((item) => (
                      <Link key={item.href} href={item.href!} tabIndex={0}>
                        <div
                          className={`relative flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer 
                            transition-all duration-200 group
                            ${isActive(item.href)
                            ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 shadow'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                            ${collapsed ? "justify-center" : ""}
                          `}
                        >
                          <motion.div
                            whileHover={{ scale: 1.18 }}
                            whileTap={{ scale: 0.94 }}
                            className="relative"
                          >
                            <item.icon
                              className={`h-5 w-5 ${isActive(item.href) ? 'text-purple-800' : 'text-gray-400 group-hover:text-gray-600'}`}
                            />
                            {/* Tooltip when collapsed */}
                            {collapsed && (
                              <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 pointer-events-none z-20
                                bg-white border border-gray-200 shadow-lg px-2 py-1 rounded text-xs text-gray-800 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {item.label}
                              </span>
                            )}
                          </motion.div>
                          {!collapsed && (
                            <span className="font-semibold text-base">{item.label}</span>
                          )}
                          {!collapsed && item.badge && (
                            <Badge variant="secondary" className="text-xs ml-auto">{item.badge}</Badge>
                          )}
                          {/* Animated indicator for active link */}
                          {isActive(item.href) && (
                            <motion.div
                              layoutId="activeSidebarIndicator"
                              className="absolute left-0 top-0 h-full w-1 bg-purple-600 rounded-r"
                              initial={{ width: 0 }}
                              animate={{ width: 4 }}
                              transition={{ type: "spring", stiffness: 240, damping: 20 }}
                            />
                          )}
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Section divider */}
              {i < menu.length - 1 && <div className="my-2 border-t border-gray-100" />}
            </div>
          ))}

          {/* Sign Out */}
          <div
            onClick={() => setShowSignOutDialog(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer 
              transition-all duration-200 text-gray-600 hover:bg-red-100 hover:text-red-700
              mt-8"
            tabIndex={0}
            role="button"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5 text-red-500 group-hover:text-red-700" />
            {!collapsed && <span className="font-semibold text-base">Sign Out</span>}
          </div>
        </nav>
      </motion.div>

      {/* Backdrop with blur for mobile */}
      {mobileOpen && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sign Out Dialog */}
      <AnimatePresence>
        {showSignOutDialog && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
            >
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
