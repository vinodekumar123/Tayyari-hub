import React from 'react';

export default function Loading() {
    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[10000]">
            <div className="w-12 h-12 border-4 border-t-4 border-blue-500 rounded-full animate-spin" />
        </div>
    );
}
