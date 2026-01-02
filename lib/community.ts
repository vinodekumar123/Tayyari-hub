import { db } from '@/app/firebase';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

export const POINTS = {
    CREATE_POST: 5,
    CREATE_REPLY: 2,
    VERIFIED_ANSWER: 15,
};

export const sendNotification = async (recipientId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', link?: string) => {
    try {
        await addDoc(collection(db, 'notifications'), {
            recipientId,
            title,
            message,
            type,
            link,
            read: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to send notification", error);
    }
};

export const awardPoints = async (userId: string, amount: number, reason: string) => {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            points: increment(amount),
        });
    } catch (error) {
        console.error("Failed to award points", error);
    }
};
