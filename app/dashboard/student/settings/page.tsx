"use client";

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '@/app/firebase';
import {
    Shield, Smartphone, Monitor, Globe, Clock,
    Trash2, LogOut, CheckCircle, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { glassmorphism } from '@/lib/design-tokens';

interface Session {
    id: string;
    userId: string;
    ip: string;
    deviceType: string;
    os: string;
    browser: string;
    loginTime: any;
    isActive: boolean;
    deviceId: string;
    city?: string;
    country?: string;
    isRedFlagSession?: boolean;
}

export default function StudentSettingsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentDeviceId, setCurrentDeviceId] = useState('');
    const auth = getAuth(app);
    const user = auth.currentUser;

    const fetchMySessions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const sessionsRef = collection(db, 'sessions');
            const q = query(
                sessionsRef,
                where('userId', '==', user.uid),
                where('isActive', '==', true),
                orderBy('loginTime', 'desc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(data);
        } catch (error) {
            console.error("Error fetching sessions:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        setCurrentDeviceId(localStorage.getItem('tayyari_device_id') || '');
        if (user) {
            fetchMySessions();
        } else {
            setLoading(false);
        }
    }, [user, fetchMySessions]);

    const handleRevokeSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to log out this device?')) return;
        try {
            await updateDoc(doc(db, 'sessions', sessionId), {
                isActive: false,
                lastActive: serverTimestamp(), // Update last active to now to indicate closure event if needed
                loggedOutAt: serverTimestamp()
            });
            // Decrement user active session count
            if (user) {
                await updateDoc(doc(db, 'users', user.uid), {
                    activeSessions: increment(-1)
                });
            }
            fetchMySessions();
        } catch (error) {
            console.error("Error revoking session:", error);
        }
    };

    return (
        <div className="p-6 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">

            {/* Unified Header */}
            <div className='relative group'>
                <div className='absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500' />
                <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
                    <div className='flex items-center justify-between'>
                        <div>
                            <h1 className='text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2'>
                                Account & Security
                            </h1>
                            <p className='text-muted-foreground font-semibold flex items-center gap-2'>
                                <Shield className='w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]' />
                                Manage your account settings and active sessions.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="sessions" className="max-w-4xl">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
                    <TabsTrigger value="profile">Profile Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="sessions" className="space-y-6 mt-6">
                    <Card className="dark:bg-slate-900 dark:border-slate-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Smartphone className="w-5 h-5 text-indigo-500" />
                                Where you&apos;re logged in
                            </CardTitle>
                            <CardDescription>
                                Maximize security by logging out of devices you don&apos;t recognize.
                                Limit: 3 Active Devices.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {loading ? (
                                    <p className="text-center text-slate-500 py-4">Loading active sessions...</p>
                                ) : sessions.length === 0 ? (
                                    <p className="text-center text-slate-500 py-4">No active sessions found (This is strange as you are logged in).</p>
                                ) : (
                                    sessions.map(session => (
                                        <div key={session.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-4">
                                            <div className="flex gap-4">
                                                <div className="p-3 bg-white dark:bg-slate-800 rounded-full h-fit border border-slate-100 dark:border-slate-700">
                                                    {session.deviceType === 'mobile' ? <Smartphone className="w-6 h-6 text-slate-600 dark:text-slate-300" /> : <Monitor className="w-6 h-6 text-slate-600 dark:text-slate-300" />}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-slate-900 dark:text-white">
                                                            {session.os} ({session.browser})
                                                        </h4>
                                                        {session.deviceId === currentDeviceId && (
                                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-none shadow-none text-[10px] px-2 py-0.5">
                                                                Current Device
                                                            </Badge>
                                                        )}
                                                        {session.isRedFlagSession && (
                                                            <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Red Flag</Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Globe className="w-3 h-3" /> {session.city ? `${session.city}, ${session.country}` : session.ip}
                                                        </span>
                                                        <span className="flex items-center gap-1 border-l border-slate-300 dark:border-slate-700 pl-2">
                                                            <Clock className="w-3 h-3" /> Active: {formatDistanceToNow(session.loginTime.toDate(), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {session.deviceId !== currentDeviceId && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleRevokeSession(session.id)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/50"
                                                >
                                                    <LogOut className="w-4 h-4 mr-2" /> Log out
                                                </Button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="profile" className="mt-6">
                    <Card className="dark:bg-slate-900 dark:border-slate-800">
                        <CardHeader>
                            <CardTitle>Profile Settings</CardTitle>
                            <CardDescription>Update your personal information and password.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Placeholder for future profile updates */}
                            <p className="text-slate-500">Profile update features coming soon.</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
