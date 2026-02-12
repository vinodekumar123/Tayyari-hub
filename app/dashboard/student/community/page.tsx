'use client';

import { UnifiedHeader } from '@/components/unified-header';
import { Users } from 'lucide-react';
import { CommunityFeed } from '@/components/community/CommunityFeed';

function StudentCommunityPage() {
    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950">
            <UnifiedHeader
                title="Student Community"
                subtitle="Ask doubts, share knowledge, and learn together"
                icon={<Users className="w-6 h-6" />}
            />
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <CommunityFeed role="student" />
            </div>
        </div>
    );
}

export default StudentCommunityPage;
