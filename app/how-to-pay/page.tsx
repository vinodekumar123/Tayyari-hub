"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Smartphone, QrCode, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
// Remove or replace specific component imports if they are not needed for this standalone page, 
// or ensure they exist. Using standard Tailwind for now.

export default function HowToPayPage() {
    const steps = [
        {
            title: "Open EasyPaisa App",
            desc: "Launch the EasyPaisa app on your smartphone and sign in to your account.",
            icon: Smartphone,
        },
        {
            title: "Tap on Scan Code",
            desc: "Look for the QR Scan icon. It is usually located at the bottom center or top of the home screen.",
            icon: QrCode,
        },
        {
            title: "Scan QR Code",
            desc: "Point your camera at the TayyariHub QR code below, or select 'Scan from Gallery' if you saved the image.",
            icon: QrCode,
        },
        {
            title: "Enter Amount & Pay",
            desc: "Enter the required fee amount (e.g., Rs. 5000) and confirm the transaction details.",
            icon: CreditCard,
        },
        {
            title: "Save Screenshot",
            desc: "Once successful, take a screenshot of the payment receipt. You will need this for verification.",
            icon: CheckCircle2,
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pt-20 pb-20">
            <div className="max-w-4xl mx-auto px-4">

                {/* Back Button */}
                <div className="mb-8">
                    <Link href="/" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Home
                    </Link>
                </div>

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold text-sm mb-6">
                        <Smartphone className="w-4 h-4" />
                        <span>EasyPaisa Payment Guide</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
                        How to Pay via <span className="text-green-600 dark:text-green-500">QR Code</span>
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        Follow these simple steps to complete your registration payment using the EasyPaisa app.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

                    {/* Steps Column */}
                    <div className="space-y-8">
                        {steps.map((step, index) => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                key={index}
                                className="flex gap-4 relative"
                            >
                                {/* Connector Line */}
                                {index !== steps.length - 1 && (
                                    <div className="absolute left-6 top-14 bottom-[-20px] w-0.5 bg-slate-200 dark:bg-slate-800"></div>
                                )}

                                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white dark:bg-slate-900 border-2 border-green-100 dark:border-green-900 shadow-sm flex items-center justify-center text-green-600 dark:text-green-500 font-bold relative z-10">
                                    {index + 1}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                        {step.title}
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>
                            </motion.div>
                        ))}

                        <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800 dark:text-amber-400">
                                <strong>Note:</strong> Usually there are no extra charges for QR payments. Ensure your account has sufficient balance before paying.
                            </p>
                        </div>
                    </div>

                    {/* QR Code Column */}
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl text-center sticky top-24">
                        <div className="mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">TayyariHub Official QR</h3>
                            <p className="text-sm text-slate-500">Scan via EasyPaisa / JazzCash</p>
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 mb-6 inline-block">
                            <img src="/payment-qr.png" alt="Payment QR Code" className="w-[280px] h-[280px] object-contain mix-blend-multiply dark:mix-blend-normal" />
                        </div>

                        <div className="flex justify-center items-center gap-2 mb-6">
                            <div className="px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 text-xs font-bold">
                                EasyPaisa
                            </div>
                            <div className="px-3 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-bold">
                                JazzCash
                            </div>
                            <div className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-400 text-xs font-bold">
                                Bank Apps
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-2">Till ID</p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-widest">981571591</p>
                        </div>

                        <div className="mt-8">
                            <p className="text-xs text-slate-400 mb-2">Credit</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-500">
                                Powered by EasyPaisa
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
