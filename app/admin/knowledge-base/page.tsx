'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, Image as ImageIcon, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { analyzeDocument, saveToKnowledgeBase } from '@/app/actions/knowledgeBase';
import { getAllSubjectsWithChapters } from '@/app/actions/knowledgeBaseManagement';
import { splitPdfClientSide, getPdfPageCount, fileToBase64 } from '@/lib/pdfClientProcessor';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

interface FailedItem {
    id: string;
    fileName: string;
    pageLabel: string;
    data: { base64: string; mimeType: string };
    error: string;
}

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

    // Failed Items for Retry
    const [failedItems, setFailedItems] = useState<FailedItem[]>([]);

    // Subjects and Chapters
    const [subjectsList, setSubjectsList] = useState<{ id: string; name: string; chapters: Record<string, boolean> }[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string>('');

    // Fetch Subjects on Mount
    useEffect(() => {
        const fetchSubjects = async () => {
            const res = await getAllSubjectsWithChapters();
            if (res.success && res.subjects) {
                setSubjectsList(res.subjects);
            }
        };
        fetchSubjects();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFiles(e.target.files);
            setLogs([]);
            setProgress(0);
            setCurrentStep('');
            setStats({ processed: 0, saved: 0, failed: 0 });
            setFailedItems([]); // Clear previous failures on new upload
        }
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const processPage = async (
        pageData: { base64: string; mimeType: string },
        fileName: string,
        pageLabel: string
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            // Analyze with Gemini
            const analysisRes = await analyzeDocument({ fileData: pageData.base64, mimeType: pageData.mimeType });

            if (!analysisRes.success) {
                addLog(`   ❌ Analysis failed: ${analysisRes.error}`);
                return { success: false, error: analysisRes.error };
            }

            const { text, description, chapter, page_number } = analysisRes.data;
            const finalChapter = selectedChapter || chapter;
            addLog(`   ↳ Detected: ${chapter} (Page ${page_number || 'Unknown'})`);
            if (selectedChapter) addLog(`   ↳ Using selected chapter: ${selectedChapter}`);

            // Save to knowledge base
            const saveRes = await saveToKnowledgeBase({
                text, description, chapter: finalChapter, page_number,
                fileName: `${fileName}_${pageLabel}`,
                metadata
            });

            if (saveRes.success) {
                addLog(`   ✅ Saved successfully.`);
                return { success: true };
            } else {
                addLog(`   ❌ Save failed: ${saveRes.error}`);
                return { success: false, error: saveRes.error };
            }
        } catch (error: any) {
            addLog(`   ❌ Error: ${error.message}`);
            return { success: false, error: error.message };
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

        // Force valid chapter if subject is selected but chapter is not
        if (metadata.subject && subjectsList.find(s => s.name === metadata.subject) && !selectedChapter) {
            toast.warning('Please select a chapter associated with the subject.');
            return;
        }

        setLoading(true);
        setLogs([]);
        setProgress(0);
        setStats({ processed: 0, saved: 0, failed: 0 });
        setFailedItems([]);

        let totalSaved = 0;
        let totalFailed = 0;
        let totalProcessed = 0;

        try {
            const fileArray = Array.from(files);
            let totalItems = 0;
            const fileInfo: { file: File; isPdf: boolean; pageCount: number }[] = [];

            setCurrentStep('📊 Scanning files (client-side)...');
            addLog('📊 Scanning files locally (no upload yet)...');

            // PHASE 1: Count pages on client-side
            for (const file of fileArray) {
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

                if (isPdf) {
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

                    setCurrentStep(`📤 Splitting ${file.name} locally...`);
                    addLog(`   📤 Splitting PDF into pages (client-side)...`);

                    const splitResult = await splitPdfClientSide(file);

                    if (!splitResult.success || !splitResult.pages) {
                        addLog(`   ❌ Failed to split PDF: ${splitResult.error}`);
                        totalFailed++;
                        continue;
                    }

                    addLog(`   ✅ Split into ${splitResult.pages.length} pages`);

                    for (const page of splitResult.pages) {
                        currentItem++;
                        const progressPercent = Math.round((currentItem / totalItems) * 100);
                        setProgress(progressPercent);
                        setCurrentStep(`📄 ${file.name} - Page ${page.pageNumber}/${pageCount} (${progressPercent}%)`);

                        addLog(`   📖 Page ${page.pageNumber}/${pageCount}: Uploading & Analyzing...`);

                        const pageLabel = `page_${page.pageNumber}`;
                        const result = await processPage(
                            { base64: page.base64, mimeType: page.mimeType },
                            file.name,
                            pageLabel
                        );

                        totalProcessed++;
                        if (result.success) {
                            totalSaved++;
                        } else {
                            totalFailed++;
                            setFailedItems(prev => [...prev, {
                                id: Math.random().toString(36).substr(2, 9),
                                fileName: file.name,
                                pageLabel: pageLabel,
                                data: { base64: page.base64, mimeType: page.mimeType },
                                error: result.error || 'Unknown error'
                            }]);
                        }

                        setStats({ processed: totalProcessed, saved: totalSaved, failed: totalFailed });
                    }
                } else {
                    currentItem++;
                    const progressPercent = Math.round((currentItem / totalItems) * 100);
                    setProgress(progressPercent);
                    setCurrentStep(`🖼️ ${file.name} (${progressPercent}%)`);

                    const { base64, mimeType } = await fileToBase64(file);

                    addLog(`   🖼️ Uploading & Analyzing image...`);

                    const result = await processPage(
                        { base64, mimeType },
                        file.name,
                        'image'
                    );

                    totalProcessed++;
                    if (result.success) {
                        totalSaved++;
                    } else {
                        totalFailed++;
                        setFailedItems(prev => [...prev, {
                            id: Math.random().toString(36).substr(2, 9),
                            fileName: file.name,
                            pageLabel: 'image',
                            data: { base64, mimeType },
                            error: result.error || 'Unknown error'
                        }]);
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
                toast.warning(`Completed with ${totalFailed} failures. Check "Failed Items" below.`);
            }

            // Clean up file input if successful completely
            if (totalFailed === 0) {
                setFiles(null);
                const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            }

        } catch (error: any) {
            console.error(error);
            toast.error('Unexpected error during batch process');
            addLog(`\n💥 Critical Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async () => {
        if (failedItems.length === 0) return;

        setLoading(true);
        addLog(`\n🔄 Retrying ${failedItems.length} failed items...`);
        setCurrentStep(`🔄 Retrying failures...`);

        const itemsToRetry = [...failedItems];
        setFailedItems([]); // Clear list, will re-add if they fail again

        let retriedSaved = 0;
        let retriedFailed = 0;

        for (const item of itemsToRetry) {
            addLog(`   🔄 Retrying ${item.fileName} (${item.pageLabel})...`);

            const result = await processPage(item.data, item.fileName, item.pageLabel);

            if (result.success) {
                retriedSaved++;
                setStats(prev => ({ ...prev, saved: prev.saved + 1, failed: prev.failed - 1 }));
            } else {
                retriedFailed++;
                // Add back to failed list
                setFailedItems(prev => [...prev, item]); // Keep the same item
            }
        }

        setLoading(false);
        setCurrentStep(retriedFailed === 0 ? '✅ Retry Complete!' : '⚠️ Retry Complete with some failures');

        if (retriedFailed === 0) {
            toast.success(`Successfully retried ${retriedSaved} items!`);
        } else {
            toast.warning(`Retry result: ${retriedSaved} recovered, ${retriedFailed} still failed.`);
        }
    };

    const removeFailedItem = (id: string) => {
        setFailedItems(prev => {
            const updated = prev.filter(i => i.id !== id);
            setStats(s => ({ ...s, failed: updated.length }));
            return updated;
        });
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
                            {/* <Input placeholder="e.g. Biology" value={metadata.subject} onChange={e => setMetadata({ ...metadata, subject: e.target.value })} /> */}
                            <Select value={metadata.subject} onValueChange={(v) => {
                                setMetadata({ ...metadata, subject: v });
                                setSelectedChapter(''); // Reset chapter on subject change
                            }}>
                                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                                <SelectContent>
                                    {subjectsList.map((sub) => (
                                        <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                                    ))}
                                    {/* Fallback or allow custom? For now standard list */}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Chapter Selection (Conditional) */}
                        {metadata.subject && subjectsList.find(s => s.name === metadata.subject) && (
                            <div className="space-y-2">
                                <Label>Chapter</Label>
                                <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                                    <SelectTrigger><SelectValue placeholder="Select Chapter" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.keys(subjectsList.find(s => s.name === metadata.subject)?.chapters || {}).map((ch) => (
                                            <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
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

                    {/* Failed Items Retry Section */}
                    {failedItems.length > 0 && (
                        <div className="mt-6 border border-red-200 bg-red-50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2 text-red-800 font-bold">
                                    <AlertCircle className="w-5 h-5" />
                                    <span>Failed Items ({failedItems.length})</span>
                                </div>
                                <Button onClick={handleRetry} disabled={loading} variant="destructive" size="sm">
                                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                    Retry All Failed
                                </Button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {failedItems.map((item) => (
                                    <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded border border-red-100 text-sm">
                                        <div>
                                            <div className="font-medium text-slate-700">{item.fileName}</div>
                                            <div className="text-xs text-slate-500">{item.pageLabel} • {item.error}</div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                                            onClick={() => removeFailedItem(item.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
