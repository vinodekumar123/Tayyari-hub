'use client';

import PricingBundles from '@/components/Home/pricing-bundles';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import HowToRegister from '@/components/Home/how-to-register';

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Back Button Wrapper */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      {/* Main Pricing Component */}
      <PricingBundles />

      <HowToRegister />
    </div>
  );
}
