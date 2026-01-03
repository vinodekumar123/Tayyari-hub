'use client';

import { useState, useEffect } from 'react';
import {
    collection, query, where, getDocs, orderBy
} from 'firebase/firestore';
import { auth, db } from '@/app/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Task } from '@/types';
import { toast } from 'sonner';

export default function AdminPersonalStatsPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                await fetchStats(u.uid);
            }
        });
        return () => unsub();
    }, []);

    const fetchStats = async (uid: string) => {
        try {
            // Fetch tasks assigned TO this admin
            const q = query(collection(db, 'tasks'), where('assignedTo', '==', uid));
            const snap = await getDocs(q);
            const myTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
            setTasks(myTasks);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load stats");
        } finally {
            setLoading(false);
        }
    };

    const totalEarnings = tasks.filter(t => t.paymentStatus === 'paid').reduce((acc, t) => acc + (t.paymentAmount || 0), 0);
    const pendingEarnings = tasks.filter(t => t.paymentStatus === 'pending').reduce((acc, t) => acc + (t.paymentAmount || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'reviewed').length;
    const avgRating = tasks.filter(t => t.rating).reduce((acc, t) => acc + (t.rating || 0), 0) / (tasks.filter(t => t.rating).length || 1);

    return (
        <div className="p-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                    My Performance & Revenue
                </h1>
                <p className="text-muted-foreground mt-2">Track your completed tasks and earnings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-emerald-50 border-emerald-200">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-800">Total Revenue</CardTitle></CardHeader>
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
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-purple-800">Avg Rating</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-900">{avgRating.toFixed(1)} <span className="text-sm">★</span></div>
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
                        <CardHeader><CardTitle>Admin Agreement</CardTitle><CardDescription>Effective as of Jan 1, 2024</CardDescription></CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none">
                            <h3>1. Responsibilities</h3>
                            <p>The Admin agrees to manage platform content and perform assigned administrative tasks.</p>
                            <h3>2. Compensation</h3>
                            <p>Compensation is performance-based per assigned task.</p>
                            <div className="mt-8 p-4 bg-slate-100 rounded text-center text-sm">
                                Digitally Accepted by {user?.displayName}.
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
