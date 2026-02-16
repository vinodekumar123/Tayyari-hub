'use client';

import { useEffect, useState } from 'react';
import { UnifiedHeader } from '@/components/unified-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, AlertTriangle, ExternalLink, Loader2, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { formatDistanceToNow } from 'date-fns';

interface DetectedIndex {
    id: string;
    createLink: string;
    message: string;
    occurrences: number;
    firstSeen: any;
    lastSeen: any;
    status: 'MISSING' | 'Creating' | 'CREATED';
    path?: string;
    queryInfo?: string;
}

export default function IndexesPage() {
    const [indexes, setIndexes] = useState<DetectedIndex[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const db = getFirestore(app);
        const q = query(collection(db, 'detected_indexes'), orderBy('lastSeen', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as DetectedIndex[];
            setIndexes(data);
            setLoading(false);
        }, (error) => {
            console.error("Failed to subscribe to indexes:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'CREATED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
            case 'Creating': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            default: return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            <UnifiedHeader
                title="Firestore Index Monitor"
                subtitle="Realtime detection of missing composite indexes"
            />

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                <Alert className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-300">
                    <Database className="h-4 w-4" />
                    <AlertTitle>Realtime Monitoring Active</AlertTitle>
                    <AlertDescription>
                        This system automatically captures "Missing Index" errors experienced by users.
                        Click "Create Index" to fix them directly in the Firebase Console.
                    </AlertDescription>
                </Alert>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Detected Missing Indexes
                            <Badge variant="secondary" className="ml-2">{indexes.length}</Badge>
                        </CardTitle>
                        <CardDescription>
                            Recent index errors captured from user sessions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                            </div>
                        ) : indexes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                                <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
                                <h3 className="text-lg font-medium text-slate-900 dark:text-white">All Clear!</h3>
                                <p>No missing index errors detected recently.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-medium">
                                        <tr>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3">Context / Path</th>
                                            <th className="px-6 py-3">Error Details</th>
                                            <th className="px-6 py-3">Occurrences</th>
                                            <th className="px-6 py-3">Last Seen</th>
                                            <th className="px-6 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {indexes.map((idx) => (
                                            <tr key={idx.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <Badge className={`${getStatusColor(idx.status)} border-none`}>
                                                        {idx.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-xs text-slate-500 mb-1">
                                                        {idx.path || 'Unknown Path'}
                                                    </div>
                                                    <div className="font-medium text-slate-900 dark:text-slate-100">
                                                        {idx.queryInfo}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 max-w-xs">
                                                    <p className="truncate text-slate-500 text-xs" title={idx.message}>
                                                        {idx.message}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-900 dark:text-white">
                                                            {idx.occurrences}
                                                        </span>
                                                        <span className="text-xs text-slate-400">times</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3 w-3" />
                                                        {idx.lastSeen?.seconds ? formatDistanceToNow(new Date(idx.lastSeen.seconds * 1000), { addSuffix: true }) : 'Just now'}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button
                                                        size="sm"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                                        asChild
                                                    >
                                                        <a href={idx.createLink} target="_blank" rel="noopener noreferrer">
                                                            Create Index
                                                            <ExternalLink className="ml-2 h-3 w-3" />
                                                        </a>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
