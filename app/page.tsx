import React from "react";
import HeroSection from "@/components/Home/hero";
import Navbar from "@/components/Home/navbar";
import CoursesSection from "@/components/Home/courses";
import Footer from "@/components/Home/footer";
import TestimonialSection from "@/components/Home/reviews";
import FeaturesBento from "@/components/Home/features-bento";
import SeriesSchedule from "@/components/Home/series-schedule";
import PricingBundles from "@/components/Home/pricing-bundles";
import WhatsappInviteSection from "@/components/Home/whatsapp";
import HeroModern from "@/components/Home/hero-modern";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

export default function Home() {
  return (
    <main className="bg-white dark:bg-gray-950 min-h-screen">
      <Navbar />
      <HeroModern />

      <ScrollReveal>
        <CoursesSection />
      </ScrollReveal>

      <ScrollReveal>
        <FeaturesBento />
      </ScrollReveal>

      <ScrollReveal>
        <SeriesSchedule />
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
