'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UnifiedHeader } from '@/components/unified-header';
import Link from 'next/link';
import {
    GraduationCap, Phone, MessageCircle, CheckCircle2,
    CreditCard, Users, BookOpen, ArrowRight, Sparkles,
    Shield, Clock, Star, AlertCircle
} from 'lucide-react';

export default function HowToRegisterPage() {
    const steps = [
        {
            step: 1,
            title: 'Choose Your Series',
            description: 'Select between Fresher Series (for beginners) or Improver Series (for advanced preparation).',
            icon: BookOpen,
            color: 'bg-blue-500',
        },
        {
            step: 2,
            title: 'Contact Admin',
            description: 'Reach out to our admin team via WhatsApp or phone to confirm your enrollment.',
            icon: MessageCircle,
            color: 'bg-green-500',
        },
        {
            step: 3,
            title: 'Complete Payment',
            description: 'Pay the series fee via bank transfer, JazzCash, EasyPaisa, or other available methods.',
            icon: CreditCard,
            color: 'bg-purple-500',
        },
        {
            step: 4,
            title: 'Get Enrolled',
            description: 'Once payment is verified, admin will enroll you and unlock all premium features!',
            icon: CheckCircle2,
            color: 'bg-emerald-500',
        },
    ];

    const benefits = [
        { icon: BookOpen, text: 'Access to all quizzes & tests' },
        { icon: Users, text: 'Community discussion access' },
        { icon: Shield, text: 'Question reporting feature' },
        { icon: Star, text: 'Premium study materials' },
        { icon: Clock, text: 'Live quiz schedule updates' },
        { icon: GraduationCap, text: 'Detailed performance analytics' },
    ];

    return (
        <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950">
            <UnifiedHeader
                greeting={false}
                subtitle="Your guide to enrolling in Tayyari Hub series"
            />

            <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-10">

                {/* Hero Section */}
                <div className="text-center space-y-4 py-6">
                    <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 px-4 py-1.5 text-sm font-medium">
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Premium Access
                    </Badge>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                        How to <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Register</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
                        Follow these simple steps to enroll in a series and unlock all premium features.
                    </p>
                </div>

                {/* Steps Section */}
                <div className="grid md:grid-cols-2 gap-6">
                    {steps.map((item) => (
                        <Card key={item.step} className="border border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all duration-300 group">
                            <CardHeader className="flex flex-row items-start gap-4">
                                <div className={`p-3 rounded-xl ${item.color} text-white shadow-lg group-hover:scale-110 transition-transform`}>
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="outline" className="text-xs font-bold">Step {item.step}</Badge>
                                    </div>
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
                                    <CardDescription className="mt-1">{item.description}</CardDescription>
                                </div>
                            </CardHeader>
                        </Card>
                    ))}
                </div>

                {/* Contact Section */}
                <Card className="border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-200/50 dark:bg-indigo-800/20 rounded-full blur-3xl -mr-20 -mt-20" />
                    <CardHeader className="text-center relative z-10">
                        <CardTitle className="text-2xl flex items-center justify-center gap-2">
                            <Phone className="w-6 h-6 text-indigo-600" />
                            Contact Admin
                        </CardTitle>
                        <CardDescription className="text-base">
                            Ready to enroll? Contact our admin team now!
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <a href="https://wa.me/923237507673" target="_blank" rel="noopener noreferrer">
                                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30 gap-2">
                                    <MessageCircle className="w-5 h-5" />
                                    WhatsApp Us
                                </Button>
                            </a>
                            <a href="tel:+923237507673">
                                <Button size="lg" variant="outline" className="border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 gap-2">
                                    <Phone className="w-5 h-5" />
                                    Call: 0323-7507673
                                </Button>
                            </a>
                        </div>
                    </CardContent>
                </Card>

                {/* Benefits Section */}
                <Card className="border border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Star className="w-5 h-5 text-amber-500" />
                            What You Get After Enrollment
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {benefits.map((benefit, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                    <benefit.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{benefit.text}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Series Info */}
                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all">
                        <CardHeader>
                            <Badge className="w-fit bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border-blue-200 dark:border-blue-800">Beginner</Badge>
                            <CardTitle className="text-xl flex items-center gap-2 mt-2">
                                🌱 Fresher Series
                            </CardTitle>
                            <CardDescription>Perfect for students starting their MDCAT preparation journey.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/series/fresher" target="_blank">
                                <Button variant="outline" className="w-full gap-2">
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    <Card className="border border-purple-200 dark:border-purple-800 hover:shadow-lg transition-all">
                        <CardHeader>
                            <Badge className="w-fit bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 border-purple-200 dark:border-purple-800">Advanced</Badge>
                            <CardTitle className="text-xl flex items-center gap-2 mt-2">
                                🚀 Improver Series
                            </CardTitle>
                            <CardDescription>For students who want to level up and achieve top scores.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Link href="/series/improver" target="_blank">
                                <Button variant="outline" className="w-full gap-2">
                                    Learn More <ArrowRight className="w-4 h-4" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </div>

                {/* FAQ Note */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-800 dark:text-amber-400">Need Help?</p>
                        <p className="text-sm text-amber-700 dark:text-amber-500">
                            If you have any questions about registration, payment, or series selection, feel free to contact our admin team anytime. We&apos;re here to help!
                        </p>
                    </div>
                </div>

                <div className="text-center text-xs text-slate-400 dark:text-slate-600 pb-8">
                    © 2026 TayyariHub. All rights reserved.
                </div>
            </div>
        </div>
    );
}
