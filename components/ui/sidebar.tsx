'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen, Users, Trophy, BarChart3, Settings, Plus,
  Database, Home, ChevronDown, ChevronRight, LogOut
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(['main']);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

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
        { icon: Database, label: 'Question Bank', href: '/admin/questions/questionbank' },
        { icon: Plus, label: 'Add Question', href: '/admin/questions/create' },
        { icon: Trophy, label: 'Quizzes', href: '/admin/quizzes/quizebank' },
        { icon: Plus, label: 'Create Quiz', href: '/admin/quizzes/create' },
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
        { icon: Settings, label: 'Settings', href: '/admin/settings' },
      ]
    }
  ];

  const isActive = (href: string) => pathname.startsWith(href);

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
            <p className="text-sm text-gray-500">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {adminMenuItems.map((section) => (
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
