import Link from 'next/link';
import { Rocket, ArrowLeft, Calendar, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ComingSoon() {
    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 text-center space-y-8 animate-in fade-in duration-700">

            {/* Icon/Illustration */}
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                <div className="relative bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-8 rounded-full shadow-2xl border border-white/20">
                    <Rocket className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-pulse" />
                </div>
            </div>

            {/* Main Text */}
            <div className="space-y-4 max-w-lg">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                    Coming <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Soon</span>
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    This Feature Is under development will be launched on 1st feb Inshallah
                </p>
            </div>

            {/* Date Badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-100 dark:border-indigo-800 font-semibold">
                <Calendar className="w-4 h-4" />
                <span>Launch Date: February 1st</span>
            </div>

            {/* Action */}
            <div className="pt-8">
                <Link href="/dashboard/student">
                    <Button variant="outline" className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </Button>
                </Link>
            </div>
        </div>
    );
}
