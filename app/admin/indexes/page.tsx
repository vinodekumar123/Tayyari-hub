'use client';

import { UnifiedHeader } from '@/components/unified-header';
import indexesData from '../../../firestore.indexes.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function IndexesPage() {
    const indexes = indexesData.indexes || [];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            <UnifiedHeader
                title="Firestore Indexes"
                subtitle="Manage database composite indexes"
            />

            <div className="max-w-6xl mx-auto p-6 space-y-6">
                <Alert className="bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-300">
                    <Database className="h-4 w-4" />
                    <AlertTitle>Index Configuration</AlertTitle>
                    <AlertDescription>
                        These indexes are defined in <code className="bg-black/10 px-1 rounded">firestore.indexes.json</code>.
                        They are deployed automatically with <code className="bg-black/10 px-1 rounded">firebase deploy</code>.
                        If you encounter "Missing Index" errors in the app, use the links provided in the error alerts to create them, then run <code className="bg-black/10 px-1 rounded">firebase firestore:indexes &gt; firestore.indexes.json</code> to save them here.
                    </AlertDescription>
                </Alert>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-slate-500" />
                            Defined Indexes
                            <Badge variant="secondary" className="ml-2">{indexes.length}</Badge>
                        </CardTitle>
                        <CardDescription>Composite indexes currently configured for this project.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="border-t">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 font-medium">
                                    <tr>
                                        <th className="px-6 py-3">Collection Group</th>
                                        <th className="px-6 py-3">Fields & Order</th>
                                        <th className="px-6 py-3">Query Scope</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {indexes.map((idx, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{idx.collectionGroup}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {idx.fields.map((field, j) => (
                                                        <Badge key={j} variant="outline" className="font-mono text-xs bg-white dark:bg-slate-900">
                                                            {field.fieldPath}
                                                            <span className={`ml-1.5 font-bold ${field.order === 'ASCENDING' ? 'text-emerald-600 dark:text-emerald-500' :
                                                                field.order === 'DESCENDING' ? 'text-amber-600 dark:text-amber-500' :
                                                                    'text-indigo-600 dark:text-indigo-500'
                                                                }`}>
                                                                {field.order === 'DESCENDING' ? '↓' : field.order === 'ASCENDING' ? '↑' : '[]'}
                                                            </span>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{idx.queryScope}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
