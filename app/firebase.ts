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

// Check if required Firebase config is present
const hasValidConfig = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.appId &&
  firebaseConfig.projectId
);

// 🔑 Firebase services
let app: any = null;
let auth: any;
let db: any;
let storage: any;

if (!hasValidConfig) {
  // Only log warning in browser (not during build/SSR)
  if (typeof window !== 'undefined') {
    console.warn("⚠️ Firebase config is incomplete. Firebase services will be mocked.");
    console.warn("Missing config:", {
      apiKey: !!firebaseConfig.apiKey,
      appId: !!firebaseConfig.appId,
      projectId: !!firebaseConfig.projectId
    });
  }
  const mockService = {
    currentUser: null,
    onAuthStateChanged: () => () => { },
    signInWithPopup: () => Promise.reject("Missing Firebase Config"),
    signOut: () => Promise.resolve(),
  } as any;
  auth = mockService;
  db = {} as any;
  storage = {} as any;
} else {
  // ✅ Prevent multiple instances in Next.js/React
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  // Enable ignoreUndefinedProperties to prevent crashes when saving objects with undefined fields
  // @ts-ignore
  if (db._settings) { db._settings.ignoreUndefinedProperties = true; }
  storage = getStorage(app);
}

const provider = new GoogleAuthProvider();

// Initialize Messaging only on client side
// Initialize Messaging only on client side
let messaging: any = null;
if (typeof window !== 'undefined' && app) {
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
