// Server component wrapper - force-dynamic must be in a server component
export const dynamic = 'force-dynamic';

import StudentSettingsPage from './settings-client';

export default function SettingsPage() {
    return <StudentSettingsPage />;
}
