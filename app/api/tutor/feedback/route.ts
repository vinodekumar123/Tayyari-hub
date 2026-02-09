import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const { logId, feedback, notes } = await req.json();

        if (!logId || !feedback) {
            return NextResponse.json({ error: 'Log ID and feedback required' }, { status: 400 });
        }

        if (!['helpful', 'not_helpful'].includes(feedback)) {
            return NextResponse.json({ error: 'Invalid feedback value' }, { status: 400 });
        }

        await adminDb.collection('ai_tutor_logs').doc(logId).update({
            feedback,
            feedbackNotes: notes || null,
            feedbackTimestamp: new Date()
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Feedback API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
