'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, Users, Trophy, BarChart3, Settings, Plus,
  Database, Home, ChevronDown, ChevronRight, LogOut,
  ClipboardList, UserCircle, Menu, X,
  FileBarChart
} from 'lucide-react';

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../app/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type MenuItem = {
  icon: React.ElementType;
  label: string;
  href: string;
  badge?: string | null;
};

type Section = {
  section: string;
  title: string;
  items: MenuItem[];
};

export function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(['main']);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setIsAdmin(data.admin === true);
        } else {
          setIsAdmin(false); // fallback to student if no user doc
        }
      } else {
        setIsAdmin(false); // not logged in
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const toggleCollapse = () => setCollapsed(prev => !prev);
  const isActive = (href: string) => pathname.includes(href);

  const adminMenu: Section[] = [
    {
      section: 'main',
      title: 'Admin Dashboard',
      items: [
        { icon: Home, label: 'Dashboard', href: '/dashboard/admin' },
      ]
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
      ]
    },
    {
      section: 'users',
      title: 'User Management',
      items: [
        { icon: Users, label: 'Students', href: '/admin/students' },
                { icon: FileBarChart, label: 'Results', href: '/admin/results' }

      ]
    },
    {
      section: 'settings',
      title: 'Admin Profile',
      items: [
        { icon: Settings, label: 'Settings', href: '/admin/settings' }
      ]
    },
  ];

  const studentMenu: Section[] = [
    {
      section: 'student',
      title: 'Student Panel',
      items: [
        { icon: Home, label: 'Dashboard', href: '/dashboard/student' },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
        { icon: Trophy, label: 'Mock Quizzes', href: '/admin/mockquize/quizebank' },
        { icon: Plus, label: 'Create Mock Quiz', href: '/admin/mockquize/create' },
        { icon: ClipboardList, label: 'Results', href: '/admin/students/results' },
        
        { icon: UserCircle, label: 'Profile Settings', href: '/admin/student-profile' },
      ]
    }
  ];

  // ⏳ Wait until role is loaded
  if (isAdmin === null) return null;

  const menu = isAdmin ? adminMenu : studentMenu;

  return (
    <>
      <div className="md:hidden p-4">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:flex`}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Tayyari Hub</h1>
                <p className="text-sm text-gray-500">Sidebar Panel</p>
              </div>
            </div>
          ) : (
            <BookOpen className="h-6 w-6 text-purple-700" />
          )}

          <div className="flex space-x-2">
            <Button variant="ghost" size="icon" onClick={toggleCollapse}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="md:hidden">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Nav */}
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
                    <Link key={item.href} href={item.href}>
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
        </nav>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            className={`w-full justify-start text-gray-600 hover:text-red-600 ${collapsed ? 'px-2' : ''}`}
          >
            <LogOut className="h-5 w-4 mr-2" />
            {!collapsed && 'Sign Out'}
          </Button>
        </div>
      </div>

      {/* Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
