// app/layout.tsx
import './globals.css'
import React from 'react';
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'



import { NavigationLoader } from '@/components/ui/navigation-loader';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { GoodNewsPopup } from "@/components/ui/good-news-popup";
import { SplashScreen } from "@/components/ui/splash-screen";

import { GlobalAuthListener } from '@/components/global-auth-listener';

import { HelpChatWidget } from '@/components/HelpChatWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'TayyariHub',
    template: '%s | TayyariHub'
  },
  description: 'Elevate your performance with TayyariHub - The ultimate entry test companion.',
  // Manifest and icons handle automatically by Next.js conventions
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TayyariHub',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  themeColor: '#2563eb',
}



export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <GlobalAuthListener />
          <SplashScreen />
          <React.Suspense fallback={null}>
            <NavigationLoader />
            <LoadingOverlay />
          </React.Suspense>
          {children}
          <Toaster />
          <HelpChatWidget />
          <GoodNewsPopup />
          {process.env.NODE_ENV === 'production' && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
        </ThemeProvider>
      </body>
    </html>
  )
}
