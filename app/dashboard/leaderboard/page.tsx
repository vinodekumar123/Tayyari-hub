'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Student } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, Crown, AlertCircle, Search, TrendingUp, Target, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUserStore } from '@/stores/useUserStore';
import { UnifiedHeader } from '@/components/unified-header';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderboardEntry extends Student {
    rank: number;
    totalScore: number;
    accuracy: number;
    quizzesTaken: number;
    grandTotalScore?: number;
    grandAccuracy?: number;
}

export default function LeaderboardPage() {
    const { user } = useUserStore();
    const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
    const [filteredLeaders, setFilteredLeaders] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRank, setUserRank] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchLeaderboard = useCallback(async () => {
        try {
            setLoading(true);
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('role', '==', 'student'),
                orderBy('stats.grandTotalScore', 'desc'),
                limit(50)
            );

            const snap = await getDocs(q);

            const fetchedLeaders = snap.docs.map((d, idx) => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    totalScore: data.stats?.grandTotalScore || data.stats?.totalScore || 0,
                    accuracy: data.stats?.grandAccuracy || data.stats?.overallAccuracy || 0,
                    quizzesTaken: (data.stats?.totalQuizzes || 0) + (data.stats?.totalMockQuizzes || 0),
                    rank: idx + 1
                } as LeaderboardEntry;
            });

            setLeaders(fetchedLeaders);
            setFilteredLeaders(fetchedLeaders);

            if (user) {
                const myEntry = fetchedLeaders.find(s => s.uid === user.uid);
                setUserRank(myEntry ? myEntry.rank : null);
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

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredLeaders(leaders);
        } else {
            const queryLower = searchQuery.toLowerCase();
            setFilteredLeaders(leaders.filter(l =>
                l.fullName?.toLowerCase().includes(queryLower) ||
                l.email?.toLowerCase().includes(queryLower)
            ));
        }
    }, [searchQuery, leaders]);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Crown className="h-6 w-6 text-yellow-400 fill-yellow-400 drop-shadow-md" />;
        if (rank === 2) return <Medal className="h-6 w-6 text-slate-300 fill-slate-300 drop-shadow-md" />;
        if (rank === 3) return <Medal className="h-6 w-6 text-amber-600 fill-amber-600 drop-shadow-md" />;
        return <span className="font-bold text-muted-foreground w-6 text-center">#{rank}</span>;
    };

    const getRowStyle = (rank: number, isCurrentUser: boolean) => {
        let base = "transition-all duration-200 border-b border-border last:border-0 hover:bg-muted/50 ";
        if (isCurrentUser) return base + "bg-primary/10 border-l-4 border-l-primary";
        if (rank === 1) return base + "bg-yellow-500/5 hover:bg-yellow-500/10";
        if (rank === 2) return base + "bg-slate-500/5 hover:bg-slate-500/10";
        if (rank === 3) return base + "bg-amber-500/5 hover:bg-amber-500/10";
        return base;
    };

    const Podium = () => {
        if (leaders.length < 3) return null;
        const [first, second, third] = leaders;

        const PodiumItem = ({ student, position, color, delay }: { student: LeaderboardEntry, position: number, color: string, delay: number }) => (
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay }}
                className="flex flex-col items-center relative z-10"
            >
                <div className="relative mb-3">
                    <div className={`absolute inset-0 rounded-full blur-xl opacity-40 bg-${color}-500/50`}></div>
                    <Avatar className={`h-20 w-20 md:h-24 md:w-24 border-4 border-${color}-500 shadow-xl`}>
                        <AvatarImage src={student.profileImage} />
                        <AvatarFallback className={`bg-${color}-100 text-${color}-700 font-bold text-2xl`}>
                            {student.fullName?.[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 bg-${color}-500 text-white rounded-full p-1 shadow-lg`}>
                        {position === 1 ? <Crown size={16} fill="currentColor" /> : <span className="text-xs font-bold px-1">#{position}</span>}
                    </div>
                </div>
                <div className="text-center">
                    <p className="font-bold text-foreground truncate max-w-[120px]">{student.fullName}</p>
                    <p className={`text-sm font-medium text-${color}-400`}>{student.totalScore} pts</p>
                </div>
            </motion.div>
        );

        return (
            <div className="flex justify-center items-end gap-4 md:gap-12 py-8 mb-8 relative">
                {/* Spotlight Effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-lg bg-gradient-to-b from-primary/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

                {/* 2nd Place */}
                <div className="order-1 md:order-1 mb-4">
                    <PodiumItem student={second} position={2} color="slate" delay={0.2} />
                </div>

                {/* 1st Place */}
                <div className="order-2 md:order-2 mb-12 transform scale-110">
                    <PodiumItem student={first} position={1} color="yellow" delay={0} />
                </div>

                {/* 3rd Place */}
                <div className="order-3 md:order-3 mb-0">
                    <PodiumItem student={third} position={3} color="amber" delay={0.4} />
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Unified Header with custom background blending */}
            <div className="relative z-10">
                <UnifiedHeader
                    title="Hall of Fame"
                    subtitle="Competing for glory. Learning for life."
                    icon={<Trophy className="w-6 h-6 text-yellow-400" />}
                />
            </div>

            {/* Background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]"></div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-8 relative z-10 mt-6">

                {error && (
                    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                        <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-900/50 text-red-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}

                {/* Loading State */}
                {loading ? (
                    <div className="space-y-6">
                        <Skeleton className="h-64 w-full rounded-3xl bg-muted" />
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-20 w-full rounded-xl bg-muted" />
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Podium Section (Desktop Only mainly, but visible on mobile nicely scaled) */}
                        {!searchQuery && leaders.length >= 3 && <Podium />}

                        {/* Search & Stats Bar */}
                        <div className="flex flex-col md:flex-row gap-4 mb-6 sticky top-20 z-40 bg-background/80 backdrop-blur-md p-4 rounded-2xl border border-border shadow-sm">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                <Input
                                    placeholder="Search for a student..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-muted/50 border-input text-foreground placeholder:text-muted-foreground focus:ring-primary"
                                />
                            </div>

                            {/* User Mini Stat (Mobile sticky fallback or additional info) */}
                            {user && userRank && (
                                <div className="flex items-center gap-4 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-primary font-bold uppercase tracking-wider">Your Rank</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-lg font-black text-primary">#{userRank}</span>
                                        </div>
                                    </div>
                                    <div className="h-8 w-[1px] bg-primary/20"></div>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-primary font-bold uppercase tracking-wider">Score</span>
                                        <span className="text-lg font-bold text-foreground">{leaders.find(l => l.uid === user.uid)?.totalScore || 0}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Mobile: Card View */}
                        <div className="md:hidden space-y-4">
                            {filteredLeaders.map((student, index) => (
                                <motion.div
                                    key={student.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.2, delay: index * 0.05 }}
                                >
                                    <div className={`rounded-xl border shadow-lg backdrop-blur-xl ${student.uid === user?.uid ? 'bg-primary/10 border-primary/50' : 'bg-card/50 border-border'}`}>
                                        <div className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center justify-center w-8">
                                                    {getRankIcon(student.rank)}
                                                </div>
                                                <Avatar className="h-12 w-12 border-2 border-border/50">
                                                    <AvatarImage src={student.profileImage} />
                                                    <AvatarFallback>{student.fullName?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h3 className={`font-bold ${student.uid === user?.uid ? 'text-primary' : 'text-foreground'}`}>
                                                        {student.fullName}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">{student.quizzesTaken} Quizzes • {student.accuracy}% Acc</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-xl font-black text-foreground">{student.totalScore}</span>
                                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Points</span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {filteredLeaders.length === 0 && (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p>No students found matching &quot;{searchQuery}&quot;</p>
                                </div>
                            )}
                        </div>

                        {/* Desktop: Table View */}
                        <div className="hidden md:block rounded-2xl overflow-hidden border border-border bg-card/40 backdrop-blur-xl shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b border-border hover:bg-transparent">
                                        <TableHead className="w-[80px] text-center text-muted-foreground font-bold">Rank</TableHead>
                                        <TableHead className="text-muted-foreground font-bold">Student</TableHead>
                                        <TableHead className="text-right text-muted-foreground font-bold">Quizzes</TableHead>
                                        <TableHead className="text-right text-muted-foreground font-bold">Accuracy</TableHead>
                                        <TableHead className="text-right pr-8 text-muted-foreground font-bold">Total Score</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>

                                    {filteredLeaders.map((student, index) => (
                                        <motion.tr
                                            key={student.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ duration: 0.3, delay: index * 0.03 }}
                                            className={getRowStyle(student.rank, student.uid === user?.uid)}
                                        >
                                            <TableCell className="text-center py-4">
                                                <div className="flex justify-center items-center">{getRankIcon(student.rank)}</div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border border-border/50">
                                                        <AvatarImage src={student.profileImage} />
                                                        <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                                                            {student.fullName?.[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className={`font-medium ${student.uid === user?.uid ? 'text-primary' : 'text-foreground'}`}>
                                                            {student.fullName}
                                                        </span>
                                                        {student.uid === user?.uid && <Badge variant="secondary" className="w-fit text-[10px] h-4 px-1 mt-1 bg-primary/20 text-primary pointer-events-none">YOU</Badge>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-4 text-muted-foreground font-medium">
                                                <div className="flex items-center justify-end gap-2">
                                                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                                                    {student.quizzesTaken}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Target className="w-4 h-4 text-muted-foreground" />
                                                    <span className={`${student.accuracy >= 80 ? 'text-green-500' : 'text-muted-foreground'}`}>
                                                        {student.accuracy}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-8 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                                    <span className="font-black text-lg text-foreground">{student.totalScore}</span>
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    ))}

                                    {filteredLeaders.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                No results found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>
        </div >
    );
}
