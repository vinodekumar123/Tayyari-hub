'use client';

import { useState, useRef } from 'react';
import { UnifiedHeader } from '@/components/unified-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Wand2, Save, Check, Copy, Trash2, FileText, UploadCloud, BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/app/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractTextFromPdf } from '@/lib/pdfTextExtractor';

interface GeneratedQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
    type: string;
    tags?: string[];
}

const QUESTION_TYPES = [
    { id: 'single_correct', label: 'Single Correct' },
    { id: 'multiple_correct', label: 'Multiple Correct' },
    { id: 'true_false', label: 'True/False' },
    { id: 'assertion_reason', label: 'Assertion-Reason' },
    { id: 'statement_based', label: 'Statement Based (I, II)' },
    { id: 'match_following', label: 'Match the Following' },
    { id: 'chronological', label: 'Chronological Order' },
    { id: 'fill_blanks', label: 'Fill in the Blanks' },
    { id: 'case_study', label: 'Case Study' },
    { id: 'negation', label: 'Negation (Not True)' },
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

    // Taxonomy for saving (Optional for now, but good to have)
    const [subject, setSubject] = useState('');
    const [chapter, setChapter] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'application/pdf') {
                toast.error("Only PDF files are supported");
                return;
            }
            setFile(selectedFile);
            toast.success(`Selected: ${selectedFile.name}`);
        }
    };

    const toggleType = (typeId: string) => {
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(t => t !== typeId)
                : [...prev, typeId]
        );
    };

    const handleGenerate = async () => {
        if (inputMethod === 'text' && !text.trim()) {
            toast.error("Please enter some text content");
            return;
        }
        if (inputMethod === 'pdf' && !file) {
            toast.error("Please upload a PDF file");
            return;
        }
        if (selectedTypes.length === 0) {
            toast.error("Select at least one question type");
            return;
        }

        setIsGenerating(true);
        setGeneratedQuestions([]);

        // Client-side PDF Parsing Logic
        let finalContent = text;

        if (inputMethod === 'pdf' && file) {
            try {
                // Extract text on client using pdfjs-dist
                const extractedText = await extractTextFromPdf(file);
                if (!extractedText || extractedText.trim().length < 50) {
                    toast.error("Could not extract enough text from this PDF. It might be scanned/image-based.");
                    setIsGenerating(false);
                    return;
                }
                finalContent = extractedText;
                toast.success("PDF parsed successfully!");
            } catch (err: any) {
                console.error("Client PDF Error:", err);
                toast.error("Failed to parse PDF: " + err.message);
                setIsGenerating(false);
                return;
            }
        }

        const formData = new FormData();
        formData.append('count', count);
        formData.append('difficulty', difficulty);
        formData.append('types', JSON.stringify(selectedTypes));

        // Always send as text now, since we parsed it client-side
        formData.append('text', finalContent);

        try {
            const response = await fetch('/api/ai/generate-mcq', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            if (data.questions && Array.isArray(data.questions)) {
                setGeneratedQuestions(data.questions);
                toast.success(`Generated ${data.questions.length} questions!`);
            } else {
                throw new Error("Invalid response format");
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to generate questions");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveToBank = async () => {
        if (generatedQuestions.length === 0) return;

        const loadingToast = toast.loading(`Saving to ${targetBank === 'questions' ? 'Question Bank' : 'Mock Bank'}...`);

        try {
            const batchPromises = generatedQuestions.map(q => {
                // Map to your Firestore Question structure
                return addDoc(collection(db, targetBank), {
                    text: q.question, // Standard field
                    questionText: q.question, // Redundant field for compatibility
                    options: q.options,
                    correctAnswer: q.answer,
                    explanation: q.explanation,
                    subject: subject || 'Uncategorized',
                    chapter: chapter || 'General',
                    difficulty: difficulty,
                    type: q.type || 'multiple_choice',
                    tags: q.tags || [], // AI Generated Tags
                    createdAt: serverTimestamp(),
                    source: 'ai_generator',
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
                title="Advanced AI MCQ Generator"
                subtitle="Create 10+ types of MCQs from Text or PDF"
                icon={<BrainCircuit className="w-6 h-6 text-purple-600" />}
            />

            <div className="container mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">

                {/* Configuration Column (Left) */}
                <div className="xl:col-span-5 space-y-6">
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle>1. Source Content</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="text" value={inputMethod} onValueChange={setInputMethod} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="text">Paste Text</TabsTrigger>
                                    <TabsTrigger value="pdf">Upload PDF</TabsTrigger>
                                </TabsList>
                                <TabsContent value="text" className="space-y-4">
                                    <Textarea
                                        placeholder="Paste knowledge base text here..."
                                        className="min-h-[250px] font-mono text-sm leading-relaxed"
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                    />
                                </TabsContent>
                                <TabsContent value="pdf" className="space-y-4">
                                    <div
                                        className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            hidden
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                        />
                                        <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-3">
                                            <UploadCloud className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <p className="font-medium">
                                            {file ? file.name : "Click to Upload PDF"}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            PDFs are parsed automatically
                                        </p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle>2. Advanced Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Count</Label>
                                    <Select value={count} onValueChange={setCount}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5 Questions</SelectItem>
                                            <SelectItem value="10">10 Questions</SelectItem>
                                            <SelectItem value="20">20 Questions</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Difficulty</Label>
                                    <Select value={difficulty} onValueChange={setDifficulty}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Easy">Beginner</SelectItem>
                                            <SelectItem value="Medium">Intermediate</SelectItem>
                                            <SelectItem value="Hard">Advanced</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base">Question Types</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {QUESTION_TYPES.map((type) => (
                                        <div key={type.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={type.id}
                                                checked={selectedTypes.includes(type.id)}
                                                onCheckedChange={() => toggleType(type.id)}
                                            />
                                            <Label htmlFor={type.id} className="cursor-pointer text-sm font-normal">
                                                {type.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Taxonomy */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label>Subject (Tag)</Label>
                                    <Input placeholder="Biology" value={subject} onChange={e => setSubject(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Chapter (Tag)</Label>
                                    <Input placeholder="Cell Structure" value={chapter} onChange={e => setChapter(e.target.value)} />
                                </div>
                            </div>

                            <Button
                                size="lg"
                                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Knowledge Base...</>
                                ) : (
                                    <><Wand2 className="w-4 h-4 mr-2" /> Generate Advanced MCQs</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Output Column (Right) */}
                <div className="xl:col-span-7 h-full flex flex-col space-y-6">
                    <Card className="border-border/50 shadow-sm flex-1 flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <div>
                                <CardTitle>Generated Content</CardTitle>
                                <CardDescription>Review and edit questions before saving</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg">
                                    <button
                                        onClick={() => setTargetBank('questions')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${targetBank === 'questions' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-muted-foreground'}`}
                                    >
                                        Question Bank
                                    </button>
                                    <button
                                        onClick={() => setTargetBank('mock_questions')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${targetBank === 'mock_questions' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-muted-foreground'}`}
                                    >
                                        Mock Bank
                                    </button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="flex-1 overflow-y-auto min-h-[500px] p-6 pt-0">
                            {generatedQuestions.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                                    <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                                    <p className="text-lg font-medium">No questions generated yet</p>
                                    <p className="text-sm">Upload a PDF or paste text to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {generatedQuestions.map((q, idx) => (
                                        <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-border">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex gap-3">
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center mt-0.5">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 uppercase tracking-wider">
                                                                {q.type.replace('_', ' ')}
                                                            </span>
                                                            {q.tags && q.tags.map(tag => (
                                                                <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">#{tag}</span>
                                                            ))}
                                                        </div>
                                                        <p className="font-medium text-lg text-foreground">{q.question}</p>
                                                    </div>
                                                </div>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 gap-2 pl-9 mb-4">
                                                {q.options.map((opt, oIdx) => (
                                                    <div
                                                        key={oIdx}
                                                        className={`p-3 rounded-lg text-sm border transition-all
                                                            ${opt === q.answer
                                                                ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100'
                                                                : 'bg-white dark:bg-slate-950 border-border/60 hover:border-border'}
                                                        `}
                                                    >
                                                        <span className="font-bold mr-3 opacity-40">{String.fromCharCode(65 + oIdx)}.</span>
                                                        {opt}
                                                        {opt === q.answer && <Check className="w-4 h-4 ml-auto inline text-green-600" />}
                                                    </div>
                                                ))}
                                            </div>

                                            {q.explanation && (
                                                <div className="pl-9 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg">
                                                    <span className="font-semibold text-violet-600 dark:text-violet-400">Explanation:</span> {q.explanation}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>

                        {generatedQuestions.length > 0 && (
                            <div className="p-4 border-t bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-xl">
                                <Button variant="outline" onClick={() => setGeneratedQuestions([])}>
                                    Discard
                                </Button>
                                <Button
                                    onClick={handleSaveToBank}
                                    className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    Save to {targetBank === 'questions' ? 'Question Bank' : 'Mock Bank'}
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
