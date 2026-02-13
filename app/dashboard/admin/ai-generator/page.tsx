'use client';

import { useState, useRef, useEffect } from 'react';
import { UnifiedHeader } from '@/components/unified-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Wand2, Save, Check, Trash2, FileText, UploadCloud, BrainCircuit, Library, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { toast } from 'sonner';
import { db } from '@/app/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';
import { splitPdfClientSide, getPdfPageCount } from '@/lib/pdfClientProcessor';
import { analyzeDocument } from '@/app/actions/knowledgeBase';
import { getAllSubjectsWithChapters, getChapterContent } from '@/app/actions/knowledgeBaseManagement';

interface GeneratedQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    type: string;
    tags?: string[];
}

// 15 MCQ Types
const QUESTION_TYPES = [
    { id: 'single_correct', label: 'Single Best Option (SBA)' },
    { id: 'multiple_correct', label: 'Multiple Correct' },
    { id: 'assertion_reason', label: 'Assertion-Reason (A/R)' },
    { id: 'true_false', label: 'True / False' },
    { id: 'fill_blanks', label: 'Fill in the Blank' },
    { id: 'match_following', label: 'Match the Following' },
    { id: 'chronological', label: 'Sequence / Process Order' },
    { id: 'case_study', label: 'Case Study / Vignette' },
    { id: 'statement_based', label: 'Statement Based (I, II)' },
    { id: 'negation', label: 'Except / Not Correct' },
    { id: 'error_spotting', label: 'Error Spotting / Correction' },
    { id: 'analogy', label: 'Analogy' },
    { id: 'odd_one_out', label: 'Odd One Out' },
    { id: 'best_explanation', label: 'Best Explanation' },
    { id: 'definition', label: 'Definition Based' },
];

