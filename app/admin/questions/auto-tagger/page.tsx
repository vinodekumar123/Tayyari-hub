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
    AlertCircle,
    BookOpenCheck,
    RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input'; // New Input import
import { toast } from 'sonner';
import {
    collection,
    getDocs,
    getFirestore
} from 'firebase/firestore';
import { app, auth } from '../../../firebase'; // Auth needed for userId
import { glassmorphism } from '@/lib/design-tokens';

// Initialize Firestore
const db = getFirestore(app);

// Interfaces
interface Course { id: string; name: string; subjectIds?: string[]; }
interface Subject { id: string; name: string; chapters?: { [key: string]: boolean } | string[]; }

interface ProcessLog {
    id: string;
    questionPreview: string;
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
    const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
    const [processingMode, setProcessingMode] = useState<'pending' | 'all'>('pending');
    const [syllabusContext, setSyllabusContext] = useState('FSC Sindh Board New Syllabus');
    const [validChapters, setValidChapters] = useState<string[]>([]);
    const [batchSize, setBatchSize] = useState(15);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    // Job State
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'paused' | 'completed' | 'failed'>('idle');
    const [jobProgress, setJobProgress] = useState({ total: 0, processed: 0, failed: 0 });
    const [logs, setLogs] = useState<ProcessLog[]>([]);

