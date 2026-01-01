'use client';

import { Sidebar } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto h-screen">
        {children}
      </main>
    </div>
  )
}
