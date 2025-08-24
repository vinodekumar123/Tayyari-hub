'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRightCircle, ChevronLeft, Shield, Star, Zap, Crown, Phone, MessageCircle, Copy, Check } from 'lucide-react';
import { auth, db } from "@/app/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from 'next/link';

export default function PricingPage() {
  const [price] = useState(1500);

  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpgrade = async () => {
    if (!user) {
      alert("🔐 Please login to continue.");
      return;
    }

    setIsUploading(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        plan: "premium",
        pricePaid: price,
        upgradedAt: new Date()
      });
      setStatus("✅ Plan upgraded successfully! Redirecting...");
      setTimeout(() => router.push("/dashboard/student"), 2000);
    } catch (error) {
      console.error(error);
      setStatus("❌ Failed to update plan. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };



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
    { icon: Zap, text: "22 Mock Tests Access", color: "text-yellow-500" },
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

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Left Column - Pricing Card */}
          <Card className="relative overflow-hidden shadow-2xl border-0 bg-white/80 backdrop-blur-sm h-full">
            {/* Premium Badge */}
            <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
              <Crown size={14} />
              PREMIUM
            </div>

            <CardContent className="p-8">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
                  Upgrade to Premium
                </h1>
                <p className="text-slate-600 text-lg">Unlock your learning potential with 22 Mock tests access</p>
              </div>

              {/* Price Display */}
              <div className="text-center mb-8">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
                  <p className="text-lg opacity-90 mb-2">One-Time Payment</p>
                  <div className="text-5xl font-bold mb-2">PKR {price}</div>
                  <p className="opacity-90"> Upto MDCAT-2025 Access • No Recurring Fees</p>
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
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
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
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-slate-600">Amount to Send</p>
                      <p className="font-bold text-slate-800 text-lg text-green-600">PKR {price}</p>
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
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleUpgrade}
                disabled={isUploading}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm Upgrade
                    <ArrowRightCircle className="ml-2" size={20} />
                  </>
                )}
              </Button>

              {/* Status Message */}
              {status && (
                <div className={`mt-4 p-3 rounded-lg text-center font-medium ${
                  status.includes('✅') 
                    ? 'bg-green-50 text-green-800 border border-green-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {status}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
