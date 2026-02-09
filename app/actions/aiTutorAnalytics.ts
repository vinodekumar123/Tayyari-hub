'use server';

import { adminDb } from '@/lib/firebase-admin';

export interface TutorAnalytics {
    totalQueries: number;
    cachedResponses: number;
    avgResponseTimeMs: number;
    queriesBySubject: Record<string, number>;
    queriesByIntent: Record<string, number>;
    confidenceDistribution: Record<string, number>;
    topQueries: { query: string; count: number }[];
    feedbackSummary: { helpful: number; notHelpful: number };
    queriesOverTime: { date: string; count: number }[];
}

export async function getAITutorAnalytics(days: number = 7): Promise<{
    success: boolean;
    data?: TutorAnalytics;
    error?: string;
}> {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const logsSnapshot = await adminDb
            .collection('ai_tutor_logs')
            .where('timestamp', '>=', startDate)
            .orderBy('timestamp', 'desc')
            .limit(5000)
            .get();

        if (logsSnapshot.empty) {
            return {
                success: true,
                data: {
                    totalQueries: 0,
                    cachedResponses: 0,
                    avgResponseTimeMs: 0,
                    queriesBySubject: {},
                    queriesByIntent: {},
                    confidenceDistribution: {},
                    topQueries: [],
                    feedbackSummary: { helpful: 0, notHelpful: 0 },
                    queriesOverTime: []
                }
            };
        }

        let totalResponseTime = 0;
        let cachedCount = 0;
        const queriesBySubject: Record<string, number> = {};
        const queriesByIntent: Record<string, number> = {};
        const confidenceDistribution: Record<string, number> = { high: 0, medium: 0, low: 0 };
        const queryFrequency: Record<string, number> = {};
        const dateCount: Record<string, number> = {};

        logsSnapshot.forEach(doc => {
            const data = doc.data();

            // Response time
            totalResponseTime += data.responseTimeMs || 0;

            // Cache hits
            if (data.wasFromCache) cachedCount++;

            // Subject distribution
            const subject = data.subject || 'general';
            queriesBySubject[subject] = (queriesBySubject[subject] || 0) + 1;

            // Intent distribution
            const intent = data.intent || 'general';
            queriesByIntent[intent] = (queriesByIntent[intent] || 0) + 1;

            // Query frequency (normalized)
            const normalizedQuery = data.query?.toLowerCase().trim().substring(0, 50) || 'unknown';
            queryFrequency[normalizedQuery] = (queryFrequency[normalizedQuery] || 0) + 1;

            // Date aggregation
            if (data.timestamp) {
                const date = data.timestamp.toDate?.().toISOString().split('T')[0] || 'unknown';
                dateCount[date] = (dateCount[date] || 0) + 1;
            }
        });

        // Top queries
        const topQueries = Object.entries(queryFrequency)
            .map(([query, count]) => ({ query, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Queries over time
        const queriesOverTime = Object.entries(dateCount)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            success: true,
            data: {
                totalQueries: logsSnapshot.size,
                cachedResponses: cachedCount,
                avgResponseTimeMs: Math.round(totalResponseTime / logsSnapshot.size),
                queriesBySubject,
                queriesByIntent,
                confidenceDistribution,
                topQueries,
                feedbackSummary: { helpful: 0, notHelpful: 0 }, // TODO: Add feedback tracking
                queriesOverTime
            }
        };

    } catch (error: any) {
        console.error('Analytics Error:', error);
        return { success: false, error: error.message };
    }
}

export async function testVectorSearch(query: string): Promise<{
    success: boolean;
    results?: {
        type: string;
        bookName: string;
        chapter: string;
        page: string;
        contentPreview: string;
        subject: string;
    }[];
    error?: string;
}> {
    try {
        const { generateEmbedding } = await import('@/lib/gemini');

        const embedding = await generateEmbedding(query);

        const knowledgeColl = adminDb.collection('knowledge_base');

        const vectorQuery = knowledgeColl.findNearest('embedding', embedding, {
            limit: 10,
            distanceMeasure: 'COSINE'
        });

        const snapshot = await vectorQuery.get();

        const results = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                type: data.metadata?.type || 'book',
                bookName: data.metadata?.bookName || 'Unknown',
                chapter: data.metadata?.chapter || 'Unknown',
                page: data.metadata?.page || 'Unknown',
                contentPreview: data.content?.substring(0, 200) + '...' || '',
                subject: data.metadata?.subject || 'Unknown'
            };
        });

        return { success: true, results };

    } catch (error: any) {
        console.error('Vector Search Test Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getRecentConversations(limit: number = 50): Promise<{
    success: boolean;
    conversations?: {
        id: string;
        query: string;
        responsePreview: string;
        subject: string | null;
        intent: string;
        responseTimeMs: number;
        wasFromCache: boolean;
        timestamp: Date;
        userName?: string;
        userId?: string;
        feedback?: string;
    }[];
    error?: string;
}> {
    try {
        const snapshot = await adminDb
            .collection('ai_tutor_logs')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const conversations = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                query: data.query || '',
                responsePreview: data.response?.substring(0, 100) + '...' || '',
                subject: data.subject,
                intent: data.intent || 'general',
                responseTimeMs: data.responseTimeMs || 0,
                wasFromCache: data.wasFromCache || false,
                timestamp: data.timestamp?.toDate() || new Date(),
                userName: data.userName,
                userId: data.userId,
                feedback: data.feedback
            };
        });

        return { success: true, conversations };

    } catch (error: any) {
        console.error('Get Conversations Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getStudentChatHistory(userId: string): Promise<{
    success: boolean;
    history?: any[];
    error?: string;
}> {
    try {
        const snapshot = await adminDb
            .collection('ai_tutor_logs')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        const history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate()
        }));

        return { success: true, history };
    } catch (error: any) {
        console.error('Get Student History Error:', error);
        return { success: false, error: error.message };
    }
}
