'use client';

import React from 'react';
import { ScrollReveal } from '@/components/ui/scroll-reveal';
import {
    Phone,
    Mail,
    Facebook,
    Instagram,
    Globe,
    MessageCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ContactContent() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-100 dark:selection:bg-blue-900 pt-32 pb-20">

            {/* Header */}
            <section className="px-4 mb-16 text-center">
                <ScrollReveal>
                    <Badge variant="outline" className="mb-4 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 px-4 py-1.5 text-sm rounded-full">
                        Get In Touch
                    </Badge>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                        Contact Us
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                        Have questions or need support? Reach out to us through any of the channels below.
                    </p>
                </ScrollReveal>
            </section>

            <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">

                {/* Tayyari Hub Column */}
                <ScrollReveal>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-blue-100 dark:border-blue-900/30 relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl -mr-10 -mt-10"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                                    <span className="font-bold text-xl">TH</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Tayyari Hub</h2>
                            </div>

                            <div className="space-y-6">
                                {/* WhatsApp */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <MessageCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">WhatsApp Support</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">0323 7507673</p>
                                    </div>
                                </div>

                                {/* Facebook */}
                                <a href="https://www.facebook.com/TayyariHub/" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Facebook className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Facebook Page</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">facebook.com/TayyariHub</p>
                                    </div>
                                </a>

                                {/* Instagram */}
                                <a href="https://www.instagram.com/tayyarihub/" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                                    <div className="p-2 bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Instagram className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Instagram</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">@tayyarihub</p>
                                    </div>
                                </a>

                                {/* Email */}
                                <a href="mailto:tayyarihub@medicoengineer.com" className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Email Address</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm break-all">tayyarihub@medicoengineer.com</p>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                </ScrollReveal>

                {/* Medico Engineer Column */}
                <ScrollReveal>
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-cyan-100 dark:border-cyan-900/30 relative overflow-hidden h-full">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-100 dark:bg-cyan-900/20 rounded-full blur-3xl -mr-10 -mt-10"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                                    <span className="font-bold text-xl">ME</span>
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Medico Engineer</h2>
                            </div>

                            <div className="space-y-6">
                                {/* Website */}
                                <a href="https://medicoengineer.com" target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors group">
                                    <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg group-hover:scale-110 transition-transform">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Official Website</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">medicoengineer.com</p>
                                    </div>
                                </a>

                                {/* Phone */}
                                <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors group">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Phone className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Phone Contact</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">0370 0113837</p>
                                    </div>
                                </div>

                                {/* Socials Row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <a href="https://facebook.com/medicoengineerr" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group text-center">
                                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                            <Facebook className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Facebook</span>
                                    </a>

                                    <a href="https://www.instagram.com/medico.engineer/" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-pink-50 dark:hover:bg-pink-900/10 transition-colors group text-center">
                                        <div className="p-2 bg-pink-100 dark:bg-pink-900/30 text-pink-500 rounded-lg group-hover:scale-110 transition-transform">
                                            <Instagram className="w-4 h-4" />
                                        </div>
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Instagram</span>
                                    </a>
                                </div>

                                {/* Email */}
                                <a href="mailto:contact@medicoengineer.com" className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors group">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Email Address</h3>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm">contact@medicoengineer.com</p>
                                    </div>
                                </a>

                            </div>
                        </div>
                    </div>
                </ScrollReveal>

            </div>
        </div>
    );
}
