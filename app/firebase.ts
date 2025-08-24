// app/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ Your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyD30ttpHoP4xaQEjuPgCbyguZ8yMDOw0RM",
  authDomain: "tayyarihub.firebaseapp.com",
  projectId: "tayyari-hub",
  storageBucket: "tayyari-hub.appspot.com",
  messagingSenderId: "476210572589",
  appId: "1:476210572589:web:14444ade6d84edba8df7a4",
  measurementId: "G-H21039HJ2F",
};

// ✅ Prevent multiple instances in Next.js/React
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 🔑 Firebase services
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// ✅ Export everything you might need
export { app, auth, provider, db };

// Debug only (won’t run in prod build)
if (process.env.NODE_ENV === "development") {
  console.log("✅ Firebase App initialized:", app.name);
}
