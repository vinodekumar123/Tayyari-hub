'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, Download, Play, Scissors, Save } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { splitPdfClientSide, getPdfPageCount, splitPdfByRanges, ChapterRange } from '@/lib/pdfClientProcessor';
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
        setStep('scanning');
        setStatus('Preparing PDF...');
        setProgress(0);

        try {
            // Split PDF into pages client-side to send for analysis
            const splitRes = await splitPdfClientSide(file);
            if (!splitRes.success || !splitRes.pages) {
                throw new Error(splitRes.error);
            }

            const total = splitRes.pages.length;
            const chapters: ChapterRange[] = [];
            let currentChapterStart = 1;
            let currentChapterTitle = "Introduction / Front Matter";

            // Parallel Processing Configuration
            const BATCH_SIZE = 5;
            const pages = splitRes.pages;

            // We need to process sequentially to maintain chapter order logic,
            // BUT we can fetch AI analysis in parallel batches.
            // However, determining "Start of Chapter" relies on AI result.
            // If we fetch Page 1, 2, 3, 4, 5 in parallel:
            // Page 1: Start
            // Page 2: Not Start
            // Page 3: Start (Chapter 1)
            // We can resolve them and THEN iterate to build chapters.

            const aiResults = new Array(total).fill(null);
            let processedCount = 0;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = pages.slice(i, i + BATCH_SIZE);
                setStatus(`Analyzing Pages ${i + 1}-${Math.min(i + BATCH_SIZE, total)} of ${total}...`);

                // Fire requests in parallel
                const promises = batch.map(page => detectChapterStart(page.base64, page.mimeType).then(res => ({ idx: page.pageNumber - 1, res })));
                const results = await Promise.all(promises);

                results.forEach(({ idx, res }) => {
                    if (res.success && res.data) {
                        aiResults[idx] = res.data;
                    }
                    processedCount++;
                });

                setProgress(Math.round((processedCount / total) * 100));
            }

            // Post-Processing: Build Chapters from AI Results
            for (let i = 0; i < total; i++) {
                const result = aiResults[i];
                const pageNum = i + 1;

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
            chapters.push({
                name: currentChapterTitle,
                startPage: currentChapterStart,
                endPage: total
            });

            setDetectedChapters(chapters);
            setStep('review');

            // Save to local storage
            localStorage.setItem(STORAGE_KEY_PREFIX + file.name, JSON.stringify(chapters));
            toast.success(`Scan Complete! Detected ${chapters.length} sections.`);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to scan book");
            setStep('upload');
        } finally {
            setLoading(false);
        }
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
        setStep('splitting');
        // We reuse 'splitting' step for progress UI but chang text
        setStatus('Initializing Knowledge Base Upload...');
        setProgress(0);

        try {
            setStatus('Preparing file for ingestion...');
            const splitRes = await splitPdfClientSide(file);
            if (!splitRes.success || !splitRes.pages) {
                throw new Error(splitRes.error);
            }

            let totalPagesProcessed = 0;
            const totalPagesToProcess = detectedChapters.reduce((acc, ch) => acc + (ch.endPage - ch.startPage + 1), 0);

            // Iterate through chapters
            for (const chapter of detectedChapters) {
                // Iterate pages in this chapter
                for (let i = chapter.startPage; i <= chapter.endPage; i++) {
                    const pageIndex = i - 1; // 0-based
                    const pageData = splitRes.pages[pageIndex];

                    setStatus(`Uploading ${chapter.name} - Page ${i}...`);

                    // 1. Analyze
                    const analysis = await analyzeDocument({
                        fileData: pageData.base64,
                        mimeType: pageData.mimeType
                    });

                    if (!analysis.success || !analysis.data) {
                        console.error(`Failed to analyze page ${i}`, analysis.error);
                        continue;
                    }

                    // 2. Save
                    await saveToKnowledgeBase({
                        text: analysis.data.text,
                        description: analysis.data.description,
                        chapter: chapter.name,
                        page_number: i.toString(),
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

            toast.success("All chapters uploaded to Knowledge Base!");
            setStep('upload');

        } catch (error: any) {
            console.error(error);
            toast.error("Upload failed: " + error.message);
            setStep('review');
        } finally {
            setLoading(false);
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
