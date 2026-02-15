'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UnifiedHeader } from '@/components/unified-header';
import { Shield } from 'lucide-react';

import { useStudentSettings } from '@/hooks/useStudentSettings';
import { SessionManager } from '@/components/settings/SessionManager';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { EnrollmentList } from '@/components/settings/EnrollmentList';

export default function StudentSettingsPage() {
    const {
        loading,
        sessions, currentDeviceId, revokeSession,
        profile, setProfile, savingProfile, updateProfileData,
        pwLoading, changePassword,
        enrollments,
    } = useStudentSettings();

    return (
        <div className="bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100">
            {/* Unified Header */}
            <UnifiedHeader
                title="Account & Security"
                subtitle="Manage your account settings and active sessions."
                icon={<Shield className="w-6 h-6" />}
            />

            <div className="p-6 space-y-8">

                <Tabs defaultValue="sessions" className="max-w-4xl">
                    <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:w-[400px] h-auto">
                        <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
                        <TabsTrigger value="profile">Profile Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="sessions" className="space-y-6 mt-6">
                        <SessionManager
                            sessions={sessions}
                            currentDeviceId={currentDeviceId}
                            onRevoke={revokeSession}
                            loading={loading}
                        />
                    </TabsContent>

                    <TabsContent value="profile" className="mt-6">
                        <Card className="dark:bg-slate-900 dark:border-slate-800">
                            <CardHeader>
                                <CardTitle>Profile Settings</CardTitle>
                                <CardDescription>Update your personal information and password.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                                    {/* Left Column: Profile */}
                                    <ProfileSettings
                                        profile={profile}
                                        setProfile={setProfile}
                                        onSave={updateProfileData}
                                        saving={savingProfile}
                                    />

                                    {/* Right Column: Password */}
                                    <SecuritySettings
                                        onChangePassword={changePassword}
                                        loading={pwLoading}
                                    />

                                </div>

                                {/* Enrollments Section */}
                                <EnrollmentList enrollments={enrollments} />

                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
