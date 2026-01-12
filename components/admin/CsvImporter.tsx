'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Upload,
    Download,
    FileText,
    CheckCircle2,
    AlertCircle,
    X,
    Loader2,
    ArrowRight,
    Database
} from 'lucide-react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CsvImporterProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: any[]) => Promise<void>;
    defaultMetadata: Record<string, any>;
    metadataLabels?: Record<string, string>; // Friendly labels for metadata keys
    initialData?: any[]; // Data injected directly (e.g. from AI), bypassing upload
}

export function CsvImporter({
    isOpen,
    onClose,
    onImport,
    defaultMetadata,
    metadataLabels = {},
    initialData
}: CsvImporterProps) {

    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [csvData, setCsvData] = useState<any[]>([]);
    const [validationErrors, setValidationErrors] = useState<{ row: number, error: string }[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [editingRow, setEditingRow] = useState<{ index: number, data: any } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadedRef = useRef(false);

    // Validate Function
    const validateRow = (row: any, index: number) => {
        const errors: string[] = [];
        const rowNum = index + 1;

        if (!row.questionText?.trim()) errors.push("Missing Question Text");
        if (!row.correctAnswer?.trim()) errors.push("Missing Correct Answer");

        // Check options
        const options = [row.option1, row.option2, row.option3, row.option4].filter(Boolean);
        if (options.length < 2) errors.push("At least 2 options required");

        // Check correct answer matches options
        if (row.correctAnswer && options.length >= 2) {
            const normalizedCorrect = row.correctAnswer.trim();
            const match = options.find(o => o.toString().trim() === normalizedCorrect);
            if (!match) errors.push(`Correct answer '${row.correctAnswer}' not found in options`);
        }

        return errors;
    };

    // Effect: Handle Initial Data Injection
    // We use a useEffect to ensure state updates happen after mount/update, not during render.
    useEffect(() => {
        if (initialData && initialData.length > 0 && !loadedRef.current && isOpen) {
            const errors: { row: number, error: string }[] = [];
            initialData.forEach((row, i) => {
                const rowErrors = validateRow(row, i);
                rowErrors.forEach(err => errors.push({ row: i + 1, error: err }));
            });

            setCsvData(initialData);
            setValidationErrors(errors);
            setStep('preview');
            loadedRef.current = true;
        }
    }, [initialData, isOpen]);

    const reset = () => {
        setStep('upload');
        setCsvData([]);
        setValidationErrors([]);
        setIsImporting(false);
        setEditingRow(null);
    };

    const handleClose = () => {
        reset();
        loadedRef.current = false;
        onClose();
    };

    const downloadTemplate = () => {
        // Only include question-specific fields, not the global metadata
        const headers = ['questionText', 'option1', 'option2', 'option3', 'option4', 'correctAnswer', 'explanation', 'topic', 'difficulty', 'imageUrl'];
        const dummy = ['What is the speed of light?', '3x10^8 m/s', '3x10^6 m/s', 'Zero', 'Infinite', '3x10^8 m/s', 'It is constant in vacuum', 'Light', 'Medium', ''];
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), dummy.join(',')].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "question_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    const revalidateAll = (data: any[]) => {
        const errors: { row: number, error: string }[] = [];
        data.forEach((row, i) => {
            const rowErrors = validateRow(row, i);
            rowErrors.forEach(err => errors.push({ row: i + 1, error: err }));
        });
        setValidationErrors(errors);
    };

    const handleSaveEdit = (index: number, newData: any) => {
        const updatedData = [...csvData];
        updatedData[index] = newData;
        setCsvData(updatedData);
        revalidateAll(updatedData);
        setEditingRow(null);
        toast.success("Row updated");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rawData = results.data as any[];
                const errors: { row: number, error: string }[] = [];

                // Validate all rows
                rawData.forEach((row, i) => {
                    const rowErrors = validateRow(row, i);
                    rowErrors.forEach(err => errors.push({ row: i + 1, error: err }));
                });

                setCsvData(rawData);
                setValidationErrors(errors);
                setStep('preview');
            },
            error: (err) => {
                toast.error("Failed to parse CSV: " + err.message);
            }
        });

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFinalImport = async () => {
        if (validationErrors.length > 0) {
            toast.error("Please fix validation errors before importing.");
            return;
        }

        setIsImporting(true);
        try {
            // Merge metadata with each row
            const finalData = csvData.map(row => ({
                ...defaultMetadata,
                ...row
            }));

            await onImport(finalData);
            toast.success(`Successfully imported ${finalData.length} questions!`);
            handleClose();
        } catch (error) {
            console.error("Import failed:", error);
            toast.error("Import failed. Check console for details.");
        } finally {
            setIsImporting(false);
        }
    };

    const validCount = csvData.length - new Set(validationErrors.map(e => e.row)).size;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">

                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <Database className="w-5 h-5 text-primary" />
                                Bulk Question Import
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                Import questions for:
                                <span className="font-semibold text-foreground ml-1">
                                    {Object.entries(defaultMetadata)
                                        .filter(([_, v]) => v) // Only show truthy values
                                        .map(([k, v]) => `${metadataLabels[k] || k}: ${v}`)
                                        .join(' • ')}
                                </span>
                            </DialogDescription>
                        </div>
                        {step === 'upload' && (
                            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                                <Download className="w-4 h-4" /> Template
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-6 flex flex-col min-h-0">
                    {step === 'upload' ? (
                        <div
                            className="h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="p-4 rounded-full bg-primary/10 text-primary">
                                <Upload className="w-8 h-8" />
                            </div>
                            <div className="text-center space-y-1">
                                <h3 className="font-semibold text-lg">Click to Upload CSV</h3>
                                <p className="text-sm text-muted-foreground">or drag and drop file here</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0 gap-4">
                            {/* Stats Bar */}
                            <div className="flex gap-4">
                                <div className="flex-1 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900 flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <div className="text-sm font-medium text-blue-900 dark:text-blue-300">Total Rows</div>
                                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{csvData.length}</div>
                                    </div>
                                </div>
                                <div className="flex-1 p-3 rounded-lg border bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <div>
                                        <div className="text-sm font-medium text-green-900 dark:text-green-300">Valid</div>
                                        <div className="text-2xl font-bold text-green-700 dark:text-green-400">{validCount}</div>
                                    </div>
                                </div>
                                <div className={`flex-1 p-3 rounded-lg border flex items-center gap-3 ${validationErrors.length > 0 ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900' : 'bg-gray-50 dark:bg-gray-900 border-gray-100'}`}>
                                    <AlertCircle className={`w-5 h-5 ${validationErrors.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                                    <div>
                                        <div className={`text-sm font-medium ${validationErrors.length > 0 ? 'text-red-900 dark:text-red-300' : 'text-gray-500'}`}>Errors</div>
                                        <div className={`text-2xl font-bold ${validationErrors.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-500'}`}>{validationErrors.length}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-0">
                                <div className="bg-muted/50 p-2 text-xs font-semibold text-center border-b">
                                    All {csvData.length} rows will be tagged with: {Object.values(defaultMetadata).filter(Boolean).join(', ')}
                                </div>
                                <div className="flex-1 overflow-auto min-h-0">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">#</TableHead>
                                                <TableHead className="min-w-[200px]">Question</TableHead>
                                                <TableHead className="min-w-[150px]">Options</TableHead>
                                                <TableHead className="w-[100px]">Correct</TableHead>
                                                <TableHead className="w-[100px]">Difficulty</TableHead>
                                                <TableHead className="w-[100px]">Status</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {csvData.map((row, i) => {
                                                const error = validationErrors.find(e => e.row === i + 1);
                                                return (
                                                    <TableRow key={i} className={error ? "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50" : ""}>
                                                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                                                        <TableCell className="max-w-[400px]">
                                                            <div className="whitespace-pre-wrap font-medium pr-2">{row.questionText}</div>
                                                            {row.topic && <Badge variant="outline" className="text-[10px] mt-1">{row.topic}</Badge>}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground max-w-[250px] whitespace-pre-wrap">
                                                            {[row.option1, row.option2, row.option3, row.option4].join(', ')}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-medium">{row.correctAnswer}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={row.difficulty === 'Hard' ? 'destructive' : row.difficulty === 'Medium' ? 'default' : 'secondary'} className="text-[10px]">
                                                                {row.difficulty || 'Default'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {error ? (
                                                                <div className="flex items-center gap-1 text-red-600 text-xs font-semibold" title={error.error}>
                                                                    <AlertCircle className="w-4 h-4" /> Invalid
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                                                                    <CheckCircle2 className="w-4 h-4" /> Ready
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0"
                                                                onClick={() => setEditingRow({ index: i, data: { ...row } })}
                                                            >
                                                                <FileText className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* Error List */}
                            {validationErrors.length > 0 && (
                                <div className="h-[100px] border rounded-lg bg-red-50/30 dark:bg-red-900/10 overflow-auto p-3 text-xs space-y-1">
                                    <div className="font-semibold text-red-700 sticky top-0 bg-transparent">Validation Issues:</div>
                                    {validationErrors.map((e, i) => (
                                        <div key={i} className="text-red-600">Row {e.row}: {e.error}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 border-t bg-muted/20">
                    {step === 'upload' ? (
                        <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                    ) : (
                        <div className="flex justify-between w-full items-center">
                            <Button variant="ghost" onClick={() => setStep('upload')}>
                                Change File
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                                <Button
                                    onClick={handleFinalImport}
                                    disabled={validationErrors.length > 0 || isImporting}
                                    className={cn(validationErrors.length > 0 && "opacity-50 cursor-not-allowed")}
                                >
                                    {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                                    Import {validCount} Questions
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogFooter>

            </DialogContent>

            <EditRowDialog
                open={!!editingRow}
                onOpenChange={(open) => !open && setEditingRow(null)}
                rowData={editingRow?.data}
                onSave={(newData) => handleSaveEdit(editingRow!.index, newData)}
            />
        </Dialog>
    );
}

function EditRowDialog({ open, onOpenChange, rowData, onSave }: { open: boolean, onOpenChange: (o: boolean) => void, rowData: any, onSave: (d: any) => void }) {
    const [localData, setLocalData] = useState<any>(rowData || {});

    // Sync state when rowData changes
    const prevRowDataRef = useRef(rowData);
    if (rowData !== prevRowDataRef.current) {
        prevRowDataRef.current = rowData;
        setLocalData(rowData || {});
    }

    const handleChange = (field: string, val: string) => {
        setLocalData({ ...localData, [field]: val });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2 border-b">
                    <DialogTitle>Edit Question Details</DialogTitle>
                    <DialogDescription>Modify the imported data for this row.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Question Text</label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={localData.questionText || ''}
                                onChange={(e) => handleChange('questionText', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(num => (
                                <div key={num} className="grid gap-2">
                                    <label className="text-sm font-medium">Option {num}</label>
                                    <input
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={localData[`option${num}`] || ''}
                                        onChange={(e) => handleChange(`option${num}`, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-green-600">Correct Answer</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={localData.correctAnswer || ''}
                                onChange={(e) => handleChange('correctAnswer', e.target.value)}
                                placeholder="Must match one option exactly"
                            />
                            {localData.correctAnswer && ![localData.option1, localData.option2, localData.option3, localData.option4].includes(localData.correctAnswer) && (
                                <span className="text-xs text-red-500">Warning: Does not match any option currently.</span>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Explanation</label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={localData.explanation || ''}
                                onChange={(e) => handleChange('explanation', e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Topic</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={localData.topic || ''}
                                onChange={(e) => handleChange('topic', e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Difficulty</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={localData.difficulty || 'Medium'}
                                onChange={(e) => handleChange('difficulty', e.target.value)}
                            >
                                <option value="Easy">Easy</option>
                                <option value="Medium">Medium</option>
                                <option value="Hard">Hard</option>
                            </select>
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-4 border-t bg-muted/20">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => onSave(localData)}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
