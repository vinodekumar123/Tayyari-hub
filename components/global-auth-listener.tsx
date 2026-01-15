'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { app } from '@/app/firebase';
import { useUserStore } from '@/stores/useUserStore';

export function GlobalAuthListener() {
    const { setUser, setLoading } = useUserStore();

    useEffect(() => {
        const auth = getAuth(app);
        const db = getFirestore(app);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            // 1. If no user, clear store and stop loading
            if (!firebaseUser) {
                setUser(null);
                setLoading(false);
                return;
            }

            try {
                // 2. User exists, fetch full profile from Firestore
                // We need this to get role, admin status, etc.
                const userRef = doc(db, 'users', firebaseUser.uid);
                const snap = await getDoc(userRef);

                if (snap.exists()) {
                    const data = snap.data();

                    // Construct the full User object for the store
                    const fullUser = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        fullName: data.fullName || data.name || firebaseUser.displayName || 'User',
                        photoURL: data.photoURL || firebaseUser.photoURL,
                        phone: data.phone || data.phoneNumber,
                        role: data.role,
                        admin: data.admin,
                        superadmin: data.superadmin,
                        stats: data.stats,
                        // Spread other fields if needed, but be careful of large objects
                        ...data
                    };

                    // Update store
                    setUser(fullUser as any);
                } else {
                    // User in Auth but not in Firestore (rare, but possible eg. just created)
                    // Fallback to basic auth info
                    const basicUser = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        fullName: firebaseUser.displayName || 'User',
                        photoURL: firebaseUser.photoURL,
                    };
                    setUser(basicUser as any);
                }
            } catch (error) {
                console.error('GlobalAuthListener: Error fetching user profile:', error);
                // Even on error, we should probably set user with basic info so app doesn't hang
                // or handle it gracefully.
                setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    fullName: firebaseUser.displayName || 'User',
                } as any);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [setUser, setLoading]);

    return null; // This component renders nothing
}
