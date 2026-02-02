'use client';

import { useEffect, useState } from 'react';
import { db } from '@/app/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, FileText, User as UserIcon, Calendar, CheckCircle, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { UnifiedHeader } from '@/components/unified-header';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

interface StudentResult {
    id: string; // Attempt ID
    uid: string; // Student User ID
    studentName: string;
    studentEmail: string;
    quizTitle: string;
    score: number;
    total: number;
    submittedAt: any;
    completed: boolean;
}

export default function AdminUserResultsPage() {
    const [results, setResults] = useState<StudentResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const searchParams = useSearchParams();
    const router = useRouter();

    // Optional: Filter by specific student if passed via URL
    const studentIdParam = searchParams.get('studentId');

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                let q;

                // If filtering by specific student, querying is simpler (though users/{id}/quizAttempts is better, 
                // but collectionGroup works too with 'uid' check if we had it indexed, or we filter client side.
                // However, to keep it consistent, let's use collectionGroup and filter. 
                // Note: Better performance would be querying subcollection directly if studentId is present.

                if (studentIdParam) {
                    q = query(
                        collectionGroup(db, 'user-quizattempts'),
                        where('completed', '==', true)
                    );
                } else {
                    q = query(
                        collectionGroup(db, 'user-quizattempts'),
                        where('completed', '==', true),
                        limit(100)
                    );
                }

                const snapshot = await getDocs(q);

                const data: StudentResult[] = [];
                const userCache: Record<string, { name: string, email: string }> = {};

                for (const docSnap of snapshot.docs) {
                    const attempt = docSnap.data() as any; // Cast to any to avoid TS errors
                    const userRef = docSnap.ref.parent.parent;

                    if (!userRef) continue;

                    const uid = userRef.id;

                    // Filter by Student ID if provided
                    if (studentIdParam && uid !== studentIdParam) continue;

                    let userInfo = userCache[uid];

                    if (!userInfo) {
                        try {
                            const userDoc = await getDoc(userRef);
                            if (userDoc.exists()) {
                                const uData = userDoc.data();
                                userInfo = {
                                    name: uData.fullName || 'Unknown Student',
                                    email: uData.email || 'No Email'
                                };
                            } else {
                                userInfo = { name: 'Deleted User', email: '-' };
                            }
                            userCache[uid] = userInfo;
                        } catch (e) {
                            console.error(`Failed to fetch user ${uid}`, e);
                            userInfo = { name: 'Error', email: '-' };
                        }
                    }

                    data.push({
                        id: docSnap.id,
                        uid: uid,
                        studentName: userInfo.name,
                        studentEmail: userInfo.email,
                        quizTitle: attempt.title || 'Untitled Quiz',
                        score: attempt.score || 0,
                        total: attempt.total || 0,
                        submittedAt: attempt.submittedAt,
                        completed: attempt.completed
                    });
                }

                // Client-side sort
                data.sort((a, b) => {
                    const tA = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
                    const tB = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
                    return tB - tA;
                });

                setResults(data);

            } catch (error) {
                console.error("Error fetching admin results:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [studentIdParam]);

    const filteredResults = results.filter(r =>
        r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.quizTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.studentEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 pb-20">
            <UnifiedHeader
                studentName="Admin"
                subtitle="Review student-created mock test results."
                greeting={false}
            />

            <div className="container mx-auto p-6 max-w-7xl space-y-8">

                {/* Header & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            {studentIdParam && (
                                <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8 -ml-2">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            )}
                            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
                                <FileText className="h-8 w-8 text-indigo-600" />
                                {studentIdParam ? 'Student Mock Results' : 'User Quiz Results'}
                            </h1>
                        </div>
                        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
                            {studentIdParam ? `Showing mock tests for this student.` : 'Monitoring performance on self-assigned mock tests.'}
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <Input
                                placeholder="Search by quiz title..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Results List */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 text-neutral-400">Loading results...</div>
                    ) : filteredResults.length === 0 ? (
                        <div className="text-center py-20 text-neutral-400 bg-white dark:bg-neutral-800 rounded-xl border border-dashed">
                            No results found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {filteredResults.map((result) => (
                                <Card key={result.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-0">
                                        <div className="flex flex-col md:flex-row items-center p-4 gap-4">

                                            {/* Student Info (Hide if filtering by student) */}
                                            {!studentIdParam && (
                                                <div className="flex items-center gap-4 min-w-[250px]">
                                                    <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold px-2 shrink-0">
                                                        {result.studentName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">{result.studentName}</p>
                                                        <p className="text-xs text-neutral-500">{result.studentEmail}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Quiz Info */}
                                            <div className={`flex-1 ${!studentIdParam ? 'border-l border-neutral-200 dark:border-neutral-800 pl-4 md:pl-8' : ''}`}>
                                                <p className="font-medium text-neutral-800 dark:text-neutral-200">{result.quizTitle}</p>
                                                <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {result.submittedAt?.toDate ? format(result.submittedAt.toDate(), 'PPP p') : 'Unknown Date'}
                                                </div>
                                            </div>

                                            {/* Score & Actions */}
                                            <div className="flex items-center gap-6 pr-4">
                                                <div className="text-right">
                                                    <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Score</p>
                                                    <p className={`text-2xl font-bold ${(result.score / result.total) >= 0.7 ? 'text-emerald-600' :
                                                        (result.score / result.total) >= 0.4 ? 'text-amber-600' : 'text-red-500'
                                                        }`}>
                                                        {result.score}/{result.total}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={result.completed ? "default" : "secondary"} className={result.completed ? "bg-emerald-600" : ""}>
                                                        {result.completed ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                                    </Badge>

                                                    <Link href={`/admin/students/user-responses?id=${result.id}&studentId=${result.uid}`}>
                                                        <Button variant="outline" size="sm" className="gap-2">
                                                            View Analysis
                                                            <ArrowRight className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>

                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
