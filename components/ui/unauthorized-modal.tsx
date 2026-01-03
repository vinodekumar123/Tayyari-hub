'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

interface UnauthorizedModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
}

export function UnauthorizedModal({
    isOpen,
    onClose,
    title = "Access Denied",
    message = "You are not authorized to view this page. Please contact an Administrator or Super Admin for access."
}: UnauthorizedModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                        <ShieldAlert className="h-6 w-6 text-red-600" />
                    </div>
                    <DialogTitle className="text-xl text-center text-red-900">{title}</DialogTitle>
                    <DialogDescription className="text-center text-gray-600">
                        {message}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="sm:justify-center">
                    <Button variant="destructive" onClick={onClose} className="w-full sm:w-auto">
                        Return to Safety
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
