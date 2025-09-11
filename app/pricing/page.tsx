'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, ChevronLeft, Shield, Star, Zap, Crown, Phone, MessageCircle, Copy, Check, Clock } from 'lucide-react';
import { auth, db } from "@/app/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from 'next/link';

export default function PricingPage() {
  const [originalPrice] = useState(1500);
  const [discountedPrice] = useState(750);
  const [user, setUser] = useState<any>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // Countdown timer effect
  useEffect(() => {
    const targetDate = new Date('2025-09-14T23:59:59').getTime();
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else {
        setTimeLeft('Expired');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNumber(type);
      setTimeout(() => setCopiedNumber(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const premiumFeatures = [
    { icon: Zap, text: "22 Mock  tests Access", color: "text-yellow-500" },
    { icon: Crown, text: "Premium Content Library", color: "text-purple-500" },
    { icon: Star, text: "Advanced Analytics", color: "text-blue-500" },
    { icon: Shield, text: "Priority Support", color: "text-green-500" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white/60 rounded-lg transition-all duration-200 backdrop-blur-sm border border-white/20"
          >
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform duration-200" />
            <span className="font-medium">Back</span>
          </button>
        </div>

        {/* Limited Time Offer Banner */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-red-500 via-pink-500 to-red-600 text-white p-4 rounded-2xl shadow-lg border-2 border-red-300 animate-pulse">
            <div className="flex items-center justify-center gap-3 text-center">
              <Clock className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold">🔥 LIMITED TIME OFFER - 50% OFF!</h3>
                <p className="text-sm opacity-90">Ends September 14th • Time remaining: <span className="font-mono font-bold">{timeLeft}</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Column - Pricing Card */}
          <Card className="relative overflow-hidden shadow-2xl border-0 bg-white/80 backdrop-blur-sm h-full">
            {/* Premium Badge */}
            <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
              <Crown size={14} />
              PREMIUM
            </div>

            {/* Discount Badge */}
            <div className="absolute top-4 left-4 bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-1 rounded-full text-sm font-bold">
              50% OFF
            </div>

            <CardContent className="p-8">
              {/* Header */}
              <div className="text-center mb-8 mt-4">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                  Upgrade to Premium
                </h1>
                <p className="text-slate-600 text-lg">Unlock your learning potential with 22 Mdcat Mocks access</p>
              </div>

              {/* Price Display */}
              <div className="text-center mb-8">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white relative">
                  <p className="text-lg opacity-90 mb-2">Special Discount Price</p>
                  
                  {/* Original Price (Crossed Out) */}
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="text-2xl font-bold opacity-60 line-through">
                      PKR {originalPrice}
                    </div>
                    <div className="bg-red-500 text-white px-2 py-1 rounded-md text-sm font-bold">
                      -50%
                    </div>
                  </div>
                  
                  {/* Discounted Price */}
                  <div className="text-5xl font-bold mb-2 text-yellow-300">
                    PKR {discountedPrice}
                  </div>
                  
                  <p className="opacity-90">Upto Mdcat-2025 Access • No Recurring Fees</p>
                  
                  {/* Savings highlight */}
                  <div className="mt-3 bg-white/20 rounded-lg p-2">
                    <p className="text-sm font-semibold">💰 You Save PKR {originalPrice - discountedPrice}!</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4 mb-8">
                <h3 className="font-semibold text-slate-800 text-lg">What you'll get:</h3>
                {premiumFeatures.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                    <feature.icon className={`w-5 h-5 ${feature.color}`} />
                    <span className="font-medium text-slate-700">{feature.text}</span>
                  </div>
                ))}
              </div>

              {/* Urgency Message */}
              <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-red-800 font-bold mb-1">⚡ Limited Time Only!</p>
                    <p className="text-red-700">
                      This 50% discount expires on <strong>September 14th</strong>. 
                      Don't miss this opportunity to get premium access at half price!
                    </p>
                  </div>
                </div>
              </div>

              {/* Privacy Policy Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-blue-800 font-medium mb-1">Privacy Protected</p>
                    <p className="text-blue-700">
                      <strong>Notice:</strong> Read our{' '}
                      <Link 
                        href="/privacy-policy" 
                        className="underline hover:no-underline font-semibold text-blue-600"
                      >
                        Privacy Policy
                      </Link>{' '}
                      before enrollment to understand how we protect your data.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Payment Instructions */}
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm h-full">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <MessageCircle className="text-blue-500" />
                Payment Instructions
              </h2>

              {/* Payment Methods */}
              <div className="space-y-6 mb-8">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                  <h3 className="font-bold text-green-800 mb-4 text-lg">💳 Send Payment</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                      <div>
                        <p className="text-sm text-slate-600">JazzCash & Easypaisa</p>
                        <p className="font-bold text-slate-800">0328 2419375</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard('03282419375', 'payment')}
                        className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        {copiedNumber === 'payment' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-slate-600">Account Holder</p>
                      <p className="font-bold text-slate-800">Naveed</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-red-200 bg-red-50">
                      <p className="text-sm text-slate-600">Discounted Amount to Send</p>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 text-lg text-green-600">PKR {discountedPrice}</p>
                        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full font-bold">50% OFF</span>
                      </div>
                      <p className="text-xs text-red-600 font-medium mt-1">Original: PKR {originalPrice}</p>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Support */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <h3 className="font-bold text-blue-800 mb-4 text-lg">📱 Send Screenshot</h3>
                  <div className="space-y-3">
                    <p className="text-slate-700">After payment, send your screenshot to WhatsApp:</p>
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                      <div>
                        <p className="text-sm text-slate-600">WhatsApp Support</p>
                        <p className="font-bold text-slate-800">+92 323 7507673</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard('+923237507673', 'whatsapp')}
                        className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        {copiedNumber === 'whatsapp' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Support Contact */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                  <h3 className="font-bold text-amber-800 mb-4 text-lg">📞 Need Help?</h3>
                  <div className="space-y-3">
                    <p className="text-slate-700">For any questions or support:</p>
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
                      <div>
                        <p className="text-sm text-slate-600">For support contact</p>
                        <p className="font-bold text-slate-800">03237507673</p>
                      </div>
                      <button
                        onClick={() => copyToClipboard('03237507673', 'support')}
                        className="p-2 hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        {copiedNumber === 'support' ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
