'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Monitor, Globe, Clock, LogOut } from 'lucide-react';
import { Session } from '@/hooks/useStudentSettings';
import { formatDistanceToNow } from 'date-fns';

interface SessionManagerProps {
    sessions: Session[];
    currentDeviceId: string;
    onRevoke: (id: string) => void;
    loading: boolean;
}

export function SessionManager({ sessions, currentDeviceId, onRevoke, loading }: SessionManagerProps) {
    const handleRevoke = (id: string) => {
        if (confirm('Are you sure you want to log out this device?')) {
            onRevoke(id);
        }
    };

    return (
        <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-500" />
                    Where you&apos;re logged in
                </CardTitle>
                <CardDescription>
                    Maximize security by logging out of devices you don&apos;t recognize.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {loading ? (
                        <p className="text-center text-slate-500 py-4">Loading active sessions...</p>
                    ) : sessions.length === 0 ? (
                        <p className="text-center text-slate-500 py-4">No active sessions found.</p>
                    ) : (
                        sessions.map(session => (
                            <div key={session.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 gap-4">
                                <div className="flex gap-4">
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-full h-fit border border-slate-100 dark:border-slate-700">
                                        {session.deviceType === 'mobile' ? <Smartphone className="w-6 h-6 text-slate-600 dark:text-slate-300" /> : <Monitor className="w-6 h-6 text-slate-600 dark:text-slate-300" />}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-slate-900 dark:text-white">
                                                {session.os} ({session.browser})
                                            </h4>
                                            {session.deviceId === currentDeviceId && (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-none shadow-none text-[10px] px-2 py-0.5">
                                                    Current Device
                                                </Badge>
                                            )}
                                            {session.isRedFlagSession && (
                                                <Badge variant="destructive" className="text-[10px] px-2 py-0.5">Red Flag</Badge>
                                            )}
                                        </div>
                                        <div className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                                            <span className="flex items-center gap-1">
                                                <Globe className="w-3 h-3" /> {session.city ? `${session.city}, ${session.country}` : session.ip}
                                            </span>
                                            <span className="flex items-center gap-1 border-l border-slate-300 dark:border-slate-700 pl-2">
                                                <Clock className="w-3 h-3" /> Active: {session.loginTime ? formatDistanceToNow(session.loginTime.toDate(), { addSuffix: true }) : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {session.deviceId !== currentDeviceId && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRevoke(session.id)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-900/50"
                                    >
                                        <LogOut className="w-4 h-4 mr-2" /> Log out
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
