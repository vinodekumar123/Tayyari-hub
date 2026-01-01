import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getInitializationError, isAdminInitialized } from '@/lib/firebase-admin';
import { requireSuperadmin } from '@/lib/auth-middleware';

// POST /api/students/bulk-delete
export async function POST(request: NextRequest) {
    // Outermost try-catch to guarantee JSON response
    try {
        console.log('🔵 Bulk delete API called');

        // Check if Firebase Admin SDK initialized
        if (!isAdminInitialized || !isAdminInitialized()) {
            const error = getInitializationError ? getInitializationError() : null;
            console.error('❌ Firebase Admin SDK not initialized');
            return NextResponse.json({
                success: false,
                error: 'Firebase Admin SDK not initialized',
                message: error?.message || 'Check serviceAccountKey.json file',
                deleted: 0,
                failed: 0,
                errors: []
            }, { status: 500 });
        }

        console.log('✅ Firebase Admin SDK initialized');

        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return NextResponse.json({
                success: false,
                error: 'Invalid JSON in request body'
            }, { status: 400 });
        }

        const { studentIds, confirmationText } = body;

        // Validate
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'studentIds array is required'
            }, { status: 400 });
        }

        if (studentIds.length > 1 && confirmationText !== 'DELETE') {
            return NextResponse.json({
                success: false,
                error: 'Type DELETE to confirm bulk operation'
            }, { status: 400 });
        }

        // Authenticate
        console.log('🔐 Authenticating...');
        const authResult = await requireSuperadmin(request);

        if (!authResult.authorized) {
            return NextResponse.json({
                success: false,
                error: authResult.error || 'Unauthorized',
                message: 'Authentication failed'
            }, { status: 401 });
        }

        const adminUserId = authResult.userId!;
        const adminUserName = authResult.userName!;
        const adminUserEmail = authResult.userEmail!;

        console.log('✅ Authenticated as:', adminUserName);

        const results = {
            deleted: 0,
            failed: 0,
            errors: [] as Array<{ studentId: string; studentName?: string; error: string }>,
        };

        // Delete each student
        for (const studentId of studentIds) {
            try {
                const studentDocRef = adminDb.collection('users').doc(studentId);
                const studentDoc = await studentDocRef.get();

                if (!studentDoc.exists) {
                    results.failed++;
                    results.errors.push({
                        studentId,
                        error: 'Student not found',
                    });
                    continue;
                }

                const studentData = studentDoc.data();
                const uid = studentData?.uid || studentId;
                const studentName = studentData?.fullName || 'Unknown';

                // Delete from Auth
                try {
                    await adminAuth.deleteUser(uid);
                } catch (authError: any) {
                    if (authError.code !== 'auth/user-not-found') {
                        throw authError;
                    }
                }

                // Delete subcollections
                try {
                    const quizAttemptsRef = studentDocRef.collection('quizAttempts');
                    const quizAttemptsSnapshot = await quizAttemptsRef.get();
                    const batch = adminDb.batch();
                    quizAttemptsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
                    await batch.commit();
                } catch (subError) {
                    console.warn('Failed to delete subcollections:', subError);
                }

                // Delete from Firestore
                await studentDocRef.delete();

                // Audit log
                try {
                    await adminDb.collection('auditLogs').add({
                        action: 'student_deleted',
                        studentId,
                        studentName,
                        studentEmail: studentData?.email,
                        deletedAt: new Date().toISOString(),
                        deletedBy: adminUserId,
                        deletedByName: adminUserName,
                        deletedByEmail: adminUserEmail,
                        deletionType: studentIds.length > 1 ? 'bulk' : 'single',
                    });
                } catch (auditError) {
                    console.warn('Failed to create audit log:', auditError);
                }

                results.deleted++;
            } catch (error: any) {
                console.error(`Error deleting ${studentId}:`, error);
                results.failed++;
                results.errors.push({
                    studentId,
                    error: error.message || 'Unknown error',
                });
            }
        }

        const message = results.failed === 0
            ? `Successfully deleted ${results.deleted} student(s)`
            : `Deleted ${results.deleted}, failed ${results.failed}`;

        return NextResponse.json({
            success: results.deleted > 0,
            deleted: results.deleted,
            failed: results.failed,
            errors: results.errors,
            message,
        });

    } catch (error: any) {
        // CRITICAL: This catch ensures we ALWAYS return JSON
        console.error('❌ CRITICAL ERROR:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error',
            deleted: 0,
            failed: 0,
            errors: [],
            message: 'Unexpected error occurred',
        }, { status: 500 });
    }
}
