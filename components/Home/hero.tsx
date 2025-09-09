"use client";

import React, { useState, useEffect } from 'react';
import { Trophy, Users, BarChart3, Globe, ArrowRight, Sparkles, Zap, Star } from 'lucide-react';

const TayyariHubHero = () => {
  const [currentText, setCurrentText] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const texts = [
    'Your Mock Test Partner',
    'Your FLP Partner', 
    'MDCAT 2025 Preparation'
  ];

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const currentFullText = texts[currentText];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentFullText.length) {
          setDisplayText(currentFullText.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setCurrentText((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentText, texts]);

  const highlights = [
    { 
      icon: Zap, 
      text: "22 MOCKS + FLPs", 
      subtext: "Just ₹1500",
      color: "from-amber-400 via-orange-400 to-red-400",
      bgColor: "from-amber-50 to-orange-50"
    },
    { 
      icon: Users, 
      text: "Premium Groups", 
      subtext: "Expert Guidance",
      color: "from-rose-400 via-pink-400 to-purple-400",
      bgColor: "from-rose-50 to-pink-50"
    },
    { 
      icon: Globe, 
      text: "Student Portal", 
      subtext: "24/7 Access",
      color: "from-blue-400 via-cyan-400 to-teal-400",
      bgColor: "from-blue-50 to-cyan-50"
    },
    { 
      icon: BarChart3, 
      text: "Test Analytics", 
      subtext: "AI Insights",
      color: "from-emerald-400 via-green-400 to-lime-400",
      bgColor: "from-emerald-50 to-green-50"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0">
        {/* Animated Mesh Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/40 via-purple-100/40 to-pink-100/40 animate-pulse [animation-duration:8s]"></div>
        
        {/* Floating Orbs */}
        <div 
          className="absolute w-96 h-96 bg-gradient-to-br from-violet-200/30 to-purple-300/30 rounded-full filter blur-3xl animate-float"
          style={{
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
            top: '10%',
            left: '70%'
          }}
        ></div>
        <div 
          className="absolute w-80 h-80 bg-gradient-to-br from-cyan-200/30 to-blue-300/30 rounded-full filter blur-3xl animate-float delay-1000"
          style={{
            transform: `translate(${mousePosition.x * -0.015}px, ${mousePosition.y * -0.015}px)`,
            bottom: '20%',
            left: '10%'
          }}
        ></div>
        <div 
          className="absolute w-64 h-64 bg-gradient-to-br from-rose-200/30 to-pink-300/30 rounded-full filter blur-3xl animate-float delay-2000"
          style={{
            transform: `translate(${mousePosition.x * 0.01}px, ${mousePosition.y * 0.01}px)`,
            top: '60%',
            right: '80%'
          }}
        ></div>
      </div>

      {/* Modern Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      
      <div className="relative min-h-screen flex items-center justify-center px-6 py-16">
        <div className={`max-w-7xl mx-auto text-center transform transition-all duration-1200 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          
          {/* Floating Status Badge */}
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-lg mb-8 transform transition-all duration-1000 delay-200 hover:scale-105 hover:shadow-xl ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-sm font-semibold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">
              MDCAT 2025 • Live Now
            </span>
          </div>

          {/* Hero Title */}
          <div className="mb-8">
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-sm">
                Tayyari Hub
              </span>
            </h1>
            
            {/* Typing Animation Container */}
            <div className="h-20 md:h-24 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-sm"></div>
              <h2 className="relative text-3xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-slate-800 via-gray-700 to-slate-800 bg-clip-text text-transparent">
                {displayText}
                <span className="animate-pulse text-indigo-600 ml-1">|</span>
              </h2>
            </div>
          </div>

          {/* Enhanced Subheading */}
          <div className={`transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <p className="text-xl md:text-2xl text-gray-600 mb-4 max-w-4xl mx-auto leading-relaxed font-medium">
              Your ultimate companion for 
              <span className="text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text font-bold"> MDCAT 2025 success</span>
            </p>
            <p className="text-lg text-gray-500 mb-16 max-w-3xl mx-auto">
              Comprehensive mock tests, focused learning programs, and AI-powered analytics
            </p>
          </div>

          {/* Premium Feature Cards */}
          <div className={`transform transition-all duration-1200 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20 max-w-7xl mx-auto">
              {highlights.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={index}
                    className="group relative bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-gray-200/50 shadow-lg hover:shadow-2xl hover:shadow-gray-200/20 transform hover:-translate-y-4 hover:scale-[1.02] transition-all duration-500 cursor-pointer overflow-hidden"
                    style={{ animationDelay: `${700 + index * 150}ms` }}
                  >
                    {/* Dynamic Background Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.bgColor} opacity-0 group-hover:opacity-60 transition-opacity duration-500 rounded-3xl`}></div>
                    
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 ease-out"></div>
                    
                    <div className="relative">
                      {/* Icon Container */}
                      <div className={`w-20 h-20 bg-gradient-to-r ${item.color} rounded-2xl flex items-center justify-center mb-6 shadow-xl group-hover:shadow-2xl group-hover:scale-110 transition-all duration-300 mx-auto`}>
                        <Icon className="w-10 h-10 text-white drop-shadow-sm" />
                      </div>
                      
                      {/* Content */}
                      <div className="text-center">
                        <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-gray-900 transition-colors duration-300">
                          {item.text}
                        </h3>
                        <p className="text-sm text-gray-500 group-hover:text-gray-600 font-medium">
                          {item.subtext}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Call-to-Action Buttons */}
          <div className={`transform transition-all duration-1200 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">

             {/* Primary CTA */}
<a
  href="/auth/login"
  className="group relative inline-flex items-center justify-center px-12 py-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold rounded-2xl overflow-hidden transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 text-xl min-w-[320px] shadow-2xl hover:shadow-indigo-500/25"
>
  <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
  <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
  <div className="relative flex items-center justify-center gap-3">
    <span>Start Your Journey</span>
    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
  </div>
</a>

              {/* Secondary CTA */}
              <button className="group relative px-12 py-6 bg-white/80 backdrop-blur-xl text-gray-800 font-bold rounded-2xl border-2 border-gray-200/50 hover:border-indigo-300 transform hover:scale-105 hover:-translate-y-1 transition-all duration-300 text-xl min-w-[320px] shadow-lg hover:shadow-2xl hover:bg-white/90">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="relative flex items-center justify-center gap-3">
                  <Trophy className="w-6 h-6 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300 text-indigo-600" />
                  <span>Explore Plans</span>
                </div>
              </button>
            </div>
          </div>

          {/* Enhanced Stats Section */}
          <div className={`transform transition-all duration-1200 delay-900 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            <div className="flex flex-wrap justify-center items-center gap-12 p-8 bg-white/50 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-lg max-w-4xl mx-auto">
              <div className="flex flex-col items-center group cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  <span className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">15k+</span>
                </div>
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Happy Students</span>
              </div>
              
              <div className="w-px h-12 bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
              
              <div className="flex flex-col items-center group cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-green-500" />
                  <span className="text-3xl md:text-4xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">98.5%</span>
                </div>
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Success Rate</span>
              </div>
              
              <div className="w-px h-12 bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
              
              <div className="flex flex-col items-center group cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  <span className="text-3xl md:text-4xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">22+</span>
                </div>
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Mock Tests</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-20 right-20 w-3 h-3 bg-gradient-to-r from-pink-400 to-rose-400 rounded-full animate-bounce delay-1000 opacity-60"></div>
      <div className="absolute top-1/3 left-16 w-2 h-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-bounce delay-2000 opacity-60"></div>
      <div className="absolute bottom-1/4 right-1/3 w-4 h-4 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full animate-bounce delay-3000 opacity-40"></div>
      
      {/* Custom Styles */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default TayyariHubHero;
