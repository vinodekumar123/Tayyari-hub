"use client";

import { useEffect, useState } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, limit, deleteDoc, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import {
    ShieldAlert, Smartphone, Monitor, Globe, Clock,
    Trash2, Ban, UserX, AlertTriangle, RefreshCw, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { glassmorphism } from '@/lib/design-tokens';

interface Session {
    id: string;
    userId: string;
    userName?: string;
    email: string;
    ip: string;
    deviceType: string;
    os: string;
    browser: string;
    loginTime: any;
    isActive: boolean;
    deviceId: string;
    isRedFlagSession?: boolean;
    city?: string;
    country?: string;
    isBlocked?: boolean;
    blockReason?: string;
}

export default function SessionManagementPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, redflags, blocked
    const [search, setSearch] = useState('');

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const sessionsRef = collection(db, 'sessions');
            // For a real app, you'd want simpler queries or server-side filtering
            // Fetching last 100 sessions for demo/dashboard purposes
            const q = query(sessionsRef, orderBy('loginTime', 'desc'), limit(100));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
            setSessions(data);
        } catch (error) {
            console.error("Error fetching sessions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleClearSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to force logout this session?')) return;
        try {
            // Find session to get userId
            const session = sessions.find(s => s.id === sessionId);

            await updateDoc(doc(db, 'sessions', sessionId), {
                isActive: false,
                lastActive: serverTimestamp(),
                loggedOutAt: serverTimestamp()
            });

            if (session?.userId) {
                await updateDoc(doc(db, 'users', session.userId), {
                    activeSessions: increment(-1)
                });
            }

            fetchSessions();
        } catch (error) {
            console.error("Error clearing session:", error);
        }
    };

    const handleBlockDevice = async (deviceId: string) => {
        if (!confirm('Block this device permanently? Users will not be able to login from this device.')) return;
        try {
            await addDoc(collection(db, 'blocked_devices'), {
                deviceId,
                blockedAt: serverTimestamp(),
                reason: 'Admin Manual Block'
            });
            alert('Device blocked.');
        } catch (error) {
            console.error("Error blocking device:", error);
        }
    };

    const filteredSessions = sessions.filter(session => {
        const matchesSearch =
            session.email?.toLowerCase().includes(search.toLowerCase()) ||
            session.userName?.toLowerCase().includes(search.toLowerCase()) ||
            session.ip?.includes(search);

        if (!matchesSearch) return false;

        if (filter === 'active') return session.isActive;
        if (filter === 'blocked') return session.isBlocked;
        if (filter === 'redflags') return session.isRedFlagSession || session.isBlocked; // Include blocked in red flags
        return true;
    });

    // Calculate Stats
    const activeCount = sessions.filter(s => s.isActive).length;
    // Red flags now include sessions that were explicitly blocked due to limits
    const redFlagCount = sessions.filter(s => (s.isRedFlagSession && s.isActive) || s.isBlocked).length;
    const blockedCount = sessions.filter(s => s.isBlocked).length;

    return (
        <div className="p-6 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">

            {/* Unified Header */}
            <div className='relative group'>
                <div className='absolute inset-0 bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] rounded-3xl blur-xl opacity-20 dark:opacity-30 group-hover:opacity-30 dark:group-hover:opacity-40 transition-opacity duration-500' />
                <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 dark:border-[#0066FF]/30`}>
                    <div className='flex items-center justify-between flex-wrap gap-4'>
                        <div>
                            <h1 className='text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] via-[#0066FF] to-[#00B4D8] dark:from-[#0066FF] dark:via-[#00B4D8] dark:to-[#66D9EF] mb-2'>
                                Session Control Center
                            </h1>
                            <p className='text-muted-foreground font-semibold flex items-center gap-2'>
                                <ShieldAlert className='w-5 h-5 text-[#00B4D8] dark:text-[#66D9EF]' />
                                Monitor active logins, detect red flags, and manage device access.
                            </p>
                        </div>
                        <Button onClick={fetchSessions} variant="outline" className="gap-2 bg-background/50 backdrop-blur-sm border-primary/20 hover:bg-primary/10">
                            <RefreshCw className="w-4 h-4" /> Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Active Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{activeCount}</div>
                        <p className="text-xs text-slate-400">Currently logged in devices</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Red Flag Users</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{redFlagCount}</div>
                        <p className="text-xs text-slate-400">Users on {'>'}3 devices or blocked</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Blocked Attempts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-orange-600">{blockedCount}</div>
                        <p className="text-xs text-slate-400">Logins blocked by rules</p>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Security Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                        <Button variant="destructive" size="sm" className="w-full">Block Specific IP</Button>
                        <Button variant="outline" size="sm" className="w-full">Clear All Sessions</Button>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Table */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg w-fit flex-wrap">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            All Logs
                        </button>
                        <button
                            onClick={() => setFilter('active')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${filter === 'active' ? 'bg-white dark:bg-slate-800 shadow-sm text-green-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Active Only
                        </button>
                        <button
                            onClick={() => setFilter('blocked')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${filter === 'blocked' ? 'bg-white dark:bg-slate-800 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Blocked
                        </button>
                        <button
                            onClick={() => setFilter('redflags')}
                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${filter === 'redflags' ? 'bg-white dark:bg-slate-800 shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <AlertTriangle className="w-3 h-3" /> Red Flags
                        </button>
                    </div>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search user, email or IP..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-6 py-4">User Details</th>
                                    <th className="px-6 py-4">Device Info</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4">Login Time</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">Loading sessions...</td></tr>
                                ) : filteredSessions.length === 0 ? (
                                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-500">No sessions found matching filters.</td></tr>
                                ) : filteredSessions.map((session) => (
                                    <tr key={session.id} className={`transition-colors ${session.isBlocked ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white">{session.userName || 'User'}</span>
                                                <span className="text-xs text-slate-500">{session.email}</span>
                                                {session.isRedFlagSession && !session.isBlocked && (
                                                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded w-fit">
                                                        <AlertTriangle className="w-3 h-3" /> Multi-Login Detected
                                                    </span>
                                                )}
                                                {session.blockReason && (
                                                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded w-fit">
                                                        <Ban className="w-3 h-3" /> {session.blockReason}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                    {session.deviceType === 'mobile' ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                                                    <span>{session.os} / {session.browser}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">{session.deviceId?.slice(0, 8)}...</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col text-sm">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">{session.city || 'Unknown'}</span>
                                                <span className="text-xs text-slate-500">{session.country || '-'}</span>
                                                <span className="text-[10px] text-slate-400 mt-0.5">{session.ip}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                                <Clock className="w-4 h-4" />
                                                {session.loginTime ? formatDistanceToNow(session.loginTime.toDate(), { addSuffix: true }) : 'Just now'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {session.isBlocked ? (
                                                <Badge variant="destructive" className="bg-red-600/10 text-red-600 hover:bg-red-600/20 border-red-600/20 shadow-none">Blocked</Badge>
                                            ) : session.isActive ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-none shadow-none">Active</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 border-slate-200">Ended</Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {session.isActive && (
                                                    <Button
                                                        onClick={() => handleClearSession(session.id)}
                                                        variant="ghost" size="sm"
                                                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-2 h-8"
                                                        title="Force Logout"
                                                    >
                                                        <LogOutIcon className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={() => handleBlockDevice(session.deviceId)}
                                                    variant="ghost" size="sm"
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 h-8"
                                                    title="Block Device"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Icon helper
const LogOutIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
);
