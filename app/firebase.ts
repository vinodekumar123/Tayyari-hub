import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyD30ttpHoP4xaQEjuPgCbyguZ8yMDOw0RM',
  authDomain: 'tayyari-hub.firebaseapp.com',
  projectId: 'tayyari-hub',
  storageBucket: 'tayyari-hub.appspot.com',
  messagingSenderId: '476210572589',
  appId: '1:476210572589:web:14444ade6d84edba8df7a4',
  measurementId: 'G-H21039HJ2F',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
