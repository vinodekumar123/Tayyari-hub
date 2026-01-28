"use client";
import React from 'react';
import { useUIStore } from '@/stores/useUIStore';

export function LoadingOverlay() {
    const loadingStates = useUIStore((state) => state.loadingStates);
    const isLoading = Object.values(loadingStates).some((v) => v);

    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[10000]">
            <div className="w-12 h-12 border-4 border-t-4 border-blue-500 rounded-full animate-spin" />
        </div>
    );
}
