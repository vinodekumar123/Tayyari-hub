'use client';

import { useState } from 'react';
import { UnifiedHeader } from '@/components/unified-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Save, Check, Copy, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/app/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface GeneratedQuestion {
    question: string;
    options: string[];
    answer: string;
    explanation: string;
}

export default function AIGeneratorPage() {
    const [text, setText] = useState('');
    const [count, setCount] = useState('5');
    const [difficulty, setDifficulty] = useState('Medium');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);

    // Taxonomy for saving (Optional for now, but good to have)
    const [subject, setSubject] = useState('');
    const [chapter, setChapter] = useState('');

    const handleGenerate = async () => {
        if (!text.trim()) {
            toast.error("Please enter some text content");
            return;
        }

        setIsGenerating(true);
        setGeneratedQuestions([]);

        try {
            const response = await fetch('/api/ai/generate-mcq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    count: parseInt(count),
                    difficulty
                })
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

        const loadingToast = toast.loading("Saving to Question Bank...");

        try {
            const batchPromises = generatedQuestions.map(q => {
                // Map to your Firestore Question structure
                return addDoc(collection(db, 'questions'), {
                    text: q.question,
                    options: q.options,
                    correctAnswer: q.answer, // Ensure this matches UI logic (e.g. index vs string)
                    explanation: q.explanation,
                    subject: subject || 'Uncategorized',
                    chapter: chapter || 'General',
                    difficulty: difficulty,
                    type: 'multiple_choice',
                    createdAt: serverTimestamp(),
                    source: 'ai_generator'
                });
            });

            await Promise.all(batchPromises);
            toast.success("All questions saved successfully!", { id: loadingToast });
            setGeneratedQuestions([]); // Clear after save
        } catch (error) {
            console.error(error);
            toast.error("Failed to save questions", { id: loadingToast });
        }
    };

    return (
        <div className="space-y-6">
            <UnifiedHeader
                title="AI Knowledge Base Generator"
                subtitle="Transform text content into high-quality MCQs"
                icon={<Wand2 className="w-5 h-5" />}
            />

            <div className="container mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Input Column */}
                <div className="space-y-6">
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle>Source Content</CardTitle>
                            <CardDescription>Paste text from books, articles, or notes.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Textarea
                                placeholder="Paste knowledge base text here..."
                                className="min-h-[400px] font-mono text-sm leading-relaxed"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle>Generation Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                        <SelectItem value="Easy">Easy</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="Hard">Hard</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Optional Metadata for saving */}
                            <div className="space-y-2 col-span-2">
                                <Label>Subject (Optional Tag)</Label>
                                <Input
                                    placeholder="e.g. Biology"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                />
                            </div>

                            <div className="col-span-full pt-4">
                                <Button
                                    size="lg"
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-purple-500/20"
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !text}
                                >
                                    {isGenerating ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                                    ) : (
                                        <><Wand2 className="w-4 h-4 mr-2" /> Generate Questions</>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Output Column */}
                <div className="space-y-6 h-full flex flex-col">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold tracking-tight">Generated Questions</h2>
                        {generatedQuestions.length > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setGeneratedQuestions([])} className="text-red-500 hover:bg-red-50">
                                <Trash2 className="w-4 h-4 mr-2" /> Clear
                            </Button>
                        )}
                    </div>

                    {generatedQuestions.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12 text-center h-[500px]">
                            <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                <Wand2 className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">Ready to Generate</h3>
                            <p className="text-muted-foreground mt-2 max-w-xs">
                                Paste content on the left and click generate to see AI magic happen here.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-24">
                            {generatedQuestions.map((q, idx) => (
                                <Card key={idx} className="border-l-4 border-l-purple-500">
                                    <CardContent className="pt-6 space-y-3">
                                        <div className="flex gap-3">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <p className="font-medium text-lg leading-snug">{q.question}</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-9">
                                            {q.options.map((opt, oIdx) => (
                                                <div
                                                    key={oIdx}
                                                    className={`p-3 rounded-lg text-sm border transition-colors
                                                        ${opt === q.answer
                                                            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
                                                            : 'bg-card border-border hover:bg-accent/50'}
                                                    `}
                                                >
                                                    <span className="font-bold mr-2 opacity-50">{String.fromCharCode(65 + oIdx)}.</span>
                                                    {opt}
                                                    {opt === q.answer && <Check className="w-4 h-4 ml-2 inline text-green-600" />}
                                                </div>
                                            ))}
                                        </div>

                                        {q.explanation && (
                                            <div className="mt-3 pl-9 text-xs text-muted-foreground bg-muted/30 p-2 rounded-md">
                                                <span className="font-semibold text-primary">Explanation:</span> {q.explanation}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}

                            <div className="sticky bottom-6 flex justify-end">
                                <Button
                                    size="lg"
                                    onClick={handleSaveToBank}
                                    className="shadow-2xl bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <Save className="w-4 h-4 mr-2" /> Save {generatedQuestions.length} Questions to Bank
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
