'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full">
                        <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Something went wrong</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md">
                        We encountered an unexpected error while loading this content.
                    </p>
                    {this.state.error && (
                        <pre className="text-xs text-left bg-gray-100 dark:bg-slate-800 p-4 rounded-lg overflow-auto max-w-md max-h-32 text-red-500 font-mono hidden">
                            {this.state.error.message}
                        </pre>
                    )}
                    <Button onClick={this.handleRetry} variant="outline" className="mt-2">
                        Try Again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
