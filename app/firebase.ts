// app/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// ✅ Your Firebase project config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ✅ Prevent multiple instances in Next.js/React
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 🔑 Firebase services
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
// Enable ignoreUndefinedProperties to prevent crashes when saving objects with undefined fields
// @ts-ignore
if (db._settings) { db._settings.ignoreUndefinedProperties = true; }
// A safer way if the above internal access isn't desired:
// initializeFirestore(app, { ignoreUndefinedProperties: true });
// But since getFirestore is already used, we can re-initialize or configure it.
// Ideally replace `getFirestore(app)` with:
// import { initializeFirestore } from "firebase/firestore";
// const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
const storage = getStorage(app);

// Initialize Messaging only on client side
// Initialize Messaging only on client side
let messaging: any = null;
if (typeof window !== 'undefined') {
  import('firebase/messaging').then(async ({ getMessaging, isSupported }) => {
    try {
      if (await isSupported()) {
        messaging = getMessaging(app);
      }
    } catch (e) {
      console.warn('Firebase Messaging not supported:', e);
    }
  });
}

// ✅ Export everything you might need
export { app, auth, provider, db, storage, messaging };

// Debug only (won’t run in prod build)
if (process.env.NODE_ENV === "development") {
  console.log("✅ Firebase App initialized:", app.name);
}
