import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let initializationError: Error | null = null;
let isInitialized = false;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        console.log('🔵 Initializing Firebase Admin SDK...');

        // Try to load service account from JSON file
        const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

        if (fs.existsSync(serviceAccountPath)) {
            console.log('✅ Found serviceAccountKey.json file');
            const serviceAccount = require(serviceAccountPath);

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
            });

            isInitialized = true;
            console.log('✅ Firebase Admin SDK initialized successfully from serviceAccountKey.json');
        } else {
            // Fallback to environment variable
            console.log('⚠️ serviceAccountKey.json not found, trying environment variable...');

            if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
                try {
                    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                    console.log('✅ Parsed FIREBASE_SERVICE_ACCOUNT_KEY from environment');

                    admin.initializeApp({
                        credential: admin.credential.cert(serviceAccount),
                        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                    });

                    isInitialized = true;
                    console.log('✅ Firebase Admin SDK initialized successfully from environment variable');
                } catch (parseError: any) {
                    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY: ${parseError.message}`);
                }
            } else {
                throw new Error('Neither serviceAccountKey.json nor FIREBASE_SERVICE_ACCOUNT_KEY environment variable found');
            }
        }
    } catch (error: any) {
        initializationError = error;
        console.error('❌ Firebase Admin SDK initialization failed:', error.message);
        console.error('Stack:', error.stack);
        // DON'T throw - let the app continue and handle errors in API routes
    }
}

// Safe exports that won't crash if initialization failed
export const adminAuth = isInitialized ? admin.auth() : null as any;
export const adminDb = isInitialized ? admin.firestore() : null as any;
export const adminApp = isInitialized ? admin.app() : null as any;

// Export initialization status for API routes to check
export const getInitializationError = () => initializationError;
export const isAdminInitialized = () => isInitialized;

export default admin;
