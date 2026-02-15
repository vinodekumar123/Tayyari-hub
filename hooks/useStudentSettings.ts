'use client';

import { useState, useCallback, useEffect } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, increment, serverTimestamp, getDoc } from 'firebase/firestore';
import { updateProfile, reauthenticateWithCredential, EmailAuthProvider, updatePassword, User, onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';

export interface Session {
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

export interface Enrollment {
    id: string;
    seriesId: string;
    seriesName: string;
    enrolledAt?: any;
    status?: string;
}

export interface UserProfile {
    fullName: string;
    phone: string;
    district: string;
    email: string;
}

export function useStudentSettings() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Profile State
    const [profile, setProfile] = useState<UserProfile>({ fullName: '', phone: '', district: '', email: '' });
    const [savingProfile, setSavingProfile] = useState(false);

    // Password State
    const [pwLoading, setPwLoading] = useState(false);

    // Sessions State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentDeviceId, setCurrentDeviceId] = useState('');

    // Enrollments State
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

    // Init Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) setLoading(false);
        });
        setCurrentDeviceId(localStorage.getItem('tayyari_device_id') || '');
        return () => unsub();
    }, []);

    // Fetch Data
    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            await Promise.all([
                fetchProfile(),
                fetchSessions(),
                fetchEnrollments()
            ]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) fetchData();
    }, [user, fetchData]);

    const fetchProfile = async () => {
        if (!user) return;
        try {
            const udoc = await getDoc(doc(db, 'users', user.uid));
            if (udoc.exists()) {
                const data: any = udoc.data();
                setProfile({
                    fullName: data.fullName || data.full_name || '',
                    phone: data.phone || '',
                    district: data.district || '',
                    email: data.email || user.email || ''
                });
            } else {
                setProfile({ fullName: user.displayName || '', phone: '', district: '', email: user.email || '' });
            }
        } catch (err) {
            console.error('Failed to load profile', err);
        }
    };

    const fetchSessions = async () => {
        if (!user) return;
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
        }
    };

    const fetchEnrollments = async () => {
        if (!user) return;
        try {
            const enrollRef = collection(db, 'enrollments');
            const q = query(enrollRef, where('studentId', '==', user.uid), where('status', 'in', ['active', 'paid', 'enrolled']));
            const snap = await getDocs(q);
            const items = snap.docs.map(d => ({
                id: d.id,
                seriesId: d.data().seriesId,
                seriesName: d.data().seriesName || d.data().series || 'Unknown',
                enrolledAt: d.data().enrolledAt || d.data().paymentDate || d.data().createdAt,
                status: d.data().status
            }));
            setEnrollments(items as any);
        } catch (err) {
            console.error('Failed to load enrollments', err);
        }
    };

    // Actions
    const updateProfileData = async () => {
        if (!user) return;
        setSavingProfile(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                fullName: profile.fullName,
                phone: profile.phone,
                district: profile.district,
                updatedAt: serverTimestamp()
            });
            try { await updateProfile(user, { displayName: profile.fullName }); } catch (e) { }
            toast.success('Profile updated');
        } catch (err) {
            console.error('Failed to save profile', err);
            toast.error('Failed to save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const changePassword = async (current: string, newPw: string) => {
        if (!user) return;
        setPwLoading(true);
        try {
            const cred = EmailAuthProvider.credential(user.email || '', current);
            await reauthenticateWithCredential(user, cred);
            await updatePassword(user, newPw);
            toast.success('Password updated');
            return true;
        } catch (err: any) {
            console.error('Password change failed', err);
            const msg = err?.code || err?.message || 'Password update failed';
            toast.error(String(msg));
            return false;
        } finally {
            setPwLoading(false);
        }
    };

    const revokeSession = async (sessionId: string) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'sessions', sessionId), {
                isActive: false,
                lastActive: serverTimestamp(),
                loggedOutAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'users', user.uid), {
                activeSessions: increment(-1)
            });
            fetchSessions(); // Refresh list
            toast.success('Session logged out');
        } catch (error) {
            console.error("Error revoking session:", error);
            toast.error('Failed to revoke session');
        }
    };

    return {
        user,
        loading,
        profile, setProfile,
        savingProfile, updateProfileData,
        pwLoading, changePassword,
        sessions, currentDeviceId, revokeSession,
        enrollments,
    };
}
