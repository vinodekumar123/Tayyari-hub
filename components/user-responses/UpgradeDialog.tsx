'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Award, CheckCircle } from "lucide-react";

interface UpgradeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UpgradeDialog({ open, onOpenChange }: UpgradeDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Award className="w-32 h-32 rotate-12" />
                </div>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                        <Sparkles className="w-6 h-6 text-purple-600" />
                        Premium Feature
                    </DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        Reporting mistakes and detailed content reviews are available for <span className="text-primary font-bold">Plus & Pro</span> members.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                    {[
                        "Direct access to subject experts",
                        "Priority mistake fixes within 24h",
                        "Explanation review on demand"
                    ].map((feat, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="p-1 bg-green-100 dark:bg-green-900/40 rounded-full">
                                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <span className="text-sm font-medium">{feat}</span>
                        </div>
                    ))}
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Maybe Later</Button>
                    <Button className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/20" onClick={() => window.open('/subscription', '_blank')}>
                        Upgrade Now
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
