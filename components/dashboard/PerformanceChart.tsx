'use client';

import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Trophy } from 'lucide-react';

interface PerformanceChartProps {
    data: {
        name: string;
        score: number;
        title: string;
        type: string;
    }[];
}

export default function PerformanceChart({ data }: PerformanceChartProps) {
    if (data.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-full mb-3">
                    <Trophy className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No performance data yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
                    Complete quizzes to track your progress over time.
                </p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    dy={10}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    domain={[0, 100]}
                />
                <Tooltip
                    contentStyle={{
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.1)',
                        padding: '12px'
                    }}
                    cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4' }}
                />
                <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                    animationDuration={1500}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
