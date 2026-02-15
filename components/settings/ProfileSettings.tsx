'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/hooks/useStudentSettings';

interface ProfileSettingsProps {
    profile: UserProfile;
    setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    onSave: () => void;
    saving: boolean;
}

export function ProfileSettings({ profile, setProfile, onSave, saving }: ProfileSettingsProps) {
    return (
        <div className="space-y-4">
            <div>
                <Label>Full name</Label>
                <Input
                    value={profile.fullName}
                    onChange={(e) => setProfile(p => ({ ...p, fullName: e.target.value }))}
                />
            </div>
            <div>
                <Label>Email</Label>
                <Input value={profile.email} readOnly className="bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
                <Label>Phone</Label>
                <Input
                    value={profile.phone}
                    onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                />
            </div>
            <div>
                <Label>District / Location</Label>
                <Input
                    value={profile.district}
                    onChange={(e) => setProfile(p => ({ ...p, district: e.target.value }))}
                />
            </div>
            <div className="pt-2">
                <Button onClick={onSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Profile'}
                </Button>
            </div>
        </div>
    );
}
