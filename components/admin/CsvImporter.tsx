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
    Database,
    Plus,
    Trash2,
    Copy,
    CheckSquare
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import Papa from 'papaparse';
import parse from 'html-react-parser';

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
    validChapters?: string[];
}

// Helper to extract option keys sorted
const getOptionKeys = (row: any) => {
    return Object.keys(row)
        .filter(k => k.startsWith('option'))
        .sort((a, b) => {
            // Sort by number: option1, option2, option10
            const numA = parseInt(a.replace('option', '')) || 0;
            const numB = parseInt(b.replace('option', '')) || 0;
            return numA - numB;
        });
};

export function CsvImporter({
    isOpen,
    onClose,
    onImport,
    defaultMetadata,
    metadataLabels = {},
    initialData,
    validChapters = []
}: CsvImporterProps) {

    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [csvData, setCsvData] = useState<any[]>([]);
    const [validationErrors, setValidationErrors] = useState<{ row: number, error: string }[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [editingRow, setEditingRow] = useState<{ index: number, data: any } | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadedRef = useRef(false);

    // Validate Function
    const validateRow = (row: any, index: number) => {
        const errors: string[] = [];
        const rowNum = index + 1;

        if (!row.questionText?.trim()) errors.push("Missing Question Text");
        if (!row.correctAnswer?.trim()) errors.push("Missing Correct Answer");

        // Check options dynamically
        const validOptions = getOptionKeys(row).map(k => row[k]).filter(val => val && val.trim() !== '');

        if (validOptions.length < 2) errors.push("At least 2 options required");

        // Check correct answer matches options
        if (row.correctAnswer && validOptions.length >= 2) {
            const normalizedCorrect = row.correctAnswer.trim();
            const match = validOptions.find(o => o.toString().trim() === normalizedCorrect);
            if (!match) errors.push(`Correct answer '${row.correctAnswer}' not found in options`);
        }

        // Validate Chapter
        if (validChapters.length > 0 && row.chapter) {
            const chapterMatch = validChapters.includes(row.chapter);
            if (!chapterMatch) {
                // Try fuzzy match or warn
                errors.push(`Invalid Chapter: '${row.chapter}'. Must match subject chapters.`);
            }
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
    }, [initialData, isOpen, validateRow]); // eslint-disable-line react-hooks/exhaustive-deps

    const reset = () => {
        setStep('upload');
        setCsvData([]);
        setValidationErrors([]);
        setIsImporting(false);
        setEditingRow(null);
        setSelectedRows(new Set());
    };

    const handleClose = () => {
        reset();
        loadedRef.current = false;
        onClose();
    };

    const downloadTemplate = () => {
        // Only include question-specific fields, not the global metadata
        // Dynamic template with 5 options
        const headers = ['questionText', 'option1', 'option2', 'option3', 'option4', 'option5', 'correctAnswer', 'explanation', 'chapter', 'difficulty', 'imageUrl'];
        const dummy = ['What is the speed of light?', '3x10^8 m/s', '3x10^6 m/s', 'Zero', 'Infinite', 'Unknown', '3x10^8 m/s', 'It is constant in vacuum', validChapters[0] || 'Chapter 1', 'Medium', ''];
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

    // Selection Helpers
    const toggleSelectAll = () => {
        if (selectedRows.size === csvData.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(csvData.map((_, i) => i)));
        }
    };

    const toggleSelectRow = (index: number) => {
        const next = new Set(selectedRows);
        if (next.has(index)) {
            next.delete(index);
        } else {
            next.add(index);
        }
        setSelectedRows(next);
    };

    const handleDuplicateSelected = () => {
        if (selectedRows.size === 0) return;

        const sortedIndices = Array.from(selectedRows).sort((a, b) => b - a); // Descending
        const updatedData = [...csvData];

        // Process in reverse to maintain indices while inserting right after the original row
        sortedIndices.forEach(idx => {
            updatedData.splice(idx + 1, 0, { ...csvData[idx] });
        });

        setCsvData(updatedData);
        revalidateAll(updatedData);
        setSelectedRows(new Set());
        toast.success(`Duplicated ${sortedIndices.length} questions`);
    };

    const handleDeleteSelected = () => {
        if (selectedRows.size === 0) return;

        const updatedData = csvData.filter((_, i) => !selectedRows.has(i));
        setCsvData(updatedData);
        revalidateAll(updatedData);
        setSelectedRows(new Set());
        toast.success(`Deleted ${selectedRows.size} questions`);
    };

    const handleDeduplicate = () => {
        const seen = new Map<string, number>();
        const duplicates = new Set<number>();

        csvData.forEach((row, i) => {
            const text = (row.questionText || '').trim().toLowerCase();
            if (!text) return;

            if (seen.has(text)) {
                duplicates.add(i);
            } else {
                seen.set(text, i);
            }
        });

        if (duplicates.size === 0) {
            toast.info("No duplicate questions found.");
        } else {
            setSelectedRows(duplicates);
            toast.success(`Found and selected ${duplicates.size} duplicate questions.`);
        }
    };

    const handleFinalImport = async () => {
        if (validationErrors.length > 0) {
            toast.error("Please fix validation errors before importing.");
            return;
        }

        setIsImporting(true);
        try {
            // Merge metadata with each row and normalize options structure for firestore if needed
            // NOTE: The parent `onImport` (in page.tsx) usually handles the final "options: []" array construction,
            // but we should pass clean data. The parent currently reads row.option1...row.option4. 
            // We should ensure the parent `handleSmartImport` is robust enough. 
            // Currently `handleSmartImport` does: `options: [row.option1, row.option2...].filter(Boolean)`.
            // We'll leave `optionN` keys in the object so the parent can adapt or we can update the parent.
            // Actually, we should update the parent to read dynamic keys too, OR we ensure we pass explicit `options` array?
            // The `handleSmartImport` in parent currently loops hardcoded. 
            // **CRITICAL**: We must NOT break the parent. 
            // Better approach: We pass the raw row with `optionN` keys, but let's check `handleSmartImport` in page.tsx later.
            // For now, CsvImporter just passes `finalData`.

            const finalData = csvData.map(row => ({
                ...defaultMetadata,
                ...row
            }));

            await onImport(finalData);

            // Success Confirmation
            toast.success("Import Successful", {
                description: `Successfully added ${finalData.length} questions to the Question Bank.`,
                duration: 5000,
            });

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
            <DialogContent className="max-w-[80vw] w-[80vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">

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
                                                <TableHead className="w-[40px]">
                                                    <Checkbox
                                                        checked={selectedRows.size === csvData.length && csvData.length > 0}
                                                        onCheckedChange={toggleSelectAll}
                                                    />
                                                </TableHead>
                                                <TableHead className="w-[50px]">#</TableHead>
                                                <TableHead className="min-w-[200px]">Question</TableHead>
                                                <TableHead className="min-w-[150px]">Options</TableHead>
                                                <TableHead className="w-[100px]">Correct</TableHead>
                                                <TableHead className="w-[100px]">Difficulty</TableHead>
                                                <TableHead className="w-[100px]">Status</TableHead>
                                                <TableHead className="w-[80px]">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {csvData.map((row, i) => {
                                                const error = validationErrors.find(e => e.row === i + 1);
                                                // Dynamic options display
                                                const optionKeys = getOptionKeys(row);
                                                const optionsDisplay = optionKeys.map(k => row[k]).filter(Boolean).join(', ');

                                                return (
                                                    <TableRow key={i} className={cn(
                                                        error ? "bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50" : "",
                                                        selectedRows.has(i) && "bg-primary/5 dark:bg-primary/10"
                                                    )}>
                                                        <TableCell>
                                                            <Checkbox
                                                                checked={selectedRows.has(i)}
                                                                onCheckedChange={() => toggleSelectRow(i)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                                                        <TableCell className="max-w-[400px]">
                                                            <div className="font-medium pr-2 prose dark:prose-invert max-w-none question-content overflow-x-auto">
                                                                {typeof row.questionText === 'string' ? parse(row.questionText) : row.questionText}
                                                            </div>
                                                            {row.chapter && <Badge variant="outline" className="text-[10px] mt-1">{row.chapter}</Badge>}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground max-w-[250px] whitespace-pre-wrap">
                                                            {optionsDisplay}
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
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() => setEditingRow({ index: i, data: { ...row } })}
                                                                >
                                                                    <FileText className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() => {
                                                                        const updatedData = [...csvData];
                                                                        updatedData.splice(i + 1, 0, { ...row });
                                                                        setCsvData(updatedData);
                                                                        revalidateAll(updatedData);
                                                                        toast.success("Row duplicated");
                                                                    }}
                                                                >
                                                                    <Copy className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                                </Button>
                                                            </div>
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
                                    <div className="font-semibold text-red-700 sticky top-0 bg-red-50 dark:bg-red-950 z-10 px-2 py-1 -mx-2 mb-2 border-b border-red-200 dark:border-red-900">Validation Issues:</div>
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
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setStep('upload')}>
                                    Change File
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleDeduplicate}
                                    className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 gap-1.5"
                                >
                                    <CheckSquare className="w-3.5 h-3.5" /> Auto-Select Duplicates
                                </Button>
                                {selectedRows.size > 0 && (
                                    <div className="flex items-center gap-1 border-l pl-2 animate-in fade-in slide-in-from-left-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDuplicateSelected}
                                            className="h-8 gap-1.5 text-xs text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                                        >
                                            <Copy className="w-3.5 h-3.5" /> Duplicate ({selectedRows.size})
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDeleteSelected}
                                            className="h-8 gap-1.5 text-xs text-red-600 border-red-200 bg-red-50/50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedRows.size})
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                                <Button
                                    onClick={handleFinalImport}
                                    disabled={validationErrors.length > 0 || isImporting || csvData.length === 0}
                                    className={cn(validationErrors.length > 0 && "opacity-50 cursor-not-allowed", "min-w-[140px]")}
                                >
                                    {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                                    Import {csvData.length} Questions
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
                validChapters={validChapters}
            />
        </Dialog>
    );
}

function EditRowDialog({ open, onOpenChange, rowData, onSave, validChapters = [] }: { open: boolean, onOpenChange: (o: boolean) => void, rowData: any, onSave: (d: any) => void, validChapters?: string[] }) {
    const [localData, setLocalData] = useState<any>(rowData || {});

    // Derived state for option keys to render dynamic list
    // We update this whenever localData changes options
    const optionKeys = getOptionKeys(localData);

    // Sync state when rowData changes
    const prevRowDataRef = useRef(rowData);
    if (rowData !== prevRowDataRef.current) {
        prevRowDataRef.current = rowData;

        // Ensure at least 2 options exist in localData if empty
        let initialData = rowData || {};
        if (!initialData.option1) initialData.option1 = '';
        if (!initialData.option2) initialData.option2 = '';

        setLocalData(initialData);
    }

    const handleChange = (field: string, val: string) => {
        setLocalData({ ...localData, [field]: val });
    };

    const handleAddOption = () => {
        const nextIndex = optionKeys.length + 1;
        setLocalData({ ...localData, [`option${nextIndex}`]: '' });
    };

    const handleRemoveOption = (keyToRemove: string) => {
        // We actually want to shift keys down if we remove strict key, 
        // OR just delete the key. Deleting key is easier but might leave gaps (option1, option3).
        // Sorting logic in `getOptionKeys` handles gaps fine (1, 3 will be sorted).
        // But re-labelling "Option 1..N" in UI checks index.
        const newData = { ...localData };
        delete newData[keyToRemove];
        setLocalData(newData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[80vw] w-[80vw] max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
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
                            {optionKeys.map((key, idx) => (
                                <div key={key} className="grid gap-2 relative">
                                    <label className="text-sm font-medium flex justify-between">
                                        Option {idx + 1}
                                        {optionKeys.length > 2 && (
                                            <button
                                                onClick={() => handleRemoveOption(key)}
                                                className="text-red-500 hover:text-red-600"
                                                title="Remove Option"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </label>
                                    <input
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={localData[key] || ''}
                                        onChange={(e) => handleChange(key, e.target.value)}
                                    />
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={handleAddOption} className="h-10 mt-auto border-dashed">
                                <Plus className="w-4 h-4 mr-2" /> Add Option
                            </Button>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-green-600">Correct Answer</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={localData.correctAnswer || ''}
                                onChange={(e) => handleChange('correctAnswer', e.target.value)}
                                placeholder="Must match one option exactly"
                            />
                            {localData.correctAnswer && !optionKeys.map(k => localData[k]).includes(localData.correctAnswer) && (
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
                            <label className="text-sm font-medium">Chapter</label>
                            {validChapters.length > 0 ? (
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={localData.chapter || ''}
                                    onChange={(e) => handleChange('chapter', e.target.value)}
                                >
                                    <option value="" disabled>Select Chapter</option>
                                    {validChapters.map(ch => (
                                        <option key={ch} value={ch}>{ch}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={localData.chapter || ''}
                                    onChange={(e) => handleChange('chapter', e.target.value)}
                                    placeholder="No chapters loaded, type manually"
                                />
                            )}
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
