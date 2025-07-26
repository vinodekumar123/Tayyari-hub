"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, BadgePercent, ArrowRightCircle } from 'lucide-react';
import { auth, db } from "@/app/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function PricingPage() {
  const [price, setPrice] = useState(2000);
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [status, setStatus] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  const applyCoupon = () => {
    if (coupon.trim().toLowerCase() === 'medicoengineer50%') {
      setPrice(1000);
      setApplied(true);
    } else {
      alert("❌ Invalid coupon code");
      setApplied(false);
      setPrice(2000);
    }
  };

  const handleUpgrade = async () => {
    if (!file) {
      alert("📸 Please attach a screenshot before submitting.");
      return;
    }
    if (!user) {
      alert("🔐 Please login to continue.");
      return;
    }

    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        plan: "premium",
        pricePaid: price,
        paymentScreenshotFileName: file.name,
        upgradedAt: new Date()
      });

      setStatus("✅ Plan upgraded successfully! Redirecting...");
      setTimeout(() => router.push("/dashboard/student"), 2000);
    } catch (error) {
      console.error(error);
      setStatus("❌ Failed to update plan. Try again.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected) {
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <Card className="w-full max-w-xl p-6 shadow-xl rounded-2xl">
        <CardContent>
          <h1 className="text-3xl font-bold mb-4 text-center">🎓 Premium Quiz Access</h1>
          <p className="text-center text-gray-600 mb-6">Unlock unlimited quizzes and exclusive premium content</p>

          <div className="flex items-center gap-2 mb-4 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>Unlimited Quizzes</span>
          </div>
          <div className="flex items-center gap-2 mb-4 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>Access to Premium Quizzes</span>
          </div>

          <div className="my-6 text-center">
            <p className="text-lg font-semibold">💰 Price: <span className="text-blue-600">PKR {price}</span></p>
            <div className="flex items-center gap-2 mt-4">
              <Input
                type="text"
                placeholder="Enter coupon code"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
              />
              <Button onClick={applyCoupon} className="bg-green-500 hover:bg-green-600 text-white">
                <BadgePercent className="w-4 h-4 mr-1" /> Apply
              </Button>
            </div>
            {applied && <p className="text-green-600 mt-2">✅ Coupon applied successfully!</p>}
          </div>

          <div className="mt-6 text-left">
            <p className="font-semibold">📥 To Subscribe:</p>
            <ul className="list-disc pl-5 text-gray-700 mt-2">
              <li>Send <strong>PKR {price}</strong> to the following account:</li>
              <li><strong>Account:</strong> ×××××</li>
              <li><strong>Bank:</strong> xxxx</li>
              <li><strong>Title:</strong> xxxxx</li>
              <li className="mt-2">📸 Attach screenshot of payment below.</li>
              <li>⚠️ Fake or invalid screenshots will lead to strict action.</li>
              <li>📞 For Support: <strong>034×××××××</strong></li>
            </ul>
          </div>

          <div className="mt-6">
            <p className="font-semibold mb-2">Upload Screenshot (PDF or Image):</p>
            <Input type="file" accept=".pdf,image/*" onChange={handleFileChange} />
            {previewUrl && (
              <img src={previewUrl} alt="Preview" className="mt-4 max-h-56 rounded-lg border" />
            )}
          </div>

          <div className="mt-8 text-center">
            <Button
              onClick={handleUpgrade}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold inline-flex items-center"
            >
              Upgrade Plan <ArrowRightCircle className="ml-2 w-5 h-5" />
            </Button>
            {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
