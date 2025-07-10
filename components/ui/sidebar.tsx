'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  Users, 
  Trophy, 
  BarChart3, 
  Settings,
  Plus,
  FileText,
  Calendar,
  User,
  LogOut,
  Home,
  Brain,
  Target,
  Award,
  Shield,
  Database,
  UserPlus,
  BookMarked,
  PieChart,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  userRole: 'student' | 'admin';
  onRoleSwitch: (role: 'student' | 'admin') => void;
}

export function Sidebar({ userRole, onRoleSwitch }: SidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(['main']);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const studentMenuItems = [
    {
      section: 'main',
      title: 'Main',
      items: [
        { icon: Home, label: 'Dashboard', href: '/dashboard/student', badge: null },
        { icon: Trophy, label: 'Available Quizzes', href: '/quiz/available', badge: '5' },
        { icon: Clock, label: 'Active Quizzes', href: '/quiz/active', badge: '2' },
        { icon: CheckCircle, label: 'Completed Quizzes', href: '/quiz/completed', badge: null },
      ]
    },
    {
      section: 'practice',
      title: 'Practice',
      items: [
        { icon: Brain, label: 'Mock Tests', href: '/quiz/create-mock', badge: null },
        { icon: Target, label: 'Subject Practice', href: '/practice/subjects', badge: null },
        { icon: BookMarked, label: 'Chapter Tests', href: '/practice/chapters', badge: null },
      ]
    },
    {
      section: 'progress',
      title: 'Progress',
      items: [
        { icon: BarChart3, label: 'Analytics', href: '/student/analytics', badge: null },
        { icon: Award, label: 'Achievements', href: '/student/achievements', badge: '3' },
        { icon: PieChart, label: 'Performance', href: '/student/performance', badge: null },
      ]
    },
    {
      section: 'account',
      title: 'Account',
      items: [
        { icon: User, label: 'Profile', href: '/student/profile', badge: null },
        { icon: Settings, label: 'Settings', href: '/student/settings', badge: null },
      ]
    }
  ];

  const adminMenuItems = [
    {
      section: 'main',
      title: 'Main',
      items: [
        { icon: Home, label: 'Dashboard', href: '/dashboard/admin', badge: null },
        { icon: BarChart3, label: 'Analytics', href: '/admin/analytics', badge: null },
      ]
    },
    {
      section: 'content',
      title: 'Content Management',
      items: [
        { icon: BookOpen, label: 'Courses', href: '/admin/courses', badge: null },
        { icon: Database, label: 'Question Bank', href: '/admin/questions/questionbank'},
        { icon: Plus, label: 'Add Question', href: '/admin/questions/create', badge: null },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
        { icon: Plus, label: 'Create Quiz', href: '/admin/quizzes/create', badge: null },
      ]
    },
    {
      section: 'users',
      title: 'User Management',
      items: [
        { icon: Users, label: 'Students', href: '/admin/students' },
      ]
    },
    {
      section: 'system',
      title: 'Profile',
      items: [
        { icon: Settings, label: 'Settings', href: '/admin/settings', badge: null },
      ]
    }
  ];

  const menuItems = userRole === 'student' ? studentMenuItems : adminMenuItems;

  const isActive = (href: string) => {
    if (href === '/dashboard/student' || href === '/dashboard/admin') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tayyari Hub</h1>
            <p className="text-sm text-gray-500">Learning Made Easy</p>
          </div>
        </div>
        
        {/* Role Switcher */}
        <div className="flex items-center space-x-2">
          <Button
            variant={userRole === 'student' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onRoleSwitch('student')}
            className="flex-1"
          >
            <User className="h-4 w-4 mr-1" />
            Student
          </Button>
          <Button
            variant={userRole === 'admin' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onRoleSwitch('admin')}
            className="flex-1"
          >
            <Shield className="h-4 w-4 mr-1" />
            Admin
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {menuItems.map((section) => (
            <div key={section.section}>
              <button
                onClick={() => toggleSection(section.section)}
                className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-900 mb-3 hover:text-purple-600 transition-colors"
              >
                <span>{section.title}</span>
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
                      <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 group ${
                        isActive(item.href)
                          ? 'bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}>
                        <div className="flex items-center space-x-3">
                          <item.icon className={`h-4 w-4 ${
                            isActive(item.href) ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-600'
                          }`} />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {item.badge && (
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
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
     
        <Button variant="ghost" size="sm" className="w-full justify-start text-gray-600 hover:text-red-600">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}