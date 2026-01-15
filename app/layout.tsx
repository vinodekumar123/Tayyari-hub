// app/layout.tsx
import './globals.css'
import React from 'react';
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

import { NavigationLoader } from '@/components/ui/navigation-loader'

import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

import { GlobalAuthListener } from '@/components/global-auth-listener';

const inter = Inter({ subsets: ['latin'] });


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
          <React.Suspense fallback={null}>
            <NavigationLoader />
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
