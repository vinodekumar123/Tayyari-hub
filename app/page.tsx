// src/pages/HomePage.jsx
import React from "react";
import HeroSection from "../components/Home/hero";
import Navbar from "@/components/Home/navbar";
import CoursesSection from "@/components/Home/courses";
import Footer from "@/components/Home/footer";
import TestimonialSection from "@/components/Home/reviews";
import PricingSection from "@/components/Home/pricing";

const HomePage = () => {
  return (
    <>
      <HeroSection />
<Navbar/>   

<CoursesSection/>
<PricingSection/>
<TestimonialSection/>
<Footer/>
 </>
  );
};

export default HomePage;
