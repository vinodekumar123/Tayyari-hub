// Server component wrapper - force-dynamic must be in a server component
export const dynamic = 'force-dynamic';

import UnifiedResultsPage from './results-client';

export default function ResultsPage() {
    return <UnifiedResultsPage />;
}
