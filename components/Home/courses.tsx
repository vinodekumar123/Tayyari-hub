"use client";
import React, { useState } from "react";
import { GraduationCap, ShieldCheck, FileText, Terminal, ArrowRight, Sparkles, Zap, Star } from "lucide-react";

const courses = [
  {
    title: "MDCAT",
    subtitle: "Medical College Admission Test",
    description: "AI-powered medical entrance preparation with interactive simulations",
    stats: "95% Success Rate",
    gradient: "from-blue-500 via-blue-600 to-indigo-600",
    lightGradient: "from-blue-50 to-indigo-50",
    accentColor: "text-blue-600",
    icon: <GraduationCap className="w-7 h-7" />,
    delay: "delay-0"
  },
  {
    title: "ECAT", 
    subtitle: "Engineering College Admission Test",
    description: "Next-gen engineering prep with virtual labs and 3D modeling",
    stats: "92% Success Rate",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    lightGradient: "from-emerald-50 to-teal-50",
    accentColor: "text-emerald-600",
    icon: <Terminal className="w-7 h-7" />,
    delay: "delay-75"
  },
  {
    title: "LAT",
    subtitle: "Law Admission Test", 
    description: "Interactive case studies with real courtroom simulations",
    stats: "89% Success Rate",
    gradient: "from-orange-500 via-amber-500 to-yellow-500",
    lightGradient: "from-orange-50 to-amber-50",
    accentColor: "text-orange-600",
    icon: <FileText className="w-7 h-7" />,
    delay: "delay-150"
  },
  {
    title: "NTS",
    subtitle: "National Testing Service",
    description: "Adaptive learning with real-time performance analytics",
    stats: "94% Success Rate",
    gradient: "from-purple-500 via-violet-500 to-purple-600",
    lightGradient: "from-purple-50 to-violet-50",
    accentColor: "text-purple-600",
    icon: <ShieldCheck className="w-7 h-7" />,
    delay: "delay-225"
  },
];

const CoursesSection = () => {
  const [activeCard, setActiveCard] = useState(null);

  return (
    <section
      id="courses"
      className="relative min-h-screen flex items-center py-20 px-4 overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-slate-50"
    >
      {/* Modern Light Background Effects */}
      <div className="absolute inset-0">
        {/* Soft animated blobs */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-10 left-1/4 w-96 h-96 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-500"></div>
        </div>
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.02)_1px,transparent_1px)] bg-[size:6rem_6rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
        
        {/* Floating elements */}
        <div className="absolute top-20 left-20 w-3 h-3 bg-blue-300 rounded-full animate-bounce opacity-60"></div>
        <div className="absolute top-40 right-40 w-2 h-2 bg-indigo-400 rounded-full animate-pulse opacity-50"></div>
        <div className="absolute bottom-40 left-1/3 w-2.5 h-2.5 bg-purple-300 rounded-full animate-bounce delay-1000 opacity-40"></div>
      </div>

      <div className="relative max-w-8xl mx-auto w-full">
        {/* Ultra-modern light header */}
        <div className="text-center mb-24 space-y-8">
          <div className="inline-flex items-center gap-3 px-8 py-4 rounded-full border border-blue-200/60 bg-white/80 backdrop-blur-xl shadow-lg shadow-blue-100/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-pulse"></div>
              <Star className="w-4 h-4 text-blue-500 fill-blue-500" />
            </div>
            <span className="text-sm font-semibold text-slate-700 tracking-wide">PREMIUM LEARNING EXPERIENCE</span>
            <Zap className="w-4 h-4 text-blue-500" />
          </div>

          <div className="space-y-6">
            <h2 className="text-7xl md:text-8xl font-black tracking-tight leading-none">
              <span className="block bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent">
                DISCOVER
              </span>
              <span className="block bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 bg-clip-text text-transparent -mt-6">
                EXCELLENCE
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto font-light leading-relaxed">
              Transform your future with our revolutionary AI-powered learning ecosystem designed for academic success
            </p>
          </div>
        </div>

        {/* Modern light course grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-20">
          {courses.map((course, index) => (
            <div
              key={index}
              className={`group relative ${course.delay}`}
              onMouseEnter={() => setActiveCard(index)}
              onMouseLeave={() => setActiveCard(null)}
            >
              {/* Main card */}
              <div className={`
                relative h-96 p-8 rounded-3xl border cursor-pointer overflow-hidden
                transition-all duration-700 ease-out transform-gpu
                ${activeCard === index 
                  ? `bg-gradient-to-br ${course.gradient} shadow-2xl shadow-blue-500/20 scale-105 rotate-1 border-transparent` 
                  : 'bg-white/90 backdrop-blur-xl border-slate-200/60 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/20 hover:scale-102'
                }
              `}>
                {/* Content & effects omitted for brevity (same as your code) */}
                {/* ... */}
              </div>
            </div>
          ))}
        </div>

        {/* Modern light CTA section */}
        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-8">
            <a
              href="/pricing"
              className="group relative px-16 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-2xl font-bold text-xl text-white shadow-2xl shadow-blue-500/25 transition-all duration-300 hover:scale-105 hover:shadow-blue-500/40"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300 -z-10"></div>
              <div className="relative flex items-center gap-4">
                <Sparkles className="w-6 h-6" />
                <span>BEGIN YOUR JOURNEY</span>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CoursesSection;
