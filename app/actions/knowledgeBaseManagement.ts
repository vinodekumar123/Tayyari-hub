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
    chapterFilter?: string;
    searchQuery?: string;
}

export async function getKnowledgeBaseDocuments(params: GetDocumentsParams = {}) {
    try {
        const { limit = 50, startAfter, subjectFilter, typeFilter, chapterFilter } = params;

        let query: any = adminDb.collection('knowledge_base').orderBy('metadata.uploadedAt', 'desc');

        // Apply filters
        if (subjectFilter) {
            query = query.where('metadata.subject', '==', subjectFilter);
        }
        if (typeFilter) {
            query = query.where('metadata.type', '==', typeFilter);
        }
        if (chapterFilter) {
            query = query.where('metadata.chapter', '==', chapterFilter);
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

/**
 * Bulk update subject for multiple documents
 */
export async function bulkUpdateSubject(docIds: string[], newSubject: string) {
    try {
        const batch = adminDb.batch();
        for (const docId of docIds) {
            const docRef = adminDb.collection('knowledge_base').doc(docId);
            batch.update(docRef, { 'metadata.subject': newSubject });
        }
        await batch.commit();
        return { success: true, updated: docIds.length };
    } catch (error: any) {
        console.error('Bulk Update Subject Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Re-embed a document with the latest embedding model
 */
export async function reEmbedDocument(docId: string) {
    try {
        const { generateEmbedding } = await import('@/lib/gemini');
        const { FieldValue } = await import('firebase-admin/firestore');

        const docRef = adminDb.collection('knowledge_base').doc(docId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return { success: false, error: 'Document not found' };
        }

        const data = doc.data()!;

        // Build embedding text
        const textToEmbed = `
            Subject: ${data.metadata?.subject || ''}
            Book: ${data.metadata?.bookName || ''}
            Chapter: ${data.metadata?.chapter || ''}
            Content: ${data.content || ''}
            Visuals: ${data.visual_description || ''}
        `.trim();

        const embedding = await generateEmbedding(textToEmbed);

        await docRef.update({
            embedding: FieldValue.vector(embedding),
            'metadata.lastEmbeddedAt': new Date()
        });

        return { success: true };
    } catch (error: any) {
        console.error('Re-embed Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Batch re-embed multiple documents
 */
export async function batchReEmbed(docIds: string[]): Promise<{ success: boolean; completed: number; failed: number; error?: string }> {
    let completed = 0;
    let failed = 0;

    try {
        for (const docId of docIds) {
            const result = await reEmbedDocument(docId);
            if (result.success) {
                completed++;
            } else {
                failed++;
            }
        }

        return { success: true, completed, failed };
    } catch (error: any) {
        return { success: false, completed, failed, error: error.message };
    }
}

/**
 * Calculate quality score for a document
 */
export interface DocumentQuality {
    id: string;
    score: number; // 0-100
    issues: string[];
    hasContent: boolean;
    hasVisualDesc: boolean;
    hasEmbedding: boolean;
    contentLength: number;
}

export async function getDocumentQuality(docId: string): Promise<{ success: boolean; quality?: DocumentQuality; error?: string }> {
    try {
        const doc = await adminDb.collection('knowledge_base').doc(docId).get();

        if (!doc.exists) {
            return { success: false, error: 'Document not found' };
        }

        const data = doc.data()!;
        const issues: string[] = [];
        let score = 100;

        // Check content
        const hasContent = !!data.content && data.content.length > 50;
        if (!hasContent) {
            issues.push('Content is empty or too short');
            score -= 30;
        }

        // Check visual description
        const hasVisualDesc = !!data.visual_description && data.visual_description.length > 20;
        if (!hasVisualDesc) {
            issues.push('Missing visual description');
            score -= 10;
        }

        // Check embedding
        const hasEmbedding = !!data.embedding && Array.isArray(data.embedding);
        if (!hasEmbedding) {
            issues.push('Missing embedding - document will not appear in searches');
            score -= 40;
        }

        // Check metadata
        if (!data.metadata?.subject || data.metadata.subject === 'Unknown') {
            issues.push('Missing or unknown subject');
            score -= 10;
        }
        if (!data.metadata?.chapter || data.metadata.chapter === 'Unknown') {
            issues.push('Missing chapter information');
            score -= 5;
        }
        if (!data.metadata?.page || data.metadata.page === 'Unknown') {
            issues.push('Missing page number');
            score -= 5;
        }

        return {
            success: true,
            quality: {
                id: docId,
                score: Math.max(0, score),
                issues,
                hasContent,
                hasVisualDesc,
                hasEmbedding,
                contentLength: data.content?.length || 0
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Get quality summary for all documents
 */
export async function getKnowledgeBaseQualitySummary(): Promise<{
    success: boolean;
    summary?: {
        totalDocs: number;
        avgScore: number;
        docsWithIssues: number;
        commonIssues: Record<string, number>;
    };
    error?: string;
}> {
    try {
        const allDocs = await adminDb.collection('knowledge_base').get();

        let totalScore = 0;
        let docsWithIssues = 0;
        const issueCount: Record<string, number> = {};

        for (const doc of allDocs.docs) {
            const qualityResult = await getDocumentQuality(doc.id);
            if (qualityResult.success && qualityResult.quality) {
                totalScore += qualityResult.quality.score;
                if (qualityResult.quality.issues.length > 0) {
                    docsWithIssues++;
                    qualityResult.quality.issues.forEach(issue => {
                        issueCount[issue] = (issueCount[issue] || 0) + 1;
                    });
                }
            }
        }

        return {
            success: true,
            summary: {
                totalDocs: allDocs.size,
                avgScore: Math.round(totalScore / allDocs.size),
                docsWithIssues,
                commonIssues: issueCount
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Export knowledge base as JSON
 */
export async function exportKnowledgeBase(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
        const allDocs = await adminDb.collection('knowledge_base').get();

        const data = allDocs.docs.map(doc => {
            const docData = doc.data();
            return {
                id: doc.id,
                content: docData.content,
                visual_description: docData.visual_description,
                metadata: {
                    subject: docData.metadata?.subject,
                    bookName: docData.metadata?.bookName,
                    province: docData.metadata?.province,
                    year: docData.metadata?.year,
                    type: docData.metadata?.type,
                    chapter: docData.metadata?.chapter,
                    page: docData.metadata?.page,
                    fileName: docData.metadata?.fileName
                }
            };
        });

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
export async function getAllSubjectsWithChapters() {
    try {
        const subjectsSnap = await adminDb.collection('subjects').get();
        const subjects = subjectsSnap.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name as string,
            chapters: doc.data().chapters as Record<string, boolean>
        }));
        return { success: true, subjects };
    } catch (error: any) {
        console.error("Get All Subjects Error:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all content for a specific subject and chapter
 * Concatenates text from all matching documents.
 */
export async function getChapterContent(subject: string, chapter: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
        if (!subject || !chapter) {
            return { success: false, error: "Subject and Chapter are required" };
        }

        const snapshot = await adminDb.collection('knowledge_base')
            .where('metadata.subject', '==', subject)
            .where('metadata.chapter', '==', chapter)
            .get();

        if (snapshot.empty) {
            return { success: false, error: `No content found for ${subject} - ${chapter}` };
        }

        let fullContent = "";
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.content) {
                fullContent += `\n--- Source: ${data.metadata?.fileName || 'Unknown'} ---\n`;
                fullContent += data.content + "\n";
            }
            if (data.visual_description) {
                fullContent += `[Visual Description: ${data.visual_description}]\n`;
            }
        });

        return { success: true, content: fullContent };
    } catch (error: any) {
        console.error("Get Chapter Content Error:", error);
        return { success: false, error: error.message };
    }
}
