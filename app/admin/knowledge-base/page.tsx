'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { analyzeDocument, saveToKnowledgeBase } from '@/app/actions/knowledgeBase';
import { splitPdfClientSide, getPdfPageCount, fileToBase64 } from '@/lib/pdfClientProcessor';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

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

    // Stats for summary
    const [stats, setStats] = useState({ processed: 0, saved: 0, failed: 0 });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
            setLogs([]);
            setProgress(0);
            setCurrentStep('');
            setStats({ processed: 0, saved: 0, failed: 0 });
        }
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const processPage = async (
        pageData: { base64: string; mimeType: string },
        fileName: string,
        pageLabel: string
    ): Promise<boolean> => {
        try {
            // Analyze with Gemini
            const analysisRes = await analyzeDocument({ fileData: pageData.base64, mimeType: pageData.mimeType });

            if (!analysisRes.success) {
                addLog(`   ❌ Analysis failed: ${analysisRes.error}`);
                return false;
            }

            const { text, description, chapter, page_number } = analysisRes.data;
            addLog(`   ↳ Detected: ${chapter} (Page ${page_number || 'Unknown'})`);

            // Save to knowledge base
            const saveRes = await saveToKnowledgeBase({
                text, description, chapter, page_number,
                fileName: `${fileName}_${pageLabel}`,
                metadata
            });

            if (saveRes.success) {
                addLog(`   ✅ Saved successfully.`);
                return true;
            } else {
                addLog(`   ❌ Save failed: ${saveRes.error}`);
                return false;
            }
        } catch (error: any) {
            addLog(`   ❌ Error: ${error.message}`);
            return false;
        }
    };

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
        setStats({ processed: 0, saved: 0, failed: 0 });

        let totalSaved = 0;
        let totalFailed = 0;
        let totalProcessed = 0;

        try {
            const fileArray = Array.from(files);
            let totalItems = 0;
            const fileInfo: { file: File; isPdf: boolean; pageCount: number }[] = [];

            setCurrentStep('📊 Scanning files (client-side)...');
            addLog('📊 Scanning files locally (no upload yet)...');

            // PHASE 1: Count pages on client-side (no server call needed)
            for (const file of fileArray) {
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

                if (isPdf) {
                    // Count pages on client-side using pdf-lib
                    const pageCount = await getPdfPageCount(file);
                    if (pageCount > 0) {
                        fileInfo.push({ file, isPdf: true, pageCount });
                        totalItems += pageCount;
                        addLog(`   📄 ${file.name}: ${pageCount} pages (will be split locally)`);
                    } else {
                        fileInfo.push({ file, isPdf: true, pageCount: 0 });
                        addLog(`   ⚠️ ${file.name}: Could not read PDF`);
                    }
                } else {
                    fileInfo.push({ file, isPdf: false, pageCount: 1 });
                    totalItems += 1;
                    addLog(`   🖼️ ${file.name}: 1 image`);
                }
            }

            addLog(`\n📋 Total items to process: ${totalItems}\n`);
            addLog(`💡 PDFs are split locally before uploading - no large file uploads!\n`);

            let currentItem = 0;

            // PHASE 2: Process each file
            for (const { file, isPdf, pageCount } of fileInfo) {
                addLog(`\n▶ Processing ${file.name}...`);

                if (isPdf) {
                    if (pageCount === 0) {
                        addLog(`   ⚠️ Skipping - could not read PDF`);
                        totalFailed++;
                        continue;
                    }

                    // SPLIT PDF ON CLIENT-SIDE (key change!)
                    setCurrentStep(`📤 Splitting ${file.name} locally...`);
                    addLog(`   📤 Splitting PDF into pages (client-side)...`);

                    const splitResult = await splitPdfClientSide(file);

                    if (!splitResult.success || !splitResult.pages) {
                        addLog(`   ❌ Failed to split PDF: ${splitResult.error}`);
                        totalFailed++;
                        continue;
                    }

                    addLog(`   ✅ Split into ${splitResult.pages.length} pages`);

                    // Process each page (each page is sent separately = small request)
                    for (const page of splitResult.pages) {
                        currentItem++;
                        const progressPercent = Math.round((currentItem / totalItems) * 100);
                        setProgress(progressPercent);
                        setCurrentStep(`📄 ${file.name} - Page ${page.pageNumber}/${pageCount} (${progressPercent}%)`);

                        addLog(`   📖 Page ${page.pageNumber}/${pageCount}: Uploading & Analyzing...`);

                        const success = await processPage(
                            { base64: page.base64, mimeType: page.mimeType },
                            file.name,
                            `page_${page.pageNumber}`
                        );

                        totalProcessed++;
                        if (success) {
                            totalSaved++;
                        } else {
                            totalFailed++;
                        }

                        setStats({ processed: totalProcessed, saved: totalSaved, failed: totalFailed });
                    }
                } else {
                    // Image file - process directly (usually small)
                    currentItem++;
                    const progressPercent = Math.round((currentItem / totalItems) * 100);
                    setProgress(progressPercent);
                    setCurrentStep(`🖼️ ${file.name} (${progressPercent}%)`);

                    const { base64, mimeType } = await fileToBase64(file);

                    addLog(`   🖼️ Uploading & Analyzing image...`);

                    const success = await processPage(
                        { base64, mimeType },
                        file.name,
                        'image'
                    );

                    totalProcessed++;
                    if (success) {
                        totalSaved++;
                    } else {
                        totalFailed++;
                    }

                    setStats({ processed: totalProcessed, saved: totalSaved, failed: totalFailed });
                }
            }

            setProgress(100);
            setCurrentStep('✅ Processing Complete!');
            addLog(`\n═══════════════════════════════════════`);
            addLog(`📊 SUMMARY: ${totalSaved} saved, ${totalFailed} failed, ${totalProcessed} total`);
            addLog(`═══════════════════════════════════════`);

            if (totalFailed === 0) {
                toast.success(`Successfully processed ${totalSaved} pages!`);
            } else {
                toast.warning(`Completed: ${totalSaved} saved, ${totalFailed} failed`);
            }

            setFiles(null);
            const fileInput = document.getElementById('file-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

        } catch (error: any) {
            console.error(error);
            toast.error('Unexpected error during batch process');
            addLog(`\n💥 Critical Error: ${error.message}`);
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
                <Link href="/admin/knowledge-base/manage">
                    <Button variant="outline">
                        <FileText className="w-4 h-4 mr-2" />
                        Manage KB
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Upload Content</CardTitle>
                    <CardDescription>
                        Upload images or multi-page PDFs. PDFs are split locally before processing - no large file uploads!
                    </CardDescription>
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
                        <p className="text-xs text-slate-400">PDFs are split locally - no size limit on PDF files!</p>
                        <Input id="file-upload" type="file" multiple accept=".pdf, image/*" className="hidden" onChange={handleFileChange} />
                        {files && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-green-600 font-medium">
                                {Array.from(files).some(f => f.type === 'application/pdf' || f.name.endsWith('.pdf')) ? (
                                    <FileText className="w-4 h-4" />
                                ) : (
                                    <ImageIcon className="w-4 h-4" />
                                )}
                                {files.length} files selected
                            </div>
                        )}
                    </div>

                    {/* Stats Summary */}
                    {stats.processed > 0 && (
                        <div className="flex gap-4 justify-center text-sm">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                                📊 Processed: {stats.processed}
                            </span>
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
                                ✅ Saved: {stats.saved}
                            </span>
                            {stats.failed > 0 && (
                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full">
                                    ❌ Failed: {stats.failed}
                                </span>
                            )}
                        </div>
                    )}

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
                        <div className="mt-4 p-4 bg-slate-900 text-green-400 rounded-lg max-h-80 overflow-y-auto font-mono text-xs shadow-inner">
                            {logs.map((log, i) => (
                                <div key={i} className="py-0.5 whitespace-pre-wrap">{log}</div>
                            ))}
                            {loading && <div className="animate-pulse">_</div>}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
