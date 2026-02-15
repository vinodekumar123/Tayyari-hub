'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Flag } from 'lucide-react';
import { Question } from '@/hooks/useQuizResult';

interface ReportIssueDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    question: Question | null;
    issue: string;
    onIssueChange: (val: string) => void;
    onSubmit: () => void;
    submitting: boolean;
}

export function ReportIssueDialog({
    open,
    onOpenChange,
    question,
    issue,
    onIssueChange,
    onSubmit,
    submitting
}: ReportIssueDialogProps) {
    if (!question) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                        <Flag className="w-5 h-5" /> Report Question Issue
                    </DialogTitle>
                    <DialogDescription>
                        Describe the issue (e.g., wrong answer, typo, formatting).
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg border border-border text-sm text-foreground/80 italic font-medium">
                        <span className="text-muted-foreground not-italic block text-xs mb-1 font-bold uppercase">Selected Question:</span>
                        &quot;{question.questionText.replace(/<[^>]+>/g, '').substring(0, 150)}{question.questionText.length > 150 ? '...' : ''}&quot;
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">Issue Description</label>
                        <Textarea
                            placeholder="Please describe the mistake or issue in detail..."
                            value={issue}
                            onChange={(e) => onIssueChange(e.target.value)}
                            className="min-h-[100px] resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={onSubmit} disabled={submitting} className="bg-destructive hover:bg-destructive/90 text-white">
                        {submitting ? 'Submitting...' : 'Submit Report'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
