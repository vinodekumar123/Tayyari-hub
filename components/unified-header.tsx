'use client';

import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { ModeToggle } from '@/components/mode-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Sun, Moon, Coffee, Sparkles, CloudSun, Sunset, Menu } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';


interface UnifiedHeaderProps {
    title?: string;
    subtitle?: string;
    greeting?: boolean;
    studentName?: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
    className?: string;
}

export function UnifiedHeader({
    title,
    subtitle,
    greeting = false,
    studentName,
    children,
    icon,
    className = ""
}: UnifiedHeaderProps) {
    const { user } = useUserStore();
    const [greetingText, setGreetingText] = useState('');
    const [GreetingIcon, setGreetingIcon] = useState<any>(Sun);
    const [iconColor, setIconColor] = useState('text-amber-500');

    // Use prop name if available, otherwise fall back to store/auth data
    const displayName = studentName || user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Student';

    useEffect(() => {
        if (!greeting) return;

        const updateGreeting = () => {
            const hour = new Date().getHours();

            if (hour >= 5 && hour < 12) {
                setGreetingText('Good Morning');
                setGreetingIcon(CloudSun);
                setIconColor('text-amber-400');
            } else if (hour >= 12 && hour < 17) {
                setGreetingText('Good Afternoon');
                setGreetingIcon(Sun);
                setIconColor('text-orange-500');
            } else if (hour >= 17 && hour < 21) {
                setGreetingText('Good Evening');
                setGreetingIcon(Sunset);
                setIconColor('text-indigo-400');
            } else {
                setGreetingText('Good Night');
                setGreetingIcon(Moon);
                setIconColor('text-purple-400');
            }
        };

        updateGreeting();
        const interval = setInterval(updateGreeting, 60000);
        return () => clearInterval(interval);
    }, [greeting]);

    return (
        <header className={`sticky top-0 z-30 w-full mb-8 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 ${glassmorphism.light} shadow-sm backdrop-blur-xl ${className}`}>
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">

                {/* Left Section: Greeting or Title */}
                <div className="flex items-center gap-3">
                    {/* Mobile Menu Trigger */}

                    {greeting ? (
                        <>
                            <div className={`p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 ${iconColor} animate-in zoom-in duration-500 hidden sm:block`}>
                                <GreetingIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    {greetingText}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500 dark:from-purple-400 dark:to-blue-400 truncate max-w-[150px] md:max-w-none">
                                        {displayName}
                                    </span>
                                    <Sparkles className="w-4 h-4 text-yellow-400 hidden md:block animate-pulse" />
                                </h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                                    {greetingText === 'Good Morning' ? "Ready to start your day?" :
                                        greetingText === 'Good Afternoon' ? "Keep up the momentum!" :
                                            greetingText === 'Good Evening' ? "Winding down or powering up?" : "Burning the midnight oil?"}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            {icon && (
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border border-indigo-100 dark:border-indigo-900/50 shadow-sm hidden sm:block">
                                    <div className="text-indigo-600 dark:text-indigo-400">
                                        {icon}
                                    </div>
                                </div>
                            )}
                            <div>
                                {title && (
                                    <h1 className="text-lg md:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-slate-200 dark:to-slate-400">
                                        {title}
                                    </h1>
                                )}
                                {subtitle && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Section: Controls */}
                <div className="flex items-center gap-3 md:gap-4">
                    {children && (
                        <div className="hidden md:flex items-center gap-2 mr-2">
                            {children}
                        </div>
                    )}

                    <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-700">
                        <NotificationBell />
                    </div>
                    <ModeToggle />
                </div>
            </div>
        </header>
    );
}
