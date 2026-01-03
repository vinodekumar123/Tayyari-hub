import { useEffect, useState } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { app } from '@/app/firebase';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export function useFcmToken() {
    const [token, setToken] = useState<string | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
            return;
        }

        const requestPermission = async () => {
            try {
                const permission = await Notification.requestPermission();
                setPermission(permission);

                if (permission === 'granted') {
                    const messaging = getMessaging(app);

                    // Explicitly register service worker to prevent timeout errors
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

                    // Try fetching token with explicit registration
                    const currentToken = await getToken(messaging, {
                        serviceWorkerRegistration: registration
                    }).catch((err) => {
                        console.error("FCM Token Error:", err);
                        return null;
                    });

                    if (currentToken) {
                        setToken(currentToken);
                        console.log('FCM Token:', currentToken);

                        // Save to Firestore
                        const auth = getAuth(app);
                        if (auth.currentUser) {
                            const db = getFirestore(app);
                            const userRef = doc(db, 'users', auth.currentUser.uid);
                            // We use setDoc with merge to safely add the token field
                            await setDoc(userRef, {
                                fcmTokens: arrayUnion(currentToken)
                            }, { merge: true });
                        }
                    } else {
                        console.log('No registration token available. Request permission to generate one.');
                    }
                }
            } catch (error) {
                console.log('An error occurred while retrieving token. ', error);
            }
        };

        requestPermission();
    }, []);

    return { token, permission };
}