export default function AIGeneratorPage() {
    const [inputMethod, setInputMethod] = useState('text');
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [count, setCount] = useState('5');
    const [difficulty, setDifficulty] = useState('Medium');
    const [selectedTypes, setSelectedTypes] = useState<string[]>(['single_correct']);
    const [targetBank, setTargetBank] = useState<'questions' | 'mock_questions'>('questions');

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);

    // Progress State
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');
    const [logs, setLogs] = useState<string[]>([]);

    // Taxonomy & KB Selection
    const [subjects, setSubjects] = useState<{ id: string, name: string, chapters: Record<string, boolean> }[]>([]);
    const [subject, setSubject] = useState('');
    const [chapter, setChapter] = useState('');
    const [availableChapters, setAvailableChapters] = useState<string[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load Subjects on Mount
    useEffect(() => {
        const loadSubjects = async () => {
            const result = await getAllSubjectsWithChapters();
            if (result.success && result.subjects) {
                setSubjects(result.subjects);
            }
        };
        loadSubjects();
    }, []);

    // Update Chapters when Subject changes
    useEffect(() => {
        if (subject) {
            const selectedSub = subjects.find(s => s.name === subject);
            if (selectedSub && selectedSub.chapters) {
                setAvailableChapters(Object.keys(selectedSub.chapters).sort());
            } else {
                setAvailableChapters([]);
            }
            setChapter(''); // Reset chapter logic
        }
    }, [subject, subjects]);


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'application/pdf') {
                toast.error("Only PDF files are supported");
                return;
            }
            setFile(selectedFile);
            toast.success(`Selected: ${selectedFile.name}`);
            setLogs([]);
            setProgress(0);
        }
    };

    const toggleType = (typeId: string) => {
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(t => t !== typeId)
                : [...prev, typeId]
        );
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const handleGenerate = async () => {
        // Validation
        if (inputMethod === 'text' && !text.trim()) {
            toast.error("Please enter some text content"); return;
        }
        if (inputMethod === 'pdf' && !file) {
            toast.error("Please upload a PDF file"); return;
        }
        if (inputMethod === 'knowledge_base' && (!subject || !chapter)) {
            toast.error("Please select a Subject and Chapter from Knowledge Base"); return;
        }
        if (selectedTypes.length === 0) {
            toast.error("Select at least one question type"); return;
        }

        setIsGenerating(true);
        setGeneratedQuestions([]);
        setLogs([]);
        setProgress(0);
        setCurrentStep('Initializing...');

        let finalContent = "";

        try {
            // --- STEP 1: Content Retrieval ---

            if (inputMethod === 'text') {
                finalContent = text;
            }
            else if (inputMethod === 'knowledge_base') {
                setCurrentStep(`Fetching content for ${subject} - ${chapter}...`);
                addLog(`📚 Fetching Knowledge Base content...`);
                const kbResult = await getChapterContent(subject, chapter);

                if (!kbResult.success || !kbResult.content) {
                    throw new Error(kbResult.error || "No content found in Knowledge Base for this chapter.");
                }
                finalContent = kbResult.content;
                addLog(`✅ Loaded ${finalContent.length} characters from Knowledge Base.`);
            }
            else if (inputMethod === 'pdf' && file) {
                // PDF Processing (Gemini Vision)
                addLog(`📄 Processing PDF: ${file.name}`);
                setCurrentStep('Scanning PDF structure...');

                const pageCount = await getPdfPageCount(file);
                const splitResult = await splitPdfClientSide(file);

                if (!splitResult.success || !splitResult.pages) throw new Error("Failed to split PDF");

                let accumulatedText = "";
                let processedCount = 0;

                for (const page of splitResult.pages) {
                    processedCount++;
                    const percent = Math.round((processedCount / pageCount) * 100);
                    setProgress(percent);
                    setCurrentStep(`Analyzing Page ${page.pageNumber}/${pageCount}...`);
                    addLog(`   🔍 Analyzing Page ${page.pageNumber}...`);

                    const result = await analyzeDocument({
                        fileData: page.base64,
                        mimeType: page.mimeType
                    });

                    if (result.success && result.data) {
                        accumulatedText += `\n--- Page ${page.pageNumber} ---\n` + (result.data.text || "");
                        if (result.data.description && result.data.description !== "No diagrams found.") {
                            accumulatedText += `\n[Visual Description: ${result.data.description}]\n`;
                        }
                    }
                }
                finalContent = accumulatedText;
                addLog(`✅ PDF Extraction Complete!`);
            }

            if (!finalContent.trim()) throw new Error("No content available to generate questions.");

            // --- STEP 2: Batch Generation ---

            const totalCount = parseInt(count);
            // Batch size 20 to avoid timeouts
            const batchSize = 20;
            const batches = Math.ceil(totalCount / batchSize);

            let allQuestions: GeneratedQuestion[] = [];

            for (let i = 0; i < batches; i++) {
                const currentBatchCount = Math.min(batchSize, totalCount - (i * batchSize));
                const batchNum = i + 1;

                setCurrentStep(`Generating Batch ${batchNum}/${batches} (${currentBatchCount} Qs)...`);
                addLog(`🧠 AI Generating Batch ${batchNum}/${batches}...`);

                const formData = new FormData();
                formData.append('count', currentBatchCount.toString());
                formData.append('difficulty', difficulty);
                formData.append('types', JSON.stringify(selectedTypes));
                formData.append('text', finalContent);

                // Add retry logic
                let retries = 0;
                let success = false;
                while (retries < 2 && !success) {
                    try {
                        const response = await fetch('/api/ai/generate-mcq', {
                            method: 'POST',
                            body: formData,
                        });
                        const data = await response.json();

                        if (data.error) throw new Error(data.error);
                        if (data.questions) {
                            allQuestions = [...allQuestions, ...data.questions];
                            setGeneratedQuestions(prev => [...prev, ...data.questions]); // Real-time update
                            success = true;
                            addLog(`   ✨ Batch ${batchNum} complete: +${data.questions.length} questions`);
                        }
                    } catch (e: any) {
                        retries++;
                        addLog(`   ⚠️ Batch ${batchNum} failed (Attempt ${retries}). Retrying...`);
                        if (retries >= 2) throw e;
                    }
                }

                // Progress Update for Batches
                const batchProgress = Math.round((batchNum / batches) * 100);
                setProgress(batchProgress);
            }

            addLog(`🎉 All done! Generated ${allQuestions.length} questions.`);
            toast.success(`Successfully generated ${allQuestions.length} questions!`);

        } catch (error: any) {
            console.error(error);
            addLog(`❌ Critical Error: ${error.message}`);
            toast.error(error.message || "Failed to generate questions");
        } finally {
            setIsGenerating(false);
            setCurrentStep('Ready');
        }
    };

    const handleSaveToBank = async () => {
        if (generatedQuestions.length === 0) return;
        // Validation for taxonomy
        if (!subject || !chapter) {
            toast.error("Please select Subject and Chapter before saving.");
            return;
        }

        const loadingToast = toast.loading(`Saving to ${targetBank === 'questions' ? 'Question Bank' : 'Mock Bank'}...`);

        try {
            const batchPromises = generatedQuestions.map(q => {
                return addDoc(collection(db, targetBank), {
                    text: q.question,
                    questionText: q.question,
                    options: q.options,
                    correctAnswer: q.answer,
                    explanation: q.explanation,
                    subject: subject,
                    chapter: chapter,
                    difficulty: difficulty,
                    type: q.type || 'multiple_choice',
                    tags: q.tags || [],
                    createdAt: serverTimestamp(),
                    source: 'ai_generator_v2',
                    isMock: targetBank === 'mock_questions'
                });
            });

            await Promise.all(batchPromises);
            toast.success("Saved successfully!", { id: loadingToast });
            setGeneratedQuestions([]);
        } catch (error) {
            console.error(error);
            toast.error("Failed to save questions", { id: loadingToast });
        }
    };

    return (
        <div className="space-y-6">
            <UnifiedHeader
                title="Elite AI Exam Designer"
                subtitle="Generate diverse, puzzle-like MCQs from Text, PDF, or Knowledge Base"
                icon={<BrainCircuit className="w-6 h-6 text-purple-600" />}
            />

            <div className="container mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Left Config Column */}
                <div className="xl:col-span-5 space-y-6">

                    {/* Source Selection */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3 px-4 pt-4">
                            <CardTitle className="text-base">1. Input Source</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <Tabs value={inputMethod} onValueChange={setInputMethod} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-4">
                                    <TabsTrigger value="text">Text</TabsTrigger>
                                    <TabsTrigger value="pdf">PDF Upload</TabsTrigger>
                                    <TabsTrigger value="knowledge_base">Knowledge Base</TabsTrigger>
                                </TabsList>

                                <TabsContent value="text" className="mt-0">
                                    <Textarea
                                        placeholder="Paste content here..."
                                        className="min-h-[200px] font-mono text-sm"
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                    />
                                </TabsContent>

                                <TabsContent value="pdf" className="mt-0">
                                    <div
                                        className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            hidden
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                        />
                                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-2">
                                            <UploadCloud className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <p className="font-medium text-sm">
                                            {file ? file.name : "Click to Upload PDF"}
                                        </p>
                                    </div>
                                </TabsContent>

                                <TabsContent value="knowledge_base" className="mt-0 space-y-4">
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900">
                                        <div className="flex gap-2 text-blue-700 dark:text-blue-300 mb-2">
                                            <Library className="w-5 h-5" />
                                            <span className="font-semibold text-sm">Select Chapter Content</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">The AI will read ALL uploaded content for this chapter.</p>
                                    </div>
                                    {/* Selectors moved to taxonomy section but required here logic-wise */}
                                    <div className="p-2 border rounded bg-background/50 text-xs text-muted-foreground text-center">
                                        Use the Taxonomy selectors below to pick the chapter.
                                    </div>
                                </TabsContent>
                            </Tabs>

                            {/* Progress & Logs */}
                            {(isGenerating || logs.length > 0) && (
                                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-sm">
                                    {isGenerating && (
                                        <div className="mb-2 space-y-1">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>{currentStep}</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <Progress value={progress} className="h-1.5" />
                                        </div>
                                    )}
                                    <div className="h-24 overflow-y-auto font-mono text-[10px] text-muted-foreground p-2 bg-background rounded border mt-2">
                                        {logs.map((log, i) => (
                                            <div key={i} className="py-0.5">{log}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Taxonomy & Config */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3 px-4 pt-4">
                            <CardTitle className="text-base">2. Configuration</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">

                            {/* Taxonomy Selectors */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Subject</Label>
                                    <Select value={subject} onValueChange={setSubject}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder="Select Subject" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subjects.map(s => (
                                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Chapter</Label>
                                    <Select value={chapter} onValueChange={setChapter} disabled={!subject}>
                                        <SelectTrigger className="h-9 text-xs">
                                            <SelectValue placeholder="Select Chapter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableChapters.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Count</Label>
                                    <Select value={count} onValueChange={setCount}>
                                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5 Questions</SelectItem>
                                            <SelectItem value="10">10 Questions</SelectItem>
                                            <SelectItem value="20">20 Questions</SelectItem>
                                            <SelectItem value="30">30 Questions (Bulk)</SelectItem>
                                            <SelectItem value="50">50 Questions (Bulk)</SelectItem>
                                            <SelectItem value="75">75 Questions (Bulk)</SelectItem>
                                            <SelectItem value="100">100 Questions (Bulk)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Difficulty</Label>
                                    <Select value={difficulty} onValueChange={setDifficulty}>
                                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Easy">Beginner</SelectItem>
                                            <SelectItem value="Medium">Intermediate</SelectItem>
                                            <SelectItem value="Hard">Advanced</SelectItem>
                                            <SelectItem value="Expert">Expert (Elite)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label className="text-xs font-semibold">Question Types (Select Multiple)</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto p-2 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                                    {QUESTION_TYPES.map((type) => (
                                        <div key={type.id} className="flex items-start space-x-2">
                                            <Checkbox
                                                id={type.id}
                                                checked={selectedTypes.includes(type.id)}
                                                onCheckedChange={() => toggleType(type.id)}
                                                className="mt-0.5"
                                            />
                                            <Label htmlFor={type.id} className="cursor-pointer text-[11px] leading-tight font-normal text-muted-foreground peer-aria-checked:text-foreground">
                                                {type.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button
                                size="lg"
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                                ) : (
                                    <><Wand2 className="w-4 h-4 mr-2" /> Generate Elite MCQs</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Output Column */}
                <div className="xl:col-span-7 h-full flex flex-col">
                    <Card className="border-border/50 shadow-sm flex-1 flex flex-col h-[calc(100vh-120px)]">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 px-6 pt-6">
                            <div>
                                <CardTitle>Generated Exam</CardTitle>
                                <CardDescription>Review questions before saving to bank</CardDescription>
                            </div>
                            <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button
                                    onClick={() => setTargetBank('questions')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${targetBank === 'questions' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    Question Bank
                                </button>
                                <button
                                    onClick={() => setTargetBank('mock_questions')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${targetBank === 'mock_questions' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-muted-foreground'}`}
                                >
                                    Mock Bank
                                </button>
                            </div>
                        </CardHeader>

                        <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-6">
                            {generatedQuestions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                    <FileText className="w-16 h-16 mb-4" />
                                    <p className="text-lg font-medium">Ready to Generate</p>
                                    <p className="text-sm">Select source and settings to begin</p>
                                </div>
                            ) : (
                                generatedQuestions.map((q, idx) => (
                                    <div key={idx} className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-xl border border-border group hover:border-violet-200 dark:hover:border-violet-900 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center mt-0.5">
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded">
                                                            {q.type?.replace(/_/g, ' ') || 'MCQ'}
                                                        </span>
                                                        {q.tags && q.tags.map(tag => (
                                                            <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">#{tag}</span>
                                                        ))}
                                                    </div>
                                                    <div className="font-medium text-base text-foreground leading-snug prose dark:prose-invert max-w-none">
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {q.question}
                                                        </ReactMarkdown>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => {
                                                setGeneratedQuestions(prev => prev.filter((_, i) => i !== idx));
                                            }}>
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 pl-9 mb-3">
                                            {q.options.map((opt, oIdx) => (
                                                <div
                                                    key={oIdx}
                                                    className={`px-3 py-2 rounded-lg text-sm border transition-all flex items-center
                                                        ${opt === q.answer
                                                            ? 'bg-green-50/50 border-green-200 text-green-900 dark:bg-green-900/10 dark:border-green-800 dark:text-green-100'
                                                            : 'bg-white dark:bg-slate-950 border-border/40'}
                                                    `}
                                                >
                                                    <span className="font-mono text-xs font-bold mr-3 opacity-40 w-4">{String.fromCharCode(65 + oIdx)}</span>
                                                    <span className="flex-1">{opt}</span>
                                                    {opt === q.answer && <Check className="w-3.5 h-3.5 ml-2 text-green-600" />}
                                                </div>
                                            ))}
                                        </div>

                                        {q.explanation && (
                                            <div className="ml-9 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg flex gap-2">
                                                <div className="shrink-0 mt-0.5"><BookOpen className="w-3.5 h-3.5 text-violet-500" /></div>
                                                <div><span className="font-semibold text-violet-600 dark:text-violet-400">Explanation:</span> {q.explanation}</div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {generatedQuestions.length > 0 && (
                            <div className="p-4 border-t bg-slate-50/80 dark:bg-slate-900/80 flex justify-between items-center rounded-b-xl backdrop-blur-sm sticky bottom-0">
                                <span className="text-xs text-muted-foreground font-mono">
                                    Total: {generatedQuestions.length} Questions
                                </span>
                                <div className="flex gap-3">
                                    <Button variant="ghost" size="sm" onClick={() => setGeneratedQuestions([])}>
                                        Discard
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveToBank}
                                        className="bg-green-600 hover:bg-green-700 text-white shadow-md"
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        Save All
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
