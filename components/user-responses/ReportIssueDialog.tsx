'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";

interface ReportIssueDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reportIssue: string;
    setReportIssue: (val: string) => void;
    onSubmit: () => void;
    isReporting: boolean;
}

export function ReportIssueDialog({
    open,
    onOpenChange,
    reportIssue,
    setReportIssue,
    onSubmit,
    isReporting
}: ReportIssueDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Flag className="w-5 h-5 text-red-500" />
                        Report an Issue
                    </DialogTitle>
                    <DialogDescription>
                        Found a mistake in this question? Let us know and we'll fix it immediately.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Textarea
                        placeholder="Describe what's wrong (e.g., wrong answer, spelling mistake...)"
                        value={reportIssue}
                        onChange={(e) => setReportIssue(e.target.value)}
                        className="min-h-[120px] resize-none"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={onSubmit}
                        disabled={!reportIssue.trim() || isReporting}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isReporting ? "Sending..." : "Submit Report"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
