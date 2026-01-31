'use server';

import { adminDb } from '@/lib/firebase-admin';

export interface KnowledgeBaseDocument {
    id: string;
    content: string;
    visual_description: string;
    metadata: {
        subject: string;
        bookName: string;
        province: string;
        year: string;
        type: 'book' | 'syllabus';
        chapter: string;
        page: string;
        fileName: string;
        uploadedAt: Date;
    };
}

interface GetDocumentsParams {
    limit?: number;
    startAfter?: string;
    subjectFilter?: string;
    typeFilter?: string;
    searchQuery?: string;
}

export async function getKnowledgeBaseDocuments(params: GetDocumentsParams = {}) {
    try {
        const { limit = 50, startAfter, subjectFilter, typeFilter } = params;

        let query: any = adminDb.collection('knowledge_base').orderBy('metadata.uploadedAt', 'desc');

        // Apply filters
        if (subjectFilter) {
            query = query.where('metadata.subject', '==', subjectFilter);
        }
        if (typeFilter) {
            query = query.where('metadata.type', '==', typeFilter);
        }

        // Pagination
        if (startAfter) {
            const startDoc = await adminDb.collection('knowledge_base').doc(startAfter).get();
            if (startDoc.exists) {
                query = query.startAfter(startDoc);
            }
        }

        query = query.limit(limit);

        const snapshot = await query.get();
        const documents: KnowledgeBaseDocument[] = [];

        snapshot.forEach((doc: any) => {
            const data = doc.data();
            documents.push({
                id: doc.id,
                content: data.content?.substring(0, 200) + (data.content?.length > 200 ? '...' : ''), // Truncate for list view
                visual_description: data.visual_description?.substring(0, 100) || '',
                metadata: {
                    subject: data.metadata?.subject || 'Unknown',
                    bookName: data.metadata?.bookName || 'Unknown',
                    province: data.metadata?.province || 'Unknown',
                    year: data.metadata?.year || 'Unknown',
                    type: data.metadata?.type || 'book',
                    chapter: data.metadata?.chapter || 'Unknown',
                    page: data.metadata?.page || 'Unknown',
                    fileName: data.metadata?.fileName || 'Unknown',
                    uploadedAt: data.metadata?.uploadedAt?.toDate?.() || new Date()
                }
            });
        });

        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        const hasMore = snapshot.size === limit;

        return {
            success: true,
            documents,
            lastDocId: lastDoc?.id,
            hasMore
        };

    } catch (error: any) {
        console.error("Get KB Documents Error:", error);
        return {
            success: false,
            error: error.message,
            documents: [],
            hasMore: false
        };
    }
}

export async function getKnowledgeBaseStats() {
    try {
        // Get counts by type and subject
        const allDocs = await adminDb.collection('knowledge_base').get();

        const stats = {
            total: allDocs.size,
            byType: { book: 0, syllabus: 0 } as Record<string, number>,
            bySubject: {} as Record<string, number>,
            byBook: {} as Record<string, number>
        };

        allDocs.forEach((doc) => {
            const data = doc.data();
            const type = data.metadata?.type || 'book';
            const subject = data.metadata?.subject || 'Unknown';
            const book = data.metadata?.bookName || 'Unknown';

            stats.byType[type] = (stats.byType[type] || 0) + 1;
            stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1;
            stats.byBook[book] = (stats.byBook[book] || 0) + 1;
        });

        return { success: true, stats };

    } catch (error: any) {
        console.error("Get KB Stats Error:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteKnowledgeBaseDocument(docId: string) {
    try {
        await adminDb.collection('knowledge_base').doc(docId).delete();
        return { success: true };
    } catch (error: any) {
        console.error("Delete KB Document Error:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteMultipleKnowledgeBaseDocuments(docIds: string[]) {
    try {
        const batch = adminDb.batch();
        for (const docId of docIds) {
            const docRef = adminDb.collection('knowledge_base').doc(docId);
            batch.delete(docRef);
        }
        await batch.commit();
        return { success: true, deleted: docIds.length };
    } catch (error: any) {
        console.error("Bulk Delete KB Documents Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getDocumentById(docId: string) {
    try {
        const doc = await adminDb.collection('knowledge_base').doc(docId).get();

        if (!doc.exists) {
            return { success: false, error: "Document not found" };
        }

        const data = doc.data()!;
        return {
            success: true,
            document: {
                id: doc.id,
                content: data.content,
                visual_description: data.visual_description,
                metadata: {
                    subject: data.metadata?.subject || 'Unknown',
                    bookName: data.metadata?.bookName || 'Unknown',
                    province: data.metadata?.province || 'Unknown',
                    year: data.metadata?.year || 'Unknown',
                    type: data.metadata?.type || 'book',
                    chapter: data.metadata?.chapter || 'Unknown',
                    page: data.metadata?.page || 'Unknown',
                    fileName: data.metadata?.fileName || 'Unknown',
                    uploadedAt: data.metadata?.uploadedAt?.toDate?.() || new Date()
                }
            }
        };

    } catch (error: any) {
        console.error("Get Document Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getUniqueSubjects() {
    try {
        const docs = await adminDb.collection('knowledge_base').select('metadata.subject').get();
        const subjects = new Set<string>();

        docs.forEach((doc) => {
            const subject = doc.data()?.metadata?.subject;
            if (subject) subjects.add(subject);
        });

        return { success: true, subjects: Array.from(subjects).sort() };
    } catch (error: any) {
        return { success: false, error: error.message, subjects: [] };
    }
}
