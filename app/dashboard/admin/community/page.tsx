'use client';

import { UnifiedHeader } from '@/components/unified-header';
import { ShieldAlert } from 'lucide-react';
import { CommunityFeed } from '@/components/community/CommunityFeed';

function AdminCommunityPage() {
    return (
        <div className="min-h-screen bg-slate-50/[0.6] dark:bg-slate-950">
            <UnifiedHeader
                title="Community Moderation"
                subtitle="Manage discussions, posts, and enforce community guidelines"
                icon={<ShieldAlert className="w-6 h-6" />}
            />
            <div className="max-w-7xl mx-auto p-4 md:p-8">
                <CommunityFeed role="admin" initialShowDeleted={true} />
            </div>
        </div>
    );
}

export default AdminCommunityPage;
