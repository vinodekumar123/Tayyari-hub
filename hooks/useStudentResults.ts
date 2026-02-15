'use client';

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '@/app/firebase';
import { collection, getDocs, doc, getDoc, query, orderBy, where } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export type ResultType = 'admin' | 'user';

export interface QuizResult {
    id: string;
    quizId: string; // The ID of the quiz definition
    title: string;
    subject: string;
    chapter: string;
    course: string;
    isMock: boolean;
    timestamp: any;
    score: number;
    total: number;
    type: ResultType;
    date: Date | null;
}

export interface ResultsStats {
    total: number;
    avgScore: string;
    completed: number; // "Perfect Scores" in UI context
}

export function useStudentResults() {
    const [user, setUser] = useState<User | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userCourse, setUserCourse] = useState('');

    const [adminResults, setAdminResults] = useState<QuizResult[]>([]);
    const [userResults, setUserResults] = useState<QuizResult[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [viewType, setViewType] = useState<ResultType>('admin');
    const [search, setSearch] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('all');
    const [selectedChapter, setSelectedChapter] = useState('all');
    const [subjects, setSubjects] = useState<string[]>([]);
    const [chapters, setChapters] = useState<string[]>([]);
    const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});

    // Auth
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                setUserId(u.uid);
                const userDoc = await getDoc(doc(db, 'users', u.uid));
                if (userDoc.exists()) setUserCourse(userDoc.data().course);
            } else {
                setUser(null);
                setUserId(null);
            }
        });
        return () => unsub();
    }, []);

    // Fetch Subjects for Filters
    useEffect(() => {
        const fetchSubjects = async () => {
            if (!userCourse) return;
            // Simplified logic: Fetch courses, find user's course, get subject IDs
            // This could be optimized if we knew the course ID directly
            const courseDocs = await getDocs(collection(db, 'courses'));
            const courseDoc = courseDocs.docs.find(d => d.data().name === userCourse);

            if (!courseDoc) return;
            const subjectIds = courseDoc.data().subjectIds || [];

            const tempSubjects: string[] = [];
            const map: Record<string, string> = {};

            // Batch fetching would be better but simple parallel is okay for low count
            await Promise.all(subjectIds.map(async (id: string) => {
                const snap = await getDoc(doc(db, 'subjects', id));
                if (snap.exists()) {
                    const data = snap.data();
                    tempSubjects.push(data.name);
                    map[data.name] = id;
                }
            }));
            setSubjects(tempSubjects);
            setSubjectMap(map);
        };
        fetchSubjects();
    }, [userCourse]);

    // Fetch Chapters when Subject Selected
    useEffect(() => {
        const fetchChapters = async () => {
            if (selectedSubject === 'all' || !subjectMap[selectedSubject]) {
                setChapters([]);
                return;
            }
            const sId = subjectMap[selectedSubject];
            const snap = await getDoc(doc(db, 'subjects', sId));
            if (snap.exists()) {
                const data = snap.data();
                setChapters(data.chapters ? Object.keys(data.chapters) : []);
            }
        };
        fetchChapters();
    }, [selectedSubject, subjectMap]);

    // Main Data Fetching
    useEffect(() => {
        const fetchAllResults = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }
            setLoading(true);

            // 1. Admin/Mock Quizzes
            const fetchAdminResults = async () => {
                const paths = [
                    { path: 'quizAttempts', src: 'quizzes', mock: false },
                    { path: 'mock-quizAttempts', src: 'mock-quizzes', mock: true }
                ];

                const results: QuizResult[] = [];

                for (const { path, src, mock } of paths) {
                    const attemptsSnap = await getDocs(collection(db, 'users', userId, path));

                    // Optimization: Deduplicate quiz IDs to fetch metadata once if multiple attempts exist?
                    // Attempts collection structure: docId is quizId usually? OR one doc per attempt?
                    // Previous code assumed docId IS quizId and only one attempt shown per quiz in this list?
                    // Actually previous code: `getDoc(doc(db, 'users', userId, attemptPath, quizId, 'results', quizId))`
                    // This creates a weird structure where only one result is fetched per quiz ID.

                    await Promise.all(attemptsSnap.docs.map(async (d) => {
                        const quizId = d.id;
                        // Parallel fetch result and quiz metadata
                        const [resSnap, quizSnap] = await Promise.all([
                            getDoc(doc(db, 'users', userId, path, quizId, 'results', quizId)),
                            getDoc(src === 'mock-quizzes' ? doc(db, 'users', userId, 'mock-quizzes', quizId) : doc(db, 'quizzes', quizId))
                        ]);

                        if (resSnap.exists() && quizSnap.exists()) {
                            const rData = resSnap.data();
                            const qData = quizSnap.data();

                            // Helpers to extract messy field formats
                            const getSubjects = () => {
                                if (qData.questionFilters?.subjects?.length) return qData.questionFilters.subjects.join(', ');
                                if (qData.subjects?.length) return qData.subjects.map((s: any) => typeof s === 'string' ? s : s?.name).join(', ');
                                return qData.subject?.name || qData.subject || 'N/A';
                            };

                            const getChapters = () => {
                                if (qData.questionFilters?.chapters?.length) return qData.questionFilters.chapters.join(', ');
                                return qData.chapter?.name || qData.chapter || 'N/A';
                            };

                            const questions = qData.selectedQuestions || [];
                            const answers = rData.answers || {};
                            const correct = questions.filter((q: any) => answers[q.id] === q.correctAnswer).length;

                            results.push({
                                id: quizId,
                                quizId: quizId,
                                title: qData.title || 'Untitled',
                                subject: getSubjects(),
                                chapter: getChapters(),
                                course: qData.course?.name || qData.course || 'N/A',
                                isMock: mock,
                                timestamp: rData.timestamp,
                                date: rData.timestamp?.toDate ? rData.timestamp.toDate() : null,
                                score: correct,
                                total: questions.length,
                                type: 'admin'
                            });
                        }
                    }));
                }
                return results.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            };

            // 2. User Quizzes
            const fetchUserResults = async () => {
                try {
                    const q = query(collection(db, 'users', userId, 'user-quizattempts'), orderBy('submittedAt', 'desc'));
                    const snap = await getDocs(q);

                    const attempts: any[] = [];
                    // Need to fetch metadata for titles
                    await Promise.all(snap.docs.map(async (docSnap) => {
                        const data = docSnap.data();
                        if (!data.completed) return;

                        const metaSnap = await getDoc(doc(db, 'user-quizzes', docSnap.id)); // Assuming docId matches
                        let title = 'Quiz';
                        let subject = 'N/A';

                        if (metaSnap.exists()) {
                            const meta = metaSnap.data();
                            title = meta.name || meta.title || 'Quiz';
                            if (meta.subjects?.length) subject = meta.subjects.join(', ');
                            else if (meta.subject) subject = meta.subject;
                        }

                        attempts.push({
                            id: docSnap.id,
                            quizId: docSnap.id,
                            title,
                            subject,
                            chapter: 'N/A', // User quizzes usually don't have chapter structure deeply
                            course: 'N/A',
                            isMock: false,
                            timestamp: data.submittedAt,
                            date: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt?.seconds * 1000),
                            score: data.score,
                            total: data.total,
                            type: 'user'
                        });
                    }));

                    return attempts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
                } catch (e) {
                    console.error(e);
                    return [];
                }
            };

            // Execute parallel
            const [adminData, userData] = await Promise.all([fetchAdminResults(), fetchUserResults()]);
            setAdminResults(adminData);
            setUserResults(userData);
            setLoading(false);
        };

        fetchAllResults();
    }, [userId]);

    // Processing & Filtering
    const filteredResults = useMemo(() => {
        let list = viewType === 'admin' ? adminResults : userResults;
        const lowerSearch = search.toLowerCase();

        return list.filter(r => {
            const matchesSearch =
                (r.title || '').toLowerCase().includes(lowerSearch) ||
                (r.subject || '').toLowerCase().includes(lowerSearch);

            const matchesSubject = selectedSubject === 'all' || (r.subject || '').includes(selectedSubject); // Includes because subject might be list string

            // Only admin quizzes have chapter filtering usually
            const matchesChapter = viewType === 'user' || selectedChapter === 'all' || (r.chapter || '').includes(selectedChapter);

            return matchesSearch && matchesSubject && matchesChapter;
        });
    }, [viewType, adminResults, userResults, search, selectedSubject, selectedChapter]);

    const stats: ResultsStats = useMemo(() => {
        if (filteredResults.length === 0) return { total: 0, avgScore: '0', completed: 0 };

        const total = filteredResults.length;
        const sumPct = filteredResults.reduce((acc, r) => acc + (r.total > 0 ? (r.score / r.total) * 100 : 0), 0);
        const perfect = filteredResults.filter(r => r.score === r.total && r.total > 0).length;

        return {
            total,
            avgScore: (sumPct / total).toFixed(1),
            completed: perfect
        };
    }, [filteredResults]);

    return {
        user,
        userId,
        viewType, setViewType,
        loading,
        filteredResults,
        stats,
        search, setSearch,
        selectedSubject, setSelectedSubject,
        selectedChapter, setSelectedChapter,
        subjects,
        chapters,
    };
}
