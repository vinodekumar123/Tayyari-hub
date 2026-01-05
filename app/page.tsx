import React, { Suspense } from "react";
import HeroModern from "@/components/Home/hero-modern";
import Navbar from "@/components/Home/navbar";
import Footer from "@/components/Home/footer";
import dynamic from 'next/dynamic';
import { ScrollReveal } from "@/components/ui/scroll-reveal";

// Lazy load heavy components
const CoursesSection = dynamic(() => import("@/components/Home/courses"), { ssr: true });
const FeaturesBento = dynamic(() => import("@/components/Home/features-bento"), { ssr: true });
const SeriesSchedule = dynamic(() => import("@/components/Home/series-schedule"), { ssr: true });
const PricingBundles = dynamic(() => import("@/components/Home/pricing-bundles"), { ssr: true });
const WhatsappInviteSection = dynamic(() => import("@/components/Home/whatsapp"), { ssr: true });
const TestimonialSection = dynamic(() => import("@/components/Home/reviews"), { ssr: true });

export default function Home() {
  return (
    <main className="bg-white dark:bg-gray-950 min-h-screen">
      <Navbar />
      <HeroModern />

      <ScrollReveal>
        <CoursesSection />
      </ScrollReveal>

      <ScrollReveal>
        <SeriesSchedule />
      </ScrollReveal>

      <ScrollReveal>
        <FeaturesBento />
      </ScrollReveal>

      <ScrollReveal>
        <PricingBundles />
      </ScrollReveal>

      <ScrollReveal>
        <WhatsappInviteSection />
      </ScrollReveal>

      <ScrollReveal>
        <TestimonialSection />
      </ScrollReveal>

      <Footer />
    </main>
  );
}
