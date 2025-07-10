// app/admin/layout.tsx

'use client';

import { Sidebar } from '@/components/ui/sidebar';
import { useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [userRole, setUserRole] = useState<'admin'>('admin');

  const handleRoleSwitch = (newRole: 'admin') => {
    setUserRole(newRole);
  };

  return (
    <div className="flex h-screen">
      <Sidebar userRole={userRole} onRoleSwitch={handleRoleSwitch} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
    </div>
  );
}