    // Polling Ref
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const addDebugLog = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
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
                toast.error("Failed to load metadata");
            }
        };
        fetchData();
    }, []);

    // Subject Change Handler
    useEffect(() => {
        if (selectedSubject) {
            const sub = allSubjects.find(s => s.name === selectedSubject);
            if (sub?.chapters) {
                if (Array.isArray(sub.chapters)) setValidChapters(sub.chapters);
                else setValidChapters(Object.keys(sub.chapters));
            } else {
                setValidChapters([]);
            }
            // Reset UI if switching subject and no active job for it (Polling logic handles re-attach)
            // Ideally we check if there is an active job for THIS subject here? 
            // For now, simple reset to idle if ID matches nothing.
        }
    }, [selectedSubject, allSubjects]);


    // --- Server-Side Job Management ---

    const startServerJob = async () => {
        if (!selectedCourse || !selectedSubject) {
            toast.error("Please select Course and Subject");
            return;
        }

        try {
            addDebugLog("Starting server-side job...");
            const response = await fetch('/api/ai/auto-tag/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    courseId: selectedCourse,
                    subject: selectedSubject,
                    model: selectedModel,
                    batchSize,
                    syllabusContext,
                    validChapters,
                    processingMode,
                    userId: auth.currentUser?.uid
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 409 && data.jobId) {
                    // Job already exists
                    toast.warning(data.message);
                    setActiveJobId(data.jobId);
                    setJobStatus(data.status); // likely running or paused
                    // Start polling immediately
                    return;
                }
                throw new Error(data.error || 'Failed to start job');
            }

            toast.success(data.message);
            setActiveJobId(data.jobId);
            setJobStatus('running');
            setJobProgress({ total: data.totalQuestions, processed: 0, failed: 0 });

        } catch (error: any) {
            addDebugLog(`Start Error: ${error.message}`);
            toast.error(error.message);
        }
    };

    const resumeJob = async () => {
        if (!activeJobId) return;
        try {
            toast.info("Resuming job...");
            // Trigger process endpoint to kickstart
            fetch('/api/ai/auto-tag/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: activeJobId })
            });
            setJobStatus('running'); // Optimistic update
        } catch (e) {
            toast.error("Failed to resume");
        }
    };

    const stopJobMetadata = () => {
        // Just clear local state, job continues on server unless we add a specific "stop" endpoint to DB
        // For "Fully Server Side", user stopping UI shouldn't stop server?
        // But user might WANT to stop it. 
        // For now, we'll just detach UI. 
        // If we want to really stop, we'd need to update Firestore status to 'cancelled'.
        setActiveJobId(null);
        setJobStatus('idle');
        setJobProgress({ total: 0, processed: 0, failed: 0 });
        setLogs([]);
        toast.info("Detached from job view. Job may continue in background.");
    };

    // Polling Effect
    useEffect(() => {
        if (!activeJobId) {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            return;
        }

        const poll = async () => {
            try {
                const res = await fetch(`/api/ai/auto-tag/status?jobId=${activeJobId}`);
                if (res.ok) {
                    const data = await res.json();
                    setJobStatus(data.status);
                    setJobProgress({
                        total: data.totalQuestions,
                        processed: data.processedCount,
                        failed: data.failedCount
                    });

                    // Update logs (last 50 from DB array)
                    if (data.logs && Array.isArray(data.logs)) {
                        // Sort desc by time if needed, or just take last 50
                        const recentLogs = data.logs.slice(-50).reverse();
                        setLogs(recentLogs);
                    }

                    if (data.status === 'completed') {
                        toast.success("Job Completed Successfully! 🎉");
                        setActiveJobId(null); // Stop polling
                    }
                    if (data.status === 'failed') {
                        toast.error("Job Failed: " + data.lastError);
                    }
                }
            } catch (e) {
                console.warn("Polling error", e);
            }
        };

        // Poll immediately then interval
        poll();
        pollingIntervalRef.current = setInterval(poll, 3000); // Poll every 3s

        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, [activeJobId]);


    // --- Render Helpers ---

    const progressPercentage = jobProgress.total > 0
        ? ((jobProgress.processed + jobProgress.failed) / jobProgress.total) * 100
        : 0;

    return (
        <div className="container mx-auto py-8 max-w-6xl space-y-8">
            {/* Header */}
            <div className={`relative ${glassmorphism.light} p-8 rounded-3xl border border-[#004AAD]/20 overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 blur-xl" />
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#004AAD] to-[#00B4D8] mb-2">
                            Server-Side Auto-Tagger
                        </h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4" />
                            Robust background processing with Vision support
                        </p>
                    </div>
                    <div className="flex gap-4">
                        {activeJobId && (
                            <div className="bg-green-100/50 p-2 rounded-lg border border-green-200 text-xs font-mono text-green-700">
                                Job ID: {activeJobId.substring(0, 8)}...
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <Card className="border-t-4 border-t-blue-500 shadow-lg">
                        <CardHeader>
                            <CardTitle>Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Course</label>
                                <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={jobStatus === 'running'}>
                                    <SelectTrigger><SelectValue placeholder="Select Course" /></SelectTrigger>
                                    <SelectContent>
                                        {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Subject</label>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={jobStatus === 'running'}>
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Batch Size</label>
                                    <Input
                                        type="number"
                                        value={batchSize}
                                        onChange={e => setBatchSize(Number(e.target.value))}
                                        min={5} max={50}
                                        disabled={jobStatus === 'running'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Scope</label>
                                    <Select value={processingMode} onValueChange={(v: any) => setProcessingMode(v)} disabled={jobStatus === 'running'}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">Pending Only</SelectItem>
                                            <SelectItem value="all">All Questions</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Syllabus Context</label>
                                <Textarea
                                    value={syllabusContext}
                                    onChange={(e) => setSyllabusContext(e.target.value)}
                                    disabled={jobStatus === 'running'}
                                    className="h-20 resize-none text-xs"
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 space-y-2">
                                {jobStatus === 'running' ? (
                                    <Button variant="outline" onClick={stopJobMetadata} className="w-full border-yellow-500 text-yellow-600">
                                        <Square className="w-4 h-4 mr-2" /> Detach View (Runs in BG)
                                    </Button>
                                ) : jobStatus === 'paused' || (activeJobId && jobStatus !== 'completed') ? (
                                    <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={resumeJob}>
                                        <Play className="w-4 h-4 mr-2" /> Resume Pending Job
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full bg-gradient-to-r from-[#004AAD] to-[#0066FF] text-white"
                                        onClick={startServerJob}
                                        disabled={!selectedCourse || !selectedSubject}
                                    >
                                        <Play className="w-4 h-4 mr-2" /> Start Server Job
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Progress & Logs */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <Card className="bg-white/50 backdrop-blur">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Database className="w-6 h-6 text-blue-500 mb-2" />
                                <div className="text-2xl font-bold">{jobProgress.total}</div>
                                <div className="text-xs text-muted-foreground">Total Questions</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/50 backdrop-blur">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <CheckCircle2 className="w-6 h-6 text-green-500 mb-2" />
                                <div className="text-2xl font-bold">{jobProgress.processed}</div>
                                <div className="text-xs text-muted-foreground">Processed</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-white/50 backdrop-blur">
                            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                                <Loader2 className={`w-6 h-6 text-orange-500 mb-2 ${jobStatus === 'running' ? 'animate-spin' : ''}`} />
                                <div className="text-xl font-bold uppercase">{jobStatus}</div>
                                <div className="text-xs text-muted-foreground">Current Status</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Progress */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-semibold">Job Progress</span>
                                <span className="text-sm font-mono">{progressPercentage.toFixed(1)}%</span>
                            </div>
                            <Progress value={progressPercentage} className="h-4 bg-muted" indicatorClassName="bg-gradient-to-r from-blue-600 to-cyan-500" />
                        </CardContent>
                    </Card>

                    {/* Logs */}
                    <Card className="h-[400px] flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg">Live Server Logs</CardTitle>
                            <RefreshCw className={`w-4 h-4 text-muted-foreground ${jobStatus === 'running' ? 'animate-spin' : ''}`} />
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 backdrop-blur-sm">
                                    <tr>
                                        <th className="p-3 font-medium">Question</th>
                                        <th className="p-3 font-medium">New Chapter</th>
                                        <th className="p-3 font-medium">Difficulty</th>
                                        <th className="p-3 font-medium">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                                Waiting for server logs...
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log, i) => (
                                            <tr key={i} className="hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-top-1">
                                                <td className="p-3 max-w-[200px] truncate" title={log.questionPreview}>
                                                    {log.questionPreview}
                                                </td>
                                                <td className="p-3 text-blue-600 font-medium">{log.newChapter}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold
                                                ${log.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                                            log.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'}`}>
                                                        {log.difficulty}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-xs text-muted-foreground">
                                                    {new Date(log.timestamp).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    {/* Debug Console */}
                    <Card>
                        <CardHeader><CardTitle className="text-sm">Debug Console</CardTitle></CardHeader>
                        <CardContent className="h-32 overflow-auto bg-black text-green-400 font-mono text-xs p-4 rounded-b-xl">
                            {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
