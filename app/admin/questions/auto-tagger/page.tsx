'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Loader2,
    Play,
    Pause,
    Square,
    CheckCircle2,
    Clock,
    Database,
    BrainCircuit,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
    collection,
    getDocs,
    query,
    where,
    updateDoc,
    doc,
    writeBatch,
    getFirestore,
    limit // Imported limit
} from 'firebase/firestore';
import { app } from '../../../firebase';
import { glassmorphism } from '@/lib/design-tokens';

// Initialize Firestore
const db = getFirestore(app);

interface Course {
    id: string;
    name: string;
    subjectIds?: string[];
}

interface Subject {
    id: string;
    name: string;
    chapters?: { [key: string]: boolean } | string[];
}

interface ProcessLog {
    id: string;
    questionPreview: string;
    oldChapter?: string;
    newChapter: string;
    difficulty: string;
    status: 'success' | 'error';
    timestamp: string;
}

export default function AutoTaggerPage() {
    // Data State
    const [courses, setCourses] = useState<Course[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [validChapters, setValidChapters] = useState<string[]>([]);
    const [isStarting, setIsStarting] = useState(false);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    // Processing State
    const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [logs, setLogs] = useState<ProcessLog[]>([]);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Refs for loop control
    const isRunningRef = useRef(false);
    const processedCountRef = useRef(0);

    // Constants
    const BATCH_SIZE = 5; // Reduced from 10 to prevent timeouts

    const addDebugLog = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
        console.log(msg);
    };

    // --- Initialization ---

    useEffect(() => {
        const fetchData = async () => {
            try {
                const courseSnap = await getDocs(collection(db, 'courses'));
                const coursesData = courseSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
                setCourses(coursesData);

                const subjectSnap = await getDocs(collection(db, 'subjects'));
                const subjectsData = subjectSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
                setAllSubjects(subjectsData);
            } catch (e) {
                console.error(e);
                toast.error("Failed to load metadata");
            }
        };
        fetchData();
    }, []);

    // When subject changes, load chapters
    useEffect(() => {
        if (selectedSubject) {
            const sub = allSubjects.find(s => s.name === selectedSubject);
            console.log("Selected Subject Data:", sub);
            if (sub?.chapters) {
                if (Array.isArray(sub.chapters)) {
                    setValidChapters(sub.chapters);
                } else if (typeof sub.chapters === 'object') {
                    setValidChapters(Object.keys(sub.chapters));
                } else {
                    setValidChapters([]);
                    toast.error("Invalid chapters format in DB");
                }
            } else {
                setValidChapters([]);
                console.warn("No chapters found in subject document");
            }
            // Reset Stats
            resetStats();
        }
    }, [selectedSubject, allSubjects]);

    const resetStats = () => {
        setStatus('idle');
        setTotalQuestions(0);
        setProcessedCount(0);
        processedCountRef.current = 0;
        setLogs([]);
        setStartTime(null);
        setDebugLogs([]);
    };

    // --- Logic ---

    const fetchQuestionCount = async () => {
        if (!selectedCourse || !selectedSubject) return;
        addDebugLog(`Fetching questions: Course=${selectedCourse}, Subject=${selectedSubject}`);
        try {
            let q = query(
                collection(db, 'questions'),
                where('courseId', '==', selectedCourse),
                where('subject', '==', selectedSubject)
            );
            let snap = await getDocs(q);

            // ORPHAN RECOVERY LOGIC - START
            if (snap.empty) {
                addDebugLog("Strict match failed (0 docs). Attempting Orphan Recovery...");
                // Query by Subject Only
                const looseQ = query(
                    collection(db, 'questions'),
                    where('subject', '==', selectedSubject)
                );
                const looseSnap = await getDocs(looseQ);

                if (!looseSnap.empty) {
                    addDebugLog(`RECOVERY: Found ${looseSnap.size} orphan questions with matching Subject.`);
                    addDebugLog(`IMPORTANT: These will be adopted into Course ${selectedCourse} upon processing.`);
                    toast.warning(`Found ${looseSnap.size} orphan questions. They will be fixed & tagged.`);
                    setTotalQuestions(looseSnap.size);
                    return looseSnap.docs;
                } else {
                    addDebugLog("Recovery failed: No questions found for this Subject at all (orphan or valid).");
                }
            } else {
                addDebugLog(`Fetch success: ${snap.size} docs found.`);
            }
            // ORPHAN RECOVERY LOGIC - END

            setTotalQuestions(snap.size);
            return snap.docs;
        } catch (e: any) {
            addDebugLog(`Fetch Error: ${e.message}`);
            console.error(e);
            toast.error(`Fetch failed: ${e.message}`);
            return null;
        }
    };

    const startProcessing = async () => {
        addDebugLog(`startProcessing clicked. Status: ${status}`);
        setIsStarting(true);

        try {
            if (!selectedCourse || !selectedSubject) {
                toast.error("Please select Course and Subject");
                return;
            }
            if (validChapters.length === 0) {
                toast.error("This subject has no chapters defined in the database.");
                return;
            }

            if (status === 'idle' || status === 'completed') {
                const docs = await fetchQuestionCount();

                if (!docs || docs.length === 0) {
                    addDebugLog("No docs returned or empty array.");
                    toast.error("No questions found for this selection");
                    return;
                }
                addDebugLog(`Starting queue with ${docs.length} questions...`);
                setStartTime(Date.now());
                setStatus('running');
                isRunningRef.current = true;
                processQueue(docs);
            } else if (status === 'paused') {
                addDebugLog("Resuming...");
                setStatus('running');
                isRunningRef.current = true;
            }
        } catch (e: any) {
            console.error("Error starting:", e);
            addDebugLog(`Error in startProcessing: ${e.message}`);
            toast.error("Failed to start processing");
        } finally {
            setIsStarting(false);
        }
    };

    const pauseProcessing = () => {
        setStatus('paused');
        isRunningRef.current = false;
    };

    const stopProcessing = () => {
        setStatus('idle');
        isRunningRef.current = false;
    };

    const processQueue = async (allDocs: any[]) => {
        let currentIndex = processedCountRef.current;

        while (currentIndex < allDocs.length && isRunningRef.current) {
            const batchDocs = allDocs.slice(currentIndex, currentIndex + BATCH_SIZE);
            if (batchDocs.length === 0) break;

            try {
                // Prepare payload
                const questionsPayload = batchDocs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        text: data.questionText?.replace(/<[^>]*>/g, '') || '', // Strip HTML for AI cost saving
                        options: data.options
                    };
                });

                // Call API
                addDebugLog(`Sending Batch ${String(Math.floor(processedCountRef.current / BATCH_SIZE) + 1)} to AI (Size: ${questionsPayload.length})...`);

                const response = await fetch('/api/ai/auto-tag', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        questions: questionsPayload,
                        validChapters,
                        subject: selectedSubject
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    addDebugLog(`API Error ${response.status}: ${errText.substring(0, 50)}`);
                    throw new Error(`API ${response.status}`);
                }

                const result = await response.json();
                addDebugLog(`AI Response received. Results: ${result?.results?.length || 0}`);

                if (result.results) {
                    // Batch Update Firestore
                    const batch = writeBatch(db);
                    const newLogs: ProcessLog[] = [];
                    addDebugLog("Writing updates to Firestore...");

                    result.results.forEach((item: any) => {
                        const docRef = doc(db, 'questions', item.id);
                        batch.update(docRef, {
                            chapter: item.chapter,
                            difficulty: item.difficulty,
                            courseId: selectedCourse, // AUTO-FIX: Ensure courseId is set correctly
                            aiTagged: true,
                            updatedAt: new Date() // Use serverTimestamp in real app if possible
                        });

                        // Log
                        const originalDoc = batchDocs.find(d => d.id === item.id);
                        const qText = originalDoc?.data().questionText || "";

                        newLogs.push({
                            id: item.id,
                            questionPreview: qText.substring(0, 50) + "...",
                            oldChapter: originalDoc?.data().chapter || "N/A",
                            newChapter: item.chapter,
                            difficulty: item.difficulty,
                            status: 'success',
                            timestamp: new Date().toLocaleTimeString()
                        });
                    });

                    await batch.commit();
                    addDebugLog("Firestore batch committed.");

                    // Update State
                    processedCountRef.current += batchDocs.length;
                    setProcessedCount(processedCountRef.current);
                    setLogs(prev => [...newLogs, ...prev].slice(0, 100)); // Keep last 100
                    addDebugLog(`Batch success! Moving to next...`);
                } else {
                    addDebugLog("Warning: No results array in AI response.");
                }

            } catch (err: any) {
                console.error("Batch failed", err);
                addDebugLog(`Batch failed: ${err.message}`);
                toast.error("Batch failed, skipping...");
            }

            // Delay to respect rate limits if needed
            await new Promise(r => setTimeout(r, 1000));

            currentIndex += BATCH_SIZE;

            if (currentIndex >= allDocs.length) {
                setStatus('completed');
                isRunningRef.current = false;
                toast.success("All questions processed!");
                addDebugLog("Queue processing completed.");
            }
        }
    };

    // --- Helpers ---

    const calculateTimeLeft = () => {
        if (processedCount === 0 || !startTime) return "Calculating...";
        const elapsed = Date.now() - startTime;
        const rate = processedCount / elapsed; // questions per ms
        const remaining = totalQuestions - processedCount;
        const msLeft = remaining / rate;

        if (remaining <= 0) return "Done";

        // Format
        const mins = Math.floor(msLeft / 60000);
        const secs = Math.floor((msLeft % 60000) / 1000);
        return `${mins}m ${secs}s`;
    };

    const progressPercentage = totalQuestions > 0 ? (processedCount / totalQuestions) * 100 : 0;

    return (
        <div className="container mx-auto py-8 max-w-6xl space-y-8">
            {/* Header */}
            <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 blur-xl" />
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] to-[#00B4D8] mb-2">
                            AI Auto-Tagger
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4" />
                            Automatically classify chapters & difficulty for your Question Bank
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <div className="bg-white/50 p-4 rounded-xl border border-gray-200 backdrop-blur-sm">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Model</div>
                            <div className="font-mono text-sm font-semibold text-green-600">Gemini 1.5 Flash</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-t-4 border-t-blue-500 shadow-lg">
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                            <CardDescription>Select target scope</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Course</label>
                                <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={status === 'running'}>
                                    <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                                    <SelectContent>
                                        {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Subject</label>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={status === 'running'}>
                                    <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                    <SelectContent>
                                        {allSubjects
                                            .filter(s => {
                                                const c = courses.find(course => course.id === selectedCourse);
                                                return c?.subjectIds?.includes(s.id);
                                            })
                                            .map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)
                                        }
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedSubject && (
                                <div className={`p-3 rounded-lg border text-xs ${validChapters.length > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    <strong>{validChapters.length} Valid Chapters</strong> loaded.
                                    {validChapters.length === 0 && <div className="mt-1">Please add chapters to this subject in the database first.</div>}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {status === 'running' ? (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" onClick={pauseProcessing} className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                                        <Pause className="w-4 h-4 mr-2" /> Pause
                                    </Button>
                                    <Button variant="destructive" onClick={stopProcessing} className="w-full">
                                        <Square className="w-4 h-4 mr-2" /> Stop
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    className="w-full bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white shadow-md hover:shadow-lg transition-all"
                                    size="lg"
                                    onClick={startProcessing}
                                    disabled={!selectedCourse || !selectedSubject || isStarting}
                                >
                                    {isStarting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...
                                        </>
                                    ) : (
                                        <>
                                            {status === 'paused' ? 'Resume Processing' : 'Start Processing'}
                                            <Play className="w-4 h-4 ml-2 fill-current" />
                                        </>
                                    )}
                                </Button>
                            )}

                            <div className="text-xs text-center text-muted-foreground">
                                Batch Size: {BATCH_SIZE} questions/req
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Progress & Logs */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-white/50 backdrop-blur">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Database className="w-6 h-6 text-blue-500 mb-2" />
                                <div className="text-2xl font-bold">{totalQuestions}</div>
                                <div className="text-xs text-muted-foreground">Total Questions</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/50 backdrop-blur">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <CheckCircle2 className="w-6 h-6 text-green-500 mb-2" />
                                <div className="text-2xl font-bold">{processedCount}</div>
                                <div className="text-xs text-muted-foreground">Processed</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/50 backdrop-blur">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Loader2 className={`w-6 h-6 text-orange-500 mb-2 ${status === 'running' ? 'animate-spin' : ''}`} />
                                <div className="text-2xl font-bold">{totalQuestions - processedCount}</div>
                                <div className="text-xs text-muted-foreground">Remaining</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/50 backdrop-blur">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Clock className="w-6 h-6 text-purple-500 mb-2" />
                                <div className="text-xl font-bold truncate w-full">{calculateTimeLeft()}</div>
                                <div className="text-xs text-muted-foreground">Est. Time Left</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Main Progress Bar */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-semibold">Overall Progress</span>
                                <span className="text-sm font-mono">{progressPercentage.toFixed(1)}%</span>
                            </div>
                            <Progress value={progressPercentage} className="h-4 bg-muted" indicatorClassName="bg-gradient-to-r from-blue-600 to-cyan-500" />
                        </CardContent>
                    </Card>

                    {/* Live Logs */}
                    <Card className="h-[400px] flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-lg">Live Processing Log</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="p-3 font-medium">Question</th>
                                        <th className="p-3 font-medium">Old Chapter</th>
                                        <th className="p-3 font-medium">New Chapter (AI)</th>
                                        <th className="p-3 font-medium">Difficulty</th>
                                        <th className="p-3 font-medium">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                                No logs yet. Start processing to see real-time updates.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log, i) => (
                                            <tr key={log.id + i} className="hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-top-1">
                                                <td className="p-3 max-w-[200px] truncate" title={log.questionPreview}>
                                                    {log.questionPreview}
                                                </td>
                                                <td className="p-3 text-muted-foreground">{log.oldChapter}</td>
                                                <td className="p-3 text-blue-600 font-medium">{log.newChapter}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                                ${log.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                                            log.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'}`}>
                                                        {log.difficulty}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-xs text-muted-foreground">{log.timestamp}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    {/* Debug Console */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Debug Console</CardTitle>
                        </CardHeader>
                        <CardContent className="h-40 overflow-auto bg-black text-green-400 font-mono text-xs p-4 rounded-b-xl">
                            {debugLogs.length === 0 ? "Ready..." : debugLogs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}
