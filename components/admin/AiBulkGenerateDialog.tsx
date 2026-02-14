
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wand2, Loader2, Sparkles, SpellCheck, FileText, Bot } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface AiBulkGenerateDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (data: any[]) => void; // Callback when data is ready
    defaultMetadata: {
        courseId: string;
        subject: string;
        chapter: string;
        difficulty: string;
    };
    validChapters?: string[];
}

export function AiBulkGenerateDialog({
    isOpen,
    onClose,
    onGenerate,
    defaultMetadata,
    validChapters = []
}: AiBulkGenerateDialogProps) {
    const [prompt, setPrompt] = useState('');
    const [count, setCount] = useState([10]);
    const [mode, setMode] = useState<'parse' | 'generate'>('parse');
    const [strategy, setStrategy] = useState<'auto' | 'strict'>('auto');
    const [correctGrammar, setCorrectGrammar] = useState(true);
    const [strictPreservation, setStrictPreservation] = useState(false);
    const [enableFormatting, setEnableFormatting] = useState(true);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    // Progress simulation effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (loading) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress((prev) => {
                    // Fast initially, then slow down as it approaches 90%
                    const increment = prev < 50 ? 5 : prev < 80 ? 2 : 0.5;
                    return Math.min(prev + increment, 90);
                });
            }, 500);
        } else {
            setProgress(0);
        }
        return () => clearInterval(interval);
    }, [loading]);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error(mode === 'parse' ? "Please paste some text" : "Please enter a topic");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/ai/bulk-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    action: mode,
                    count: count[0],
                    strictMode: strategy === 'strict',
                    correctGrammar: strictPreservation ? false : correctGrammar, // Strict overrides grammar
                    strictPreservation,
                    enableFormatting, // Pass formatting state
                    metadata: defaultMetadata,
                    validChapters
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Generation failed");
            }

            if (data.questions && Array.isArray(data.questions)) {
                setProgress(100); // Success!
                // Small delay to show 100%
                await new Promise(resolve => setTimeout(resolve, 500));

                onGenerate(data.questions);
                onClose();
            } else {
                throw new Error("Invalid response format from AI");
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to generate questions");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[80vw] w-[80vw] h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        AI Bulk Generator
                    </DialogTitle>
                    <DialogDescription>
                        Generate multiple questions at once using AI.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 px-1 space-y-6">
                    <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="parse">
                                <FileText className="w-4 h-4 mr-2" />
                                Smart Parse (Importer)
                            </TabsTrigger>
                            <TabsTrigger value="generate">
                                <Bot className="w-4 h-4 mr-2" />
                                AI Generator
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="parse" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Paste Raw Questions</Label>
                                <Textarea
                                    placeholder={`1. What is the unit of Force?\na) Newton\nb) Joule\nc) Watt\nd) Pascal\nAnswer: a\n\n2. Next question...`}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="min-h-[200px] font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Paste text from PDFs, Word docs, or websites. The AI will extract questions automatically.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="generate" className="space-y-4 mt-4">
                            <div className="space-y-2">
                                <Label>Topic / Prompt</Label>
                                <Textarea
                                    placeholder="e.g. Generate questions on Newton's Laws of Motion with real-world examples..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="min-h-[100px]"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <Label>Number of Questions: {count[0]}</Label>
                                    <span className="text-xs text-muted-foreground">Max 20</span>
                                </div>
                                <Slider
                                    value={count}
                                    onValueChange={setCount}
                                    max={20}
                                    min={1}
                                    step={1}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
                            <Label className="text-base font-semibold">Metadata Strategy</Label>
                            <RadioGroup value={strategy} onValueChange={(v: any) => setStrategy(v)}>
                                <div className="flex items-start space-x-2">
                                    <RadioGroupItem value="auto" id="r1" className="mt-1" />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor="r1" className="cursor-pointer font-medium">
                                            Auto-Detect (Creative)
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            AI decides appropriate Difficulty, Topic, and Chapter.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start space-x-2">
                                    <RadioGroupItem value="strict" id="r2" className="mt-1" />
                                    <div className="grid gap-1.5 leading-none">
                                        <Label htmlFor="r2" className="cursor-pointer font-medium">
                                            Force Global Settings
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Force Subject, Chapter, and Difficulty tags.
                                        </p>
                                    </div>
                                </div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-3 border rounded-lg p-3 bg-muted/20 flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-2">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-semibold flex items-center gap-2">
                                        Strict Preservation
                                        <div className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">New</div>
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Do NOT modify text or fix grammar. Extract exactly as provided.
                                    </p>
                                </div>
                                <Switch
                                    checked={strictPreservation}
                                    onCheckedChange={setStrictPreservation}
                                />
                            </div>

                            <div className={`flex items-center justify-between transition-opacity ${strictPreservation ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div className="flex items-center gap-2">
                                    <SpellCheck className="w-5 h-5 text-blue-600" />
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Grammar Correction</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Enforce strict academic English
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={correctGrammar}
                                    onCheckedChange={setCorrectGrammar}
                                />
                            </div>

                            <div className="flex items-center justify-between transition-opacity">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-green-600" />
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Enable Formatting</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Use bold, lists, and HTML formatting
                                        </p>
                                    </div>
                                </div>
                                <Switch
                                    checked={enableFormatting}
                                    onCheckedChange={setEnableFormatting}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex-col !space-x-0 gap-2">
                    {loading && (
                        <div className="w-full space-y-1 mb-2">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Generating...</span>
                                <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                        <Button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-90"
                        >
                            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : (mode === 'parse' ? <FileText className="w-4 h-4 mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />)}
                            {mode === 'parse' ? 'Parse & Import' : 'Generate Questions'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
