'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';
import { analyzeDocument, saveToKnowledgeBase } from '@/app/actions/knowledgeBase';
import { Progress } from '@/components/ui/progress';

export default function KnowledgeBasePage() {
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<FileList | null>(null);
    const [metadata, setMetadata] = useState({
        subject: '',
        bookName: '',
        province: '',
        year: '',
        type: 'book' as 'book' | 'syllabus'
    });

    // Progress State
    const [logs, setLogs] = useState<string[]>([]);
    const [currentStep, setCurrentStep] = useState<string>('');
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
            setLogs([]);
            setProgress(0);
            setCurrentStep('');
        }
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const handleUpload = async () => {
        if (!files || files.length === 0) {
            toast.error('Please select files to upload');
            return;
        }
        if (!metadata.subject || !metadata.bookName || !metadata.province || !metadata.year) {
            toast.error('Please fill in all metadata fields');
            return;
        }

        setLoading(true);
        setLogs([]);
        setProgress(0);

        try {
            const totalFiles = files.length;

            for (let i = 0; i < totalFiles; i++) {
                const file = files[i];
                const fileNum = i + 1;

                // Update Progress (Start of file)
                setProgress(Math.round(((i) / totalFiles) * 100));
                setCurrentStep(`File ${fileNum}/${totalFiles}: ${file.name}`);
                addLog(`▶ Processing ${file.name}...`);

                // 1. Read File
                setCurrentStep(`File ${fileNum}/${totalFiles}: Reading Data...`);
                const reader = new FileReader();
                const base64Promise = new Promise<{ base64: string, mimeType: string }>((resolve, reject) => {
                    reader.onload = () => {
                        const result = reader.result as string;
                        const [header, base64] = result.split(',');
                        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                        resolve({ base64, mimeType });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                const { base64, mimeType } = await base64Promise;

                // 2. Analyze (OCR)
                setCurrentStep(`File ${fileNum}/${totalFiles}: 🧠 AI Analyzing (OCR)...`);
                addLog(`   ↳ AI Analysis started...`);

                const analysisRes = await analyzeDocument({ fileData: base64, mimeType });

                if (!analysisRes.success) {
                    addLog(`❌ Failed to analyze ${file.name}: ${analysisRes.error}`);
                    continue; // Skip specific file error
                }

                const { text, description, chapter, page_number } = analysisRes.data;
                addLog(`   ↳ Detected: ${chapter} (Page ${page_number})`);

                // 3. Save (Embed + DB)
                setCurrentStep(`File ${fileNum}/${totalFiles}: 💾 Generating Vectors & Saving...`);
                const saveRes = await saveToKnowledgeBase({
                    text, description, chapter, page_number,
                    fileName: file.name,
                    metadata
                });

                if (saveRes.success) {
                    addLog(`✅ Saved successfully.`);
                } else {
                    addLog(`❌ Database Save Failed: ${saveRes.error}`);
                }
            }

            setProgress(100);
            setCurrentStep('Done!');
            toast.success('Batch processing completed!');
            setFiles(null);

        } catch (error: any) {
            console.error(error);
            toast.error('Unexpected error during batch process');
            addLog(`💥 Critical Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Knowledge Base Ingestion</h1>
                    <p className="text-slate-500">Upload scanned book pages (Images or PDF) for the AI Tutor.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Upload Content</CardTitle>
                    <CardDescription>Upload images or PDFs. The AI will extract text, visual descriptions, and metadata.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Metadata Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Content Type</Label>
                            <Select value={metadata.type} onValueChange={(v: any) => setMetadata({ ...metadata, type: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="book">Book</SelectItem>
                                    <SelectItem value="syllabus">Syllabus</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Subject</Label>
                            <Input placeholder="e.g. Biology" value={metadata.subject} onChange={e => setMetadata({ ...metadata, subject: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Book Name / Syllabus Title</Label>
                            <Input placeholder="e.g. PTB 11th Class" value={metadata.bookName} onChange={e => setMetadata({ ...metadata, bookName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Province / Board</Label>
                            <Input placeholder="e.g. Punjab" value={metadata.province} onChange={e => setMetadata({ ...metadata, province: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Year</Label>
                            <Input placeholder="e.g. 2024" value={metadata.year} onChange={e => setMetadata({ ...metadata, year: e.target.value })} />
                        </div>
                    </div>

                    {/* File Upload Area */}
                    <div className="space-y-2 border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                        <Upload className="h-10 w-10 text-slate-400 mb-2" />
                        <Label htmlFor="file-upload" className="cursor-pointer text-lg text-slate-700">Click to Select Files (Images or PDF)</Label>
                        <Input id="file-upload" type="file" multiple accept=".pdf, image/*" className="hidden" onChange={handleFileChange} />
                        {files && <p className="text-sm text-green-600 font-medium mt-2">{files.length} files selected</p>}
                    </div>

                    {/* Progress Section */}
                    {(loading || progress > 0) && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>{currentStep}</span>
                                <span className="font-bold">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    <Button onClick={handleUpload} disabled={loading || !files} className="w-full">
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Start Upload & Processing'}
                    </Button>

                    {/* Detailed Logs */}
                    {logs.length > 0 && (
                        <div className="mt-4 p-4 bg-slate-900 text-green-400 rounded-lg max-h-60 overflow-y-auto font-mono text-xs shadow-inner">
                            {logs.map((log, i) => (
                                <div key={i} className="py-0.5">{log}</div>
                            ))}
                            {loading && <div className="animate-pulse">_</div>}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
