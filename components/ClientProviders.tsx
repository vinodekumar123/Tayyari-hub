'use client';

import { useEffect, useState } from 'react';
import { GlobalAuthListener } from '@/components/global-auth-listener';
import { SplashScreen } from '@/components/ui/splash-screen';
import { GoodNewsPopup } from '@/components/ui/good-news-popup';
import { HelpChatWidget } from '@/components/HelpChatWidget';
import { GlobalSessionManager } from '@/components/GlobalSessionManager';

export function ClientProviders() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <>
            <GlobalAuthListener />
            {mounted && (
                <>
                    <SplashScreen />
                    <HelpChatWidget />
                    <GlobalSessionManager />
                    <GoodNewsPopup />
                </>
            )}
        </>
    );
}
