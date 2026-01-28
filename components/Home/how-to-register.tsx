'use client';

import React from 'react';
import { section } from 'framer-motion/client';

export default function HowToRegister() {
    return (
        <section id="register" className="py-20 px-4 bg-white dark:bg-slate-950">
            <div className="max-w-4xl mx-auto text-center mb-16">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Registration & Payment</h2>
                <p className="text-slate-600 dark:text-slate-400">Scan the QR code to pay and complete your registration.</p>
            </div>

            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* QR Code Card */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center text-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 max-w-[300px] w-full aspect-square relative">
                        {/* Using standard img tag for simplicity */}
                        <img src="/payment-qr.png" alt="Payment QR Code" className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
                    </div>
                    <h4 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Scan to Pay</h4>
                    <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800">
                        <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Till ID: 981571591</p>
                    </div>
                </div>

                {/* How to Register Steps */}
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">1</div>
                        <div>
                            <h4 className="font-bold text-lg text-slate-900 dark:text-white">Calculate Your Fee</h4>
                            <p className="text-slate-600 dark:text-slate-400 sm">Check the pricing above. For bundles, pay the discounted amount.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">2</div>
                        <div>
                            <h4 className="font-bold text-lg text-slate-900 dark:text-white">Make Payment</h4>
                            <p className="text-slate-600 dark:text-slate-400 sm">Scan the QR code or use Till ID <strong>981571591</strong> via EasyPaisa/JazzCash/Bank App.</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold flex-shrink-0">3</div>
                        <div>
                            <h4 className="font-bold text-lg text-slate-900 dark:text-white">Send Proof</h4>
                            <p className="text-slate-600 dark:text-slate-400 sm">WhatsApp the screenshot + Your Name + Series Name to <strong>0323 7507673</strong>.</p>
                        </div>
                    </div>
                    <div className="pt-6">
                        <a href="https://wa.me/923237507673" target="_blank" className="block w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-center rounded-xl transition-all shadow-lg hover:shadow-green-500/30">
                            WhatsApp Verification
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
