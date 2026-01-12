'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Student } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, Crown, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { glassmorphism } from '@/lib/design-tokens';
import { useUserStore } from '@/stores/useUserStore';
import { UnifiedHeader } from '@/components/unified-header';

interface LeaderboardEntry extends Student {
    rank: number;
    totalScore: number;
    accuracy: number;
    quizzesTaken: number;
}

export default function LeaderboardPage() {
    const { user } = useUserStore();
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRank, setUserRank] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboard = useCallback(async () => {
        try {
            setLoading(true);
            // OPTIMIZATION: Server-side sorting and limiting
            // This requires a composite index on [role, stats.totalScore].
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('role', '==', 'student'),
                orderBy('stats.totalScore', 'desc'),
                limit(50)
            );

            const snap = await getDocs(q);

            const fetchedLeaders = snap.docs.map((d, idx) => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    totalScore: data.stats?.totalScore || 0,
                    accuracy: data.stats?.overallAccuracy || 0,
                    quizzesTaken: data.stats?.totalQuizzes || 0,
                    rank: idx + 1
                } as LeaderboardEntry;
            });

            setLeaders(fetchedLeaders);

            if (user) {
                // Check if user is in the fetched top 50
                const myEntry = fetchedLeaders.find(s => s.uid === user.uid);
                if (myEntry) {
                    setUserRank(myEntry.rank);
                } else {
                    setUserRank(null);
                }
            }

        } catch (error) {
            console.error('Leaderboard fetch error', error);
            setError('Failed to load leaderboard. Please check your connection or try again later.');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500" />;
        if (rank === 2) return <Medal className="h-6 w-6 text-gray-400 fill-gray-400" />;
        if (rank === 3) return <Medal className="h-6 w-6 text-amber-700 fill-amber-700" />; // Bronze
        return <span className="font-bold text-muted-foreground">#{rank}</span>;
    };

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
            <UnifiedHeader
                title="Hall of Fame"
                subtitle="Top performers across all series. Keep learning, keep climbing!"
                icon={<Trophy className="w-6 h-6" />}
            />

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* User Rank Card */}
            {user && userRank && (
                <Card className="bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white border-none shadow-xl transform hover:scale-[1.02] transition-all">
                    <CardContent className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-white/50">
                                <AvatarFallback className="bg-white/20 text-white text-xl">
                                    {user.fullName?.[0]}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="text-indigo-100 font-medium">Your Current Rank</p>
                                <h2 className="text-3xl font-black">#{userRank}</h2>
                            </div>
                        </div>
                        <div className="text-right hidden sm:block">
                            <p className="text-indigo-100">Total Score</p>
                            <p className="text-2xl font-bold">{leaders.find(l => l.uid === user.uid)?.totalScore || 0}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Leaderboard Table */}
            <Card className="overflow-hidden border-none shadow-xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl">
                <CardHeader className="bg-muted/30 pb-4">
                    <CardTitle>Top 50 Students</CardTitle>
                    <CardDescription>Rankings are updated in real-time based on total quiz scores.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[100px] text-center">Rank</TableHead>
                                <TableHead>Student</TableHead>
                                <TableHead className="text-right">Quizzes</TableHead>
                                <TableHead className="text-right">Accuracy</TableHead>
                                <TableHead className="text-right pr-6">Total Score</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={`skeleton-${i}`}>
                                        <TableCell className="text-center">
                                            <Skeleton className="h-8 w-8 rounded-full mx-auto" />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="h-10 w-10 rounded-full" />
                                                <div className="flex flex-col gap-2">
                                                    <Skeleton className="h-4 w-32" />
                                                    <Skeleton className="h-3 w-16" />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-4 w-12 ml-auto" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-7 w-16 ml-auto rounded-md" />
                                        </TableCell>
                                        <TableCell>
                                            <Skeleton className="h-6 w-12 ml-auto" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : leaders.length === 0 && !loading && !error ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <Trophy className="h-12 w-12 text-muted-foreground/30" />
                                            <p className="text-lg font-medium">No champions yet!</p>
                                            <p className="text-sm">Be the first to take a quiz and climb the ranks.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                leaders.map((student) => (
                                    <TableRow key={student.id} className={`group hover:bg-muted/50 transition-colors ${student.uid === user?.uid ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                        <TableCell className="font-bold text-center text-lg">
                                            <div className="flex justify-center">{getRankIcon(student.rank)}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border-2 border-background group-hover:border-indigo-200 transition-colors">
                                                    <AvatarImage src={student.profileImage} />
                                                    <AvatarFallback className="font-bold bg-indigo-100 text-indigo-700">
                                                        {student.fullName?.[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className={`font-bold ${student.uid === user?.uid ? 'text-indigo-600 dark:text-indigo-400' : ''}`}>
                                                        {student.fullName}
                                                    </span>
                                                    {student.uid === user?.uid && <span className="text-[10px] text-muted-foreground">You</span>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-muted-foreground">{student.quizzesTaken}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            <span className={`px-2 py-1 rounded-md ${student.accuracy >= 80 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {student.accuracy}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right pr-6 font-black text-lg text-foreground">
                                            {student.totalScore}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}


                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
