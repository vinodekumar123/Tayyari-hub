'use client';

import { useState, useEffect } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import { ModeToggle } from '@/components/mode-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Sun, Moon, Coffee, Sparkles, CloudSun, Sunset } from 'lucide-react';
import { glassmorphism } from '@/lib/design-tokens';

interface DashboardHeaderProps {
    studentName?: string;
}

export function DashboardHeader({ studentName }: DashboardHeaderProps) {
    const { user } = useUserStore();
    const [greeting, setGreeting] = useState('');
    const [GreetingIcon, setGreetingIcon] = useState<any>(Sun);
    const [iconColor, setIconColor] = useState('text-amber-500');

    // Use prop name if available, otherwise fall back to store/auth data
    const displayName = studentName || user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Student';

    useEffect(() => {
        const updateGreeting = () => {
            const hour = new Date().getHours();

            if (hour >= 5 && hour < 12) {
                setGreeting('Good Morning');
                setGreetingIcon(CloudSun);
                setIconColor('text-amber-400'); // Soft morning sun
            } else if (hour >= 12 && hour < 17) {
                setGreeting('Good Afternoon');
                setGreetingIcon(Sun);
                setIconColor('text-orange-500'); // Bright afternoon sun
            } else if (hour >= 17 && hour < 21) {
                setGreeting('Good Evening');
                setGreetingIcon(Sunset);
                setIconColor('text-indigo-400'); // Evening hue
            } else {
                setGreeting('Good Night'); // Or Late Night Study
                setGreetingIcon(Moon); // Or Coffee for late studiers?
                setIconColor('text-purple-400');
            }
        };

        updateGreeting();
        // Update every minute just in case
        const interval = setInterval(updateGreeting, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <header className={`sticky top-0 z-30 w-full mb-8 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 ${glassmorphism.light} shadow-sm backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-500`}>
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">

                {/* Left: Greeting */}
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 ${iconColor} animate-in zoom-in duration-500`}>
                        <GreetingIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500 dark:from-purple-400 dark:to-blue-400 truncate max-w-[150px] md:max-w-none">
                                {displayName.split(' ')[0]}
                            </span>
                            <Sparkles className="w-4 h-4 text-yellow-400 hidden md:block animate-pulse" />
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                            {greeting === 'Good Morning' ? "Ready to start your day?" :
                                greeting === 'Good Afternoon' ? "Keep up the momentum!" :
                                    greeting === 'Good Evening' ? "Winding down or powering up?" : "Burning the midnight oil?"}
                        </p>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-2 pr-4 border-r border-slate-200 dark:border-slate-700">
                        <NotificationBell />
                    </div>
                    <ModeToggle />
                </div>
            </div>
        </header>
    );
}
