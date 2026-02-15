'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import { ModeToggle } from '@/components/mode-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Sun, Moon, Coffee, Sparkles, CloudSun, Sunset, Menu, ArrowLeft } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';


import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/useUIStore';

interface UnifiedHeaderProps {
    title?: string;
    subtitle?: string;
    greeting?: boolean;
    studentName?: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
    backUrl?: string;
}

export function UnifiedHeader({
    title,
    subtitle,
    greeting = false,
    studentName,
    children,
    icon,
    className = "",
    backUrl
}: UnifiedHeaderProps) {
    const router = useRouter();
    const { user } = useUserStore();
    const { toggleSidebar } = useUIStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // specific hydration fix: only access sensitive user data after mount or use robust fallback
    const displayName = studentName || user?.fullName?.split(' ')[0] || 'Student';

    // Hide sidebar trigger when UnifiedHeader is present
    useEffect(() => {
        const { setSidebarTriggerHidden } = useUIStore.getState();
        setSidebarTriggerHidden(true);
        return () => setSidebarTriggerHidden(false);
    }, []);

    // Greeting logic (Simplified)
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <header className={`sticky top-0 z-50 w-full bg-background/95 backdrop-blur-xl border-b border-border/50 transition-all ${className}`}>
            <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">

                {/* Left Section: Context */}
                <div className="flex items-center gap-3 overflow-hidden">
                    {/* Mobile Menu Trigger */}
                    <div className="md:hidden flex-shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSidebar}
                            className="-ml-2 text-muted-foreground hover:text-foreground"
                        >
                            <Menu className="w-5 h-5" />
                        </Button>
                    </div>

                    {greeting ? (
                        <div className="flex flex-col">
                            <h1 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                                {mounted ? getGreeting() : 'Welcome'}, {displayName}
                            </h1>
                            <p className="text-xs text-muted-foreground truncate">
                                Ready to continue your learning journey?
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 overflow-hidden">
                            {backUrl && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => router.push(backUrl)}
                                    className="hidden md:flex ml-1 mr-[-8px] text-muted-foreground hover:text-foreground"
                                    aria-label="Go back"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            )}
                            {icon && (
                                <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10 text-primary hidden sm:flex items-center justify-center">
                                    <div className="w-5 h-5 flex items-center justify-center">
                                        {icon}
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col overflow-hidden">
                                {title && (
                                    <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
                                        {title}
                                    </h1>
                                )}
                                {subtitle && (
                                    <p className="text-xs text-muted-foreground truncate hidden sm:block">
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Section: Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {children && (
                        <div className="hidden md:flex items-center gap-2 mr-2">
                            {children}
                        </div>
                    )}

                    <div className="flex items-center gap-1 sm:gap-2">
                        <NotificationBell />
                        <ModeToggle />
                    </div>
                </div>
            </div>
        </header>
    );
}
