'use client';

import { useEffect, useState } from 'react';
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

  const adminMenu: Section[] = [
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
  ];

  const studentMenu: Section[] = [
    {
      section: 'student',
      title: 'Student Panel',
      items: [
        { icon: Home, label: 'Dashboard', href: '/dashboard/student' },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
       // { icon: Trophy, label: 'Your Quizzes', href: '/admin/mockquize/quizebank' },
      //  { icon: Plus, label: 'Create Your Own Quiz (Coming Soon)', href: '/dashboard/student' },
        { icon: ClipboardList, label: 'Results', href: '/admin/students/results' },
        { icon: UserCircle, label: 'Profile Settings', href: '/admin/student-profile' },
      ],
    },
  ];

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
          const roleMenu = isAdminUser ? adminMenu : studentMenu;
          setExpandedSections(roleMenu.map((section) => section.section)); // ✅ Expand all sections initially
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const isActive = (href?: string) => href && pathname.includes(href);

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
      <div
        className={`fixed top-0 left-0 h-full z-50 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300
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
                className={`flex items-center justify-between w-full text-left text-sm font-semibold text-gray-900 mb-3 ${collapsed ? 'hidden' : 'block'}`}
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
                    <Link key={item.href} href={item.href!}>
                      <div
                        className={`flex items-center justify-between px-3 py-2 rounded-sm text-sm transition-all duration-200 group ${
                          isActive(item.href)
                            ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon
                            className={`h-10 w-5 ${
                              isActive(item.href)
                                ? 'text-purple-800'
                                : 'text-gray-400 group-hover:text-gray-600'
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
            className="flex items-center justify-between px-3 py-2 rounded-sm text-sm cursor-pointer transition-all duration-200 text-gray-600 hover:bg-red-100 hover:text-red-700"
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
    </>
  );
}
