// app/layout.tsx
import './globals.css'
import React from 'react';
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Core imports (critical path)
import { NavigationLoader } from '@/components/ui/navigation-loader';
import { LoadingOverlay } from '@/components/ui/loading-overlay';
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

// Client-only dynamic imports (ssr: false requires 'use client' boundary)
import { ClientProviders } from '@/components/ClientProviders';


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
          <ClientProviders />
          <React.Suspense fallback={null}>
            <NavigationLoader />
            <LoadingOverlay />
          </React.Suspense>
          {children}
          <Toaster />
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
