// src/pages/HomePage.jsx
import React from "react";
import HeroSection from "../components/Home/hero";
import Navbar from "@/components/Home/navbar";
import CoursesSection from "@/components/Home/courses";
import Footer from "@/components/Home/footer";
import TestimonialSection from "@/components/Home/reviews";
import PricingSection from "@/components/Home/pricing";
import WhatsappInviteSection from "@/components/Home/whatsapp";
import DashboardShowcase from "@/components/Home/screenshot";

const HomePage = () => {
  return (
    <>
      <HeroSection />
<Navbar/>   

<CoursesSection/>
{/* <DashboardShowcase/> */}
<PricingSection/>
<WhatsappInviteSection/>
<TestimonialSection/>
<Footer/>
 </>
  );
};

export default HomePage;
