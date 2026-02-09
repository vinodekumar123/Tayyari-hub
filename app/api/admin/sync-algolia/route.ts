
import { NextRequest, NextResponse } from 'next/server';
import { adminClient, QUESTIONS_INDEX, MOCK_QUESTIONS_INDEX } from '@/lib/algolia-admin';

export async function POST(request: NextRequest) {
    try {
        const { questionId, questionIds, data, type, action } = await request.json();

        if (!type || (!questionId && !questionIds)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const indexName = type === 'mock' ? MOCK_QUESTIONS_INDEX : QUESTIONS_INDEX;
        const ids = questionIds || [questionId];

        if (action === 'delete') {
            await adminClient.deleteObjects({
                indexName,
                objectIDs: ids
            });
            return NextResponse.json({ success: true });
        }

        // If single record save/update
        if (questionId && data) {
            const plainText = (data.questionText || '').replace(/<[^>]*>/g, ' ').trim();
            const record = {
                objectID: questionId,
                questionText: plainText,
                rawQuestionText: data.questionText,
                options: data.options || [],
                correctAnswer: data.correctAnswer,
                explanation: data.explanation,
                subject: data.subject,
                chapter: data.chapter,
                topic: data.topic,
                difficulty: data.difficulty,
                course: data.course || data.courseId,
                status: data.status,
                isDeleted: data.isDeleted || false,
                updatedAt: Date.now()
            };

            await adminClient.saveObjects({
                indexName,
                objects: [record]
            });
        }

        // If bulk update (like soft delete or restore)
        if (questionIds && action) {
            // For bulk updates like 'soft-delete' or 'restore', 
            // we ideally need the full data, but Algolia supports partial updates.
            const objects = ids.map((id: string) => ({
                objectID: id,
                isDeleted: action === 'soft-delete'
            }));

            await adminClient.partialUpdateObjects({
                indexName,
                objects,
                createIfNotExists: false
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Algolia Sync Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
