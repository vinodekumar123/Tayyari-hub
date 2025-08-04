'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRightCircle } from 'lucide-react';
import { auth, db } from "@/app/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function PricingPage() {
  const [price] = useState(1500);
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
          <h1 className="text-3xl font-bold mb-4 text-center">🎓 Upgrade to Premium</h1>
          <p className="text-center text-gray-600 mb-6">Unlock unlimited quizzes and premium content.</p>

          <div className="flex items-center gap-2 mb-4 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>Unlimited Quiz Access</span>
          </div>
         

          <div className="my-6 text-center">
            <p className="text-lg font-semibold">💰 One-Time Price: <span className="text-blue-600">PKR {price}</span></p>
          </div>

          <div className="mt-6 text-left">
            <p className="font-semibold text-gray-800">📥 To Subscribe:</p>
            <ul className="list-disc pl-5 text-gray-700 mt-2 space-y-1">
              <li>Send <strong>PKR {price}</strong> to the following number:</li>
              <li><strong>JazzCash & Easypaisa:</strong>0328 2419375
              <li><strong>Account Holder:</strong> Naveed</li> </li>
              <li className="mt-2">📸 Send payment screenshot to the following whatsapp number.</li>
              <li>📞 For support or confirmation:+923237507673</li>
            </ul>
          </div>

        

          <div className="mt-6">
            <Button
              onClick={handleUpgrade}
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-lg font-semibold rounded-xl"
            >
              <ArrowRightCircle className="w-5 h-5 mr-2" />
              Submit & Upgrade
            </Button>
            {status && <p className="text-sm mt-4 text-center text-blue-600">{status}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
