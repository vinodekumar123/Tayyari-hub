'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SecuritySettingsProps {
    onChangePassword: (current: string, newPw: string) => Promise<boolean | undefined>;
    loading: boolean;
}

export function SecuritySettings({ onChangePassword, loading }: SecuritySettingsProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSubmit = async () => {
        if (!currentPassword) return toast.error('Enter current password');
        if (!newPassword || newPassword.length < 6) return toast.error('New password must be at least 6 characters');
        if (newPassword !== confirmPassword) return toast.error('Passwords do not match');

        const success = await onChangePassword(currentPassword, newPassword);
        if (success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Change Password</h3>
            <div>
                <Label>Current password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div>
                <Label>New password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div>
                <Label>Confirm new password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <div className="pt-2">
                <Button variant="secondary" onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Updating...' : 'Change Password'}
                </Button>
            </div>
        </div>
    );
}
