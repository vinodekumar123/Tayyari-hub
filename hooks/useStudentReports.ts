'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useUserStore } from '@/stores/useUserStore';
import { Report } from '@/types/index';
import { toast } from 'sonner';
import { safeDate } from '@/lib/date-utils';

export function useStudentReports() {
    const { user, isLoading: userLoading } = useUserStore();
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'ignored'>('all');
    const [subjectFilter, setSubjectFilter] = useState<string>('all');

    // Subscribe to reports
    useEffect(() => {
        if (!user) {
            if (!userLoading) setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(
            collection(db, 'reported_questions'),
            where('studentId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const rawReports = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Report[];

            // Sort by createdAt desc
            const sortedReports = rawReports.sort((a, b) => {
                const timeA = safeDate(a.createdAt).getTime();
                const timeB = safeDate(b.createdAt).getTime();
                return timeB - timeA;
            });

            setReports(sortedReports);
            setLoading(false);

            // Enrich missing data *after* initial render to keep UI snappy
            // Filter reports that are missing crucial data
            const missingDataReports = sortedReports.filter(r => !r.subject || !r.options || r.options.length === 0);

            if (missingDataReports.length > 0) {
                enrichReports(missingDataReports);
            }

        }, (error) => {
            console.error("Firestore Error:", error);
            if (error.code === 'failed-precondition') {
                toast.error("Database Index Missing. Please Check Console.");
            } else {
                toast.error("Failed to load reports");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, userLoading]);

    // Helper to fetch missing question data
    const enrichReports = async (reportsToEnrich: Report[]) => {
        const updates = new Map<string, Partial<Report>>();

        // Use a simple concurrency limit or just Promise.all for now as lists are small
        // Optimization: Deduplicate questionIds if multiple reports are for the same question
        const uniqueQuestionIds = Array.from(new Set(reportsToEnrich.map(r => r.questionId)));

        await Promise.all(uniqueQuestionIds.map(async (qId) => {
            try {
                // Check if we already have this data in our local 'reports' state to avoid re-fetch?
                // No, because we entered this block specifically because data was missing.

                // Fetch question
                const qDoc = await getDoc(doc(db, 'questions', qId));
                if (qDoc.exists()) {
                    const qData = qDoc.data();

                    // Apply this question data to ALL reports with this questionId
                    reportsToEnrich.filter(r => r.questionId === qId).forEach(report => {
                        updates.set(report.id, {
                            subject: qData.subject || 'Uncategorized',
                            options: qData.options || [],
                            questionText: qData.questionText || report.questionText,
                            correctAnswer: qData.correctAnswer || report.correctAnswer
                        });
                    });
                }
            } catch (err) {
                console.error(`Failed to fetch question ${qId}`, err);
            }
        }));

        if (updates.size > 0) {
            setReports(prev => prev.map(r => updates.has(r.id) ? { ...r, ...updates.get(r.id) } : r));
        }
    };

    // Derived State
    const subjects = useMemo(() => {
        return Array.from(new Set(reports.map(r => (r.subject || 'Uncategorized').trim()).filter(Boolean)));
    }, [reports]);

    const filteredReports = useMemo(() => {
        return reports.filter(report => {
            const matchStatus = statusFilter === 'all' || report.status === statusFilter;
            const reportSubject = (report.subject || 'Uncategorized').trim();
            const matchSubject = subjectFilter === 'all' || reportSubject === subjectFilter;
            return matchStatus && matchSubject;
        });
    }, [reports, statusFilter, subjectFilter]);

    const resetFilters = () => {
        setStatusFilter('all');
        setSubjectFilter('all');
    };

    return {
        reports,
        filteredReports,
        loading,
        subjects,
        statusFilter,
        subjectFilter,
        setStatusFilter,
        setSubjectFilter,
        resetFilters
    };
}
