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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== 'application/pdf') {
                toast.error("Please select a PDF file");
                return;
            }
            setFile(selectedFile);
            setStep('upload');
            setDetectedChapters([]);

            const count = await getPdfPageCount(selectedFile);
            setTotalPages(count);
        }
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

            // Analyze each page
            for (let i = 0; i < total; i++) {
                const page = splitRes.pages[i];
                setStatus(`Analyzing Page ${page.pageNumber}/${total}...`);
                setProgress(Math.round(((i + 1) / total) * 100));

                const aiRes = await detectChapterStart(page.base64, page.mimeType);

                if (aiRes.success && aiRes.data?.isStart && aiRes.data.confidence > 0.6) {
                    // Found a new chapter start!

                    // Close previous chapter
                    if (i > 0) { // Don't close if it's the very first page
                        chapters.push({
                            name: currentChapterTitle,
                            startPage: currentChapterStart,
                            endPage: page.pageNumber - 1
                        });
                    }

                    // Start new chapter
                    currentChapterStart = page.pageNumber;
                    currentChapterTitle = aiRes.data.title || `Chapter (Page ${page.pageNumber})`;
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
    };

    const addChapter = () => {
        setDetectedChapters([
            ...detectedChapters,
            { name: "New Section", startPage: 1, endPage: 1 }
        ]);
    };

    const removeChapter = (index: number) => {
        const newChapters = [...detectedChapters];
        newChapters.splice(index, 1);
        setDetectedChapters(newChapters);
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

                    {file && step === 'upload' && (
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
                            <Button onClick={startSplit} className="bg-green-600 hover:bg-green-700">
                                <Download className="mr-2 w-4 h-4" />
                                Download Separated PDFs (Zip)
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
