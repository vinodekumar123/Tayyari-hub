'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, Download, Play, Scissors, Save } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { splitPdfClientSide, getPdfPageCount, splitPdfByRanges, ChapterRange, extractPageBatch } from '@/lib/pdfClientProcessor';
import { detectChapterStart } from '@/app/actions/bookSplitter';
import { analyzeDocument, saveToKnowledgeBase } from '@/app/actions/knowledgeBase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';


import { Database } from 'lucide-react';

export default function BookSplitterPage() {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const abortScan = useRef(false);

    // Scan Results
    const [totalPages, setTotalPages] = useState(0);
    const [detectedChapters, setDetectedChapters] = useState<ChapterRange[]>([]);

    // UI State
    const [step, setStep] = useState<'upload' | 'scanning' | 'review' | 'splitting'>('upload');
    const [resumeAvailable, setResumeAvailable] = useState(false);

    // Load from local storage on mount
    const STORAGE_KEY_PREFIX = 'book_splitter_';

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'application/pdf') {
                toast.error("Please select a PDF file");
                return;
            }
            setFile(selectedFile);

            const count = await getPdfPageCount(selectedFile);
            setTotalPages(count);

            // Check for previous session
            const savedData = localStorage.getItem(STORAGE_KEY_PREFIX + selectedFile.name);
            if (savedData) {
                setResumeAvailable(true);
            } else {
                setStep('upload');
                setDetectedChapters([]);
            }
        }
    };

    const loadSavedSession = () => {
        if (!file) return;
        const savedData = localStorage.getItem(STORAGE_KEY_PREFIX + file.name);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                setDetectedChapters(parsed);
                setStep('review');
                toast.success("Resumed previous session!");
            } catch (e) {
                console.error("Failed to load session", e);
                localStorage.removeItem(STORAGE_KEY_PREFIX + file.name);
            }
        }
    };

    const clearSavedSession = () => {
        if (!file) return;
        localStorage.removeItem(STORAGE_KEY_PREFIX + file.name);
        setResumeAvailable(false);
        setDetectedChapters([]);
        setStep('upload');
    };

    const startScan = async () => {
        if (!file) return;

        setLoading(true);
        setIsScanning(true);
        abortScan.current = false;
        setStep('scanning');
        setStatus('Preparing PDF...');
        setProgress(0);

        try {
            // New optimized flow: Process in chunks to save memory
            const total = await getPdfPageCount(file);
            setTotalPages(total);

            const chapters: ChapterRange[] = [];
            let currentChapterStart = 1;
            let currentChapterTitle = "Introduction / Front Matter";

            // Parallel Processing Configuration
            const BATCH_SIZE = 10; // Increased concurrency for speed
            const aiResults = new Array(total).fill(null);
            let processedCount = 0;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                // Check for abort
                if (abortScan.current) {
                    setStatus('Scan aborted.');
                    toast.info("Scan cancelled by user.");
                    break;
                }

                const endPage = Math.min(i + BATCH_SIZE, total);
                setStatus(`Analyzing Pages ${i + 1}-${endPage} of ${total}...`);

                // Extract only this batch of pages
                // 1-indexed for extractPageBatch
                const batchPages = await extractPageBatch(file, i + 1, endPage);

                // Fire requests in parallel
                const promises = batchPages.map(page => detectChapterStart(page.base64, page.mimeType).then(res => ({ idx: page.pageNumber - 1, res })));
                const results = await Promise.all(promises);

                results.forEach(({ idx, res }) => {
                    if (res.success && res.data) {
                        aiResults[idx] = res.data;
                    }
                    processedCount++;
                });

                setProgress(Math.round((processedCount / total) * 100));
            }

            // Only build chapters if we finished (or partially finished?)
            // If aborted, maybe we still show what we found?
            // Let's assume we show what we have.

            // Post-Processing: Build Chapters from AI Results
            for (let i = 0; i < total; i++) {
                const result = aiResults[i];
                const pageNum = i + 1;

                // Stop building if we hit nulls (aborted area)
                if (!result && abortScan.current && i >= processedCount) break;

                if (result && result.isStart && result.confidence > 0.6) {
                    // Found a new chapter start!

                    // Close previous chapter
                    if (i > 0) {
                        // If the previous chapter started on the same page (very rare edge case), skip
                        if (currentChapterStart !== pageNum) {
                            chapters.push({
                                name: currentChapterTitle,
                                startPage: currentChapterStart,
                                endPage: pageNum - 1
                            });
                        }
                    }

                    // Start new chapter
                    currentChapterStart = pageNum;
                    currentChapterTitle = result.title || `Chapter (Page ${pageNum})`;
                }
            }

            // Close the final chapter
            // Note: If aborted, this "final chapter" might just be the rest of the book
            // which we haven't scanned yet. That's actually fine, user can delete it.
            chapters.push({
                name: currentChapterTitle,
                startPage: currentChapterStart,
                endPage: total
            });

            setDetectedChapters(chapters);

            if (!abortScan.current) {
                setStep('review');
                localStorage.setItem(STORAGE_KEY_PREFIX + file.name, JSON.stringify(chapters));
                toast.success(`Scan Complete! Detected ${chapters.length} sections.`);
            } else {
                // If aborted, stay on review or go back?
                // Maybe go to review to show partial results?
                setStep('review');
            }

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to scan book");
            setStep('upload');
        } finally {
            setLoading(false);
            setIsScanning(false);
        }
    };

    const handleStopScan = () => {
        abortScan.current = true;
        setStatus('Stopping scan...');
    };

    const updateChapter = (index: number, field: keyof ChapterRange, value: any) => {
        const newChapters = [...detectedChapters];
        newChapters[index] = { ...newChapters[index], [field]: value };
        setDetectedChapters(newChapters);

        // Update local storage
        if (file) {
            localStorage.setItem(STORAGE_KEY_PREFIX + file.name, JSON.stringify(newChapters));
        }
    };

    const addChapter = () => {
        const lastChapter = detectedChapters[detectedChapters.length - 1];
        const newStart = lastChapter ? lastChapter.endPage + 1 : 1;

        const newChapters = [
            ...detectedChapters,
            { name: "New Section", startPage: newStart, endPage: newStart }
        ];
        setDetectedChapters(newChapters);
        if (file) localStorage.setItem(STORAGE_KEY_PREFIX + file.name, JSON.stringify(newChapters));
    };

    const removeChapter = (index: number) => {
        const newChapters = [...detectedChapters];
        newChapters.splice(index, 1);
        setDetectedChapters(newChapters);
        if (file) localStorage.setItem(STORAGE_KEY_PREFIX + file.name, JSON.stringify(newChapters));
    };

    const startKbUpload = async () => {
        if (!file) return;

        setLoading(true);
        setIsScanning(true);
        abortScan.current = false;
        setStep('splitting');
        // We reuse 'splitting' step for progress UI but chang text
        setStatus('Initializing Knowledge Base Upload...');
        setProgress(0);

        try {
            const totalPagesToProcess = detectedChapters.reduce((acc, ch) => acc + (ch.endPage - ch.startPage + 1), 0);
            let totalPagesProcessed = 0;

            // Iterate through chapters
            for (const chapter of detectedChapters) {
                if (abortScan.current) break;

                // Process chapter in batches to save memory
                const BATCH_SIZE = 5;
                const chapterPages = chapter.endPage - chapter.startPage + 1;

                for (let i = 0; i < chapterPages; i += BATCH_SIZE) {
                    if (abortScan.current) break;

                    const batchStart = chapter.startPage + i;
                    const batchEnd = Math.min(chapter.startPage + i + BATCH_SIZE - 1, chapter.endPage);

                    setStatus(`Uploading ${chapter.name} - Pages ${batchStart}-${batchEnd}...`);

                    // Extract batch
                    const pages = await extractPageBatch(file, batchStart, batchEnd);

                    // Process batch
                    for (let p = 0; p < pages.length; p++) {
                        if (abortScan.current) break;
                        const pageData = pages[p];
                        const absPageNum = batchStart + p;

                        // 1. Analyze
                        const analysis = await analyzeDocument({
                            fileData: pageData.base64,
                            mimeType: pageData.mimeType
                        });

                        if (!analysis.success || !analysis.data) {
                            console.error(`Failed to analyze page ${absPageNum}`, analysis.error);
                            // Robustness: Continue despite error? Yes.
                            toast.error(`Failed to analyze Page ${absPageNum}`);
                            continue;
                        }

                        // 2. Save
                        await saveToKnowledgeBase({
                            text: analysis.data.text,
                            description: analysis.data.description,
                            chapter: chapter.name,
                            page_number: absPageNum.toString(),
                            fileName: file.name,
                            metadata: {
                                subject: "Imported from Splitter",
                                bookName: file.name.replace('.pdf', ''),
                                province: "Unknown",
                                year: new Date().getFullYear().toString(),
                                type: 'book'
                            }
                        });

                        totalPagesProcessed++;
                        setProgress(Math.round((totalPagesProcessed / totalPagesToProcess) * 100));
                    }
                }
            }

            if (!abortScan.current) {
                toast.success("All chapters uploaded to Knowledge Base!");
                setStep('upload');
            } else {
                toast.info("Upload stopped.");
                setStep('review');
            }

        } catch (error: any) {
            console.error(error);
            toast.error("Upload failed: " + error.message);
            setStep('review');
        } finally {
            setLoading(false);
            setIsScanning(false);
        }
    };

    const startSplit = async () => {
        if (!file) return;

        setLoading(true);
        setStep('splitting');
        setStatus('Generating Chapter PDFs...');
        setProgress(0);

        try {
            const res = await splitPdfByRanges(file, detectedChapters);

            if (!res.success || !res.files) {
                throw new Error(res.error);
            }

            // Create ZIP
            const zip = new JSZip();
            res.files.forEach(f => {
                zip.file(f.name, f.blob);
            });

            setStatus('Zipping files...');
            const content = await zip.generateAsync({ type: "blob" });

            saveAs(content, `${file.name.replace('.pdf', '')}_chapters.zip`);

            toast.success("Download started!");

            // Clear session on successful download? optional.
            // Maybe keep it in case they want to adjust.
            setStep('upload');

        } catch (error: any) {
            console.error(error);
            toast.error("Failed to split PDF");
            setStep('review'); // Go back to review
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">AI Book Splitter</h1>
            <p className="text-slate-500">Automatically detect chapters in a PDF and split them into separate files.</p>

            <Card>
                <CardHeader>
                    <CardTitle>1. Upload Book PDF</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-slate-50 transition">
                        <Input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="hidden"
                            id="pdf-upload"
                        />
                        <Label htmlFor="pdf-upload" className="cursor-pointer block">
                            {file ? (
                                <div className="text-green-600 font-medium flex flex-col items-center">
                                    <FileText className="w-12 h-12 mb-2" />
                                    {file.name} ({totalPages} pages)
                                </div>
                            ) : (
                                <div className="text-slate-400 flex flex-col items-center">
                                    <Upload className="w-12 h-12 mb-2" />
                                    <span>Click to Select PDF</span>
                                </div>
                            )}
                        </Label>
                    </div>

                    {file && resumeAvailable && step === 'upload' && (
                        <div className="bg-blue-50 p-4 rounded-md flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-blue-800">Previous Session Found</h3>
                                <p className="text-sm text-blue-600">You have saved progress for this file.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={clearSavedSession}>Start Fresh</Button>
                                <Button size="sm" onClick={loadSavedSession}>Resume</Button>
                            </div>
                        </div>
                    )}

                    {file && step === 'upload' && !resumeAvailable && (
                        <Button onClick={startScan} disabled={loading} className="w-full">
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 w-4 h-4" />}
                            Start AI Chapter Scan
                        </Button>
                    )}
                </CardContent>
            </Card>

            {step === 'scanning' && (
                <Card>
                    <CardContent className="py-8">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>{status}</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} />
                            <div className="flex justify-end mt-4">
                                <Button variant="destructive" size="sm" onClick={handleStopScan}>
                                    Stop Scan
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 'review' && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Review Detected Chapters</CardTitle>
                        <CardDescription>
                            The AI has detected {detectedChapters.length} sections. Please verify the page ranges and names.
                            Ensure page ranges are contiguous and correct.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Start Page</TableHead>
                                    <TableHead>End Page</TableHead>
                                    <TableHead className="w-1/2">Chapter Name</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detectedChapters.map((chapter, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={chapter.startPage}
                                                onChange={(e) => updateChapter(idx, 'startPage', parseInt(e.target.value))}
                                                className="w-20"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={chapter.endPage}
                                                onChange={(e) => updateChapter(idx, 'endPage', parseInt(e.target.value))}
                                                className="w-20"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={chapter.name}
                                                onChange={(e) => updateChapter(idx, 'name', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => removeChapter(idx)} className="text-red-500">
                                                <Scissors className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={addChapter}>Add Section</Button>
                            <div className="flex-1"></div>

                            <Button variant="secondary" onClick={startKbUpload} disabled={loading}>
                                <Database className="mr-2 w-4 h-4" />
                                Save to Knowledge Base
                            </Button>

                            <Button onClick={startSplit} className="bg-green-600 hover:bg-green-700">
                                <Download className="mr-2 w-4 h-4" />
                                Download Zip
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
            {step === 'splitting' && (
                <Card>
                    <CardContent className="py-8">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>{status}</span>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
