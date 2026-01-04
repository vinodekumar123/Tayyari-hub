import { db } from '@/app/firebase';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';

export const POINTS = {
    CREATE_POST: 5,
    CREATE_REPLY: 2,
    VERIFIED_ANSWER: 15,
};

export const sendNotification = async (recipientId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', link?: string) => {
    try {
        await addDoc(collection(db, 'users', recipientId, 'notifications'), {
            title,
            message,
            type,
            link: link || null,
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

export const checkSeriesEnrollment = async (userId: string): Promise<boolean> => {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            // Check if user has any series enrollment or plain "premium" flag (legacy support if needed)
            // Assuming "seriesEnrolled" array or boolean "premium" or "isEnrolled"
            // Adjust based on your actual data model. Based on recent convos, it's 'seriesEnrolled' or similar.
            // Let's check for 'enrolledSeries' array or 'isPremium' as fallback
            if (userData.role === 'admin' || userData.role === 'superadmin' || userData.role === 'teacher') return true;

            return userData.isPremium === true || (Array.isArray(userData.enrolledSeries) && userData.enrolledSeries.length > 0);
        }
        return false;
    } catch (error) {
        console.error("Failed to check enrollment", error);
        return false;
    }
};
