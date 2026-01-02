'use client';

import { Sidebar } from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto h-full">
        {children}
      </main>
    </div>
  )
}
