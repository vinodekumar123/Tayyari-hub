'use client';

import { useState, useEffect } from 'react';
import {
    collection, query, where, getDocs, orderBy
} from 'firebase/firestore';
import { auth, db } from '../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DollarSign, Briefcase, FileSignature, CheckCircle, Clock, Activity, MessageSquare, ThumbsUp
} from 'lucide-react';
import { Task, ForumPost } from '@/types';
import { cn } from '@/lib/utils';
import { glassmorphism } from '@/lib/design-tokens';
import { toast } from 'sonner';

export default function TeacherStatsPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [communityStats, setCommunityStats] = useState({ questions: 0, answers: 0, points: 0 });
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async (uid: string) => {
            try {
                const q = query(collection(db, 'tasks'), where('assignedTo', '==', uid));
                const snap = await getDocs(q);
                const myTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
                setTasks(myTasks);

                // Fetch Community Stats
                const postsQ = query(collection(db, 'forum_posts'), where('authorId', '==', uid));
                const repliesQ = query(collection(db, 'forum_replies'), where('authorId', '==', uid));

                // Fetch user doc for points if needed, though we have u.points potentially from auth if custom claims,
                // but usually better to fetch fresh from DB or use the user object if it has it.
                // onAuthStateChanged user object doesn't have firestore data. 
                // We should fetch the user doc to get points.
                const userDocRef = collection(db, 'users');
                const userQ = query(userDocRef, where('uid', '==', uid));
                const userSnap = await getDocs(userQ);
                let userPoints = 0;
                if (!userSnap.empty) {
                    userPoints = userSnap.docs[0].data().points || 0;
                }

                const [postsSnap, repliesSnap] = await Promise.all([getDocs(postsQ), getDocs(repliesQ)]);

                setCommunityStats({
                    questions: postsSnap.size,
                    answers: repliesSnap.size,
                    points: userPoints
                });

                // Update user state with points for display if needed
                setUser((prev: any) => ({ ...prev, points: userPoints }));

            } catch (e) {
                console.error(e);
                toast.error("Failed to load stats");
            } finally {
                setLoading(false);
            }
        };

        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                fetchStats(u.uid);
            } else {
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    const totalEarnings = tasks.filter(t => t.paymentStatus === 'paid').reduce((acc, t) => acc + (t.paymentAmount || 0), 0);
    const pendingEarnings = tasks.filter(t => t.paymentStatus === 'pending').reduce((acc, t) => acc + (t.paymentAmount || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'reviewed').length;
    const avgRating = tasks.filter(t => t.rating).reduce((acc, t) => acc + (t.rating || 0), 0) / (tasks.filter(t => t.rating).length || 1);

    return (
        <div className="p-8 space-y-8">
            {/* Header */}
            <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500" />
                <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2">
                                My Performance & Earnings
                            </h1>
                            <p className="text-muted-foreground font-semibold flex items-center gap-2">
                                <Activity className="w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]" />
                                Track your tasks, payments, and agreements
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-emerald-50 border-emerald-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-800">Total Earnings</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-900">${totalEarnings.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-amber-800">Pending Payments</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-900">${pendingEarnings.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-800">Tasks Completed</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-900">{completedTasks} <span className="text-sm font-normal text-blue-700">/ {tasks.length}</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-purple-800">Community Points</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-900">{communityStats.points}</div>
                        <div className="text-xs text-purple-700 mt-1 flex gap-2">
                            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {communityStats.answers} Answers</span>
                            <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {communityStats.questions} Questions</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="history">
                <TabsList>
                    <TabsTrigger value="history">Task History</TabsTrigger>
                    <TabsTrigger value="agreements">Agreements</TabsTrigger>
                </TabsList>

                <TabsContent value="history">
                    <Card>
                        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {tasks.filter(t => t.paymentStatus === 'paid').map(t => (
                                    <div key={t.id} className="flex justify-between items-center p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/10">
                                        <div>
                                            <h4 className="font-semibold">{t.title}</h4>
                                            <p className="text-xs text-muted-foreground">Paid on {t.paymentDate?.toDate().toLocaleDateString()}</p>
                                        </div>
                                        <div className="font-bold text-emerald-600">+${t.paymentAmount}</div>
                                    </div>
                                ))}
                                {tasks.filter(t => t.paymentStatus === 'paid').length === 0 && <p className="text-muted-foreground text-center">No payment history yet.</p>}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="agreements">
                    <Card>
                        <CardHeader><CardTitle>Teacher Agreement</CardTitle><CardDescription>Effective as of Jan 1, 2024</CardDescription></CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none">
                            <h3>1. Scope of Work</h3>
                            <p>The Teacher agrees to create high-quality educational content, including but not limited to questions, quizzes, and explanations, as assigned by the Admin.</p>
                            <h3>2. Payment Terms</h3>
                            <p>Payments will be processed upon successful review and completion of assigned tasks. Rates are defined per task in the assignment details.</p>
                            <h3>3. Intellectual Property</h3>
                            <p>All content created under this agreement becomes the sole property of Tayyari Hub.</p>
                            <div className="mt-8 p-4 bg-slate-100 rounded text-center text-sm">
                                Digitally Accepted by {user?.displayName} on Registration.
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
