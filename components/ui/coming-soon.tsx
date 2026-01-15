import React from 'react';
import { Construction, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ComingSoon() {
    return (
        <div className="min-h-[80vh] w-full flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-none shadow-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                        <div className="relative bg-white dark:bg-slate-800 p-4 rounded-full shadow-lg">
                            <Construction className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                            Coming Soon
                        </h2>
                        <p className="text-lg font-medium text-slate-700 dark:text-slate-300">
                            This Feature Is under development
                        </p>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold">
                        <Calendar className="w-4 h-4" />
                        <span>Launching 1st Feb Inshallah</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
