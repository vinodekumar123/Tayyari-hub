"use client";

import { useEffect, useState, useCallback } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';
import { getAuth, updateProfile, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { app } from '@/app/firebase';
import { getDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
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
    const [profile, setProfile] = useState({ fullName: '', phone: '', district: '', email: '' });
    const [saving, setSaving] = useState(false);
    const [pwLoading, setPwLoading] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

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

    const [enrolledSeries, setEnrolledSeries] = useState<{ seriesId: string; seriesName: string; enrolledAt?: any; status?: string; }[]>([]);

    const fetchEnrollments = useCallback(async () => {
        if (!user) return;
        try {
            const enrollRef = collection(db, 'enrollments');
            const q = query(enrollRef, where('studentId', '==', user.uid), where('status', 'in', ['active','paid','enrolled']));
            const snap = await getDocs(q);
            const items = snap.docs.map(d => ({ seriesId: d.data().seriesId, seriesName: d.data().seriesName || d.data().series || 'Unknown', enrolledAt: d.data().enrolledAt || d.data().paymentDate || d.data().createdAt, status: d.data().status }));
            setEnrolledSeries(items as any);
        } catch (err) {
            console.error('Failed to load enrollments', err);
        }
    }, [user]);

    useEffect(() => {
        setCurrentDeviceId(localStorage.getItem('tayyari_device_id') || '');
        if (user) {
            fetchMySessions();
        } else {
            setLoading(false);
        }
        // fetch profile
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const udoc = await getDoc(doc(db, 'users', user.uid));
                if (udoc.exists()) {
                    const data: any = udoc.data();
                    setProfile({ fullName: data.fullName || data.full_name || '', phone: data.phone || '', district: data.district || '', email: data.email || user.email || '' });
                } else {
                    setProfile({ fullName: user.displayName || '', phone: '', district: '', email: user.email || '' });
                }
            } catch (err) {
                console.error('Failed to load profile', err);
            }
        };
        fetchProfile();
        fetchEnrollments();
    }, [user, fetchMySessions, fetchEnrollments]);

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

    const handleSaveProfile = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                fullName: profile.fullName,
                phone: profile.phone,
                district: profile.district,
                updatedAt: serverTimestamp()
            });
            // also update auth profile displayName
            try { await updateProfile(user, { displayName: profile.fullName }); } catch (e) { }
            toast.success('Profile updated');
        } catch (err) {
            console.error('Failed to save profile', err);
            toast.error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (!user) return;
        if (!currentPassword) return toast.error('Enter current password');
        if (!newPassword || newPassword.length < 6) return toast.error('New password must be at least 6 characters');
        if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
        setPwLoading(true);
        try {
            const cred = EmailAuthProvider.credential(user.email || '', currentPassword);
            await reauthenticateWithCredential(user, cred);
            await updatePassword(user, newPassword);
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
            toast.success('Password updated');
        } catch (err: any) {
            console.error('Password change failed', err);
            const msg = err?.code || err?.message || 'Password update failed';
            toast.error(String(msg));
        } finally {
            setPwLoading(false);
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <Label>Full name</Label>
                                        <Input value={profile.fullName} onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))} />
                                    </div>
                                    <div>
                                        <Label>Email</Label>
                                        <Input value={profile.email} readOnly />
                                    </div>
                                    <div>
                                        <Label>Phone</Label>
                                        <Input value={profile.phone} onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))} />
                                    </div>
                                    <div>
                                        <Label>District / Location</Label>
                                        <Input value={profile.district} onChange={(e) => setProfile(p => ({ ...p, district: e.target.value }))} />
                                    </div>
                                    <div className="pt-2">
                                        <Button onClick={handleSaveProfile} disabled={saving}>
                                            {saving ? 'Saving...' : 'Save Profile'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Change Password</h3>
                                    <div>
                                        <Label>Current password</Label>
                                        <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>New password</Label>
                                        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Confirm new password</Label>
                                        <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                    </div>
                                    <div className="pt-2">
                                        <Button variant="secondary" onClick={handleChangePassword} disabled={pwLoading}>
                                            {pwLoading ? 'Updating...' : 'Change Password'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6">
                                <h4 className="text-base font-semibold">Enrolled Series</h4>
                                {enrolledSeries.length === 0 ? (
                                    <p className="text-sm text-slate-500">You are not enrolled in any series.</p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        {enrolledSeries.map((s) => (
                                            <div key={s.seriesId} className="flex items-center justify-between p-3 rounded-lg border bg-white/50 dark:bg-slate-900/50">
                                                <div>
                                                    <div className="font-semibold">{s.seriesName}</div>
                                                    <div className="text-xs text-muted-foreground">{s.enrolledAt ? format(new Date(s.enrolledAt?.seconds ? s.enrolledAt.seconds * 1000 : s.enrolledAt), 'MMM dd, yyyy') : ''}</div>
                                                </div>
                                                <div>
                                                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{s.status || 'active'}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
