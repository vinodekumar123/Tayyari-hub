"use client";

import React, { useState, useEffect } from 'react';
import { CheckCircle, Target, Users, Award, TrendingUp, BookOpen, Shield, Zap, Gift, Eye, Trophy, BarChart3 } from 'lucide-react';

const TayyariHubBenefits = () => {
  const [visibleItems, setVisibleItems] = useState(new Set());
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleItems(prev => new Set([...prev, parseInt(entry.target.dataset.index)]));
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll('.benefit-item');
    elements.forEach(el => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const benefits = [
    {
      icon: Target,
      title: "22+ Full-Length Mocks",
      description: "Simulate the real MDCAT experience with comprehensive mock tests",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: BookOpen,
      title: "Subject-wise Tests & FLPs",
      description: "Target each subject with precision and focused practice",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: Award,
      title: "MCQs by Medico Engineer",
      description: "Created by one of the top MDCAT platforms in Pakistan",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: Shield,
      title: "Affordable Price",
      description: "Premium quality preparation without breaking the bank",
      gradient: "from-orange-500 to-red-500"
    },
    {
      icon: Users,
      title: "Support & Guidance",
      description: "We're with you at every step of your MDCAT journey",
      gradient: "from-indigo-500 to-blue-500"
    },
    {
      icon: Gift,
      title: "Free Chapter-wise Tests",
      description: "Exclusively designed by Medico Engineer for comprehensive prep",
      gradient: "from-teal-500 to-green-500"
    },
    {
      icon: Zap,
      title: "Student Portal System",
      description: "Easy access to all your tests, results, and study materials",
      gradient: "from-yellow-500 to-orange-500"
    },
    {
      icon: TrendingUp,
      title: "Track Progress by Subject",
      description: "Instantly see your strengths and weaknesses in each subject",
      gradient: "from-pink-500 to-rose-500"
    },
    {
      icon: Trophy,
      title: "Rewards for Toppers",
      description: "Get recognized and rewarded in our free test competitions",
      gradient: "from-violet-500 to-purple-500"
    },
    {
      icon: Gift,
      title: "Special Discount Offers",
      description: "Save more money while you prepare for your medical career",
      gradient: "from-cyan-500 to-blue-500"
    },
    {
      icon: Eye,
      title: "Review Test Responses",
      description: "Analyze your mistakes and learn to improve faster",
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      icon: BarChart3,
      title: "See Where You Stand",
      description: "Compare your rank with other MDCAT aspirants nationwide",
      gradient: "from-red-500 to-pink-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 relative overflow-hidden" style={{backgroundColor: 'rgb(243, 248, 255)'}}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{backgroundColor: 'rgb(37, 99, 235)'}}></div>
        <div className="absolute top-40 right-10 w-96 h-96 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-pulse animation-delay-2000" style={{backgroundColor: 'rgb(37, 99, 235)'}}></div>
        <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000" style={{backgroundColor: 'rgb(37, 99, 235)'}}></div>
      </div>

      <div className="relative z-10 container mx-auto px-6 py-16">
        {/* Header Section */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 text-white px-6 py-2 rounded-full text-sm font-semibold mb-6" style={{background: `linear-gradient(135deg, rgb(37, 99, 235), rgb(59, 130, 246))`}}>
            <Target className="w-4 h-4" />
            MDCAT Excellence Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight" style={{background: `linear-gradient(135deg, rgb(37, 99, 235), rgb(30, 64, 175))`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>
            Why Join
            <span className="block" style={{background: `linear-gradient(135deg, rgb(37, 99, 235), rgb(59, 130, 246))`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent'}}>
              TayyariHub?
            </span>
          </h1>
          
          <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            Pakistan's premier MDCAT preparation platform designed specifically for medical aspirants. 
            Join thousands of successful students who chose excellence.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon;
            const isVisible = visibleItems.has(index);
            
            return (
              <div
                key={index}
                data-index={index}
                className={`benefit-item group relative bg-white/90 backdrop-blur-lg rounded-2xl p-6 hover:bg-white hover:shadow-xl transition-all duration-700 transform ${
                  isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                }`}
                style={{border: `1px solid rgba(37, 99, 235, 0.2)`}}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                {/* Gradient Border Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl blur-sm" style={{background: `linear-gradient(135deg, rgb(37, 99, 235), rgb(59, 130, 246))`}}></div>
                
                {/* Number Badge */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg" style={{background: `linear-gradient(135deg, rgb(37, 99, 235), rgb(59, 130, 246))`}}>
                  {index + 1}
                </div>
                
                {/* Icon */}
                <div className="relative mb-4 w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{background: `linear-gradient(135deg, ${benefit.gradient.includes('blue') ? 'rgb(37, 99, 235), rgb(59, 130, 246)' : benefit.gradient.includes('purple') ? 'rgb(147, 51, 234), rgb(168, 85, 247)' : benefit.gradient.includes('green') ? 'rgb(34, 197, 94), rgb(74, 222, 128)' : benefit.gradient.includes('orange') ? 'rgb(249, 115, 22), rgb(251, 146, 60)' : benefit.gradient.includes('red') ? 'rgb(239, 68, 68), rgb(248, 113, 113)' : benefit.gradient.includes('pink') ? 'rgb(236, 72, 153), rgb(244, 114, 182)' : benefit.gradient.includes('indigo') ? 'rgb(99, 102, 241), rgb(129, 140, 248)' : benefit.gradient.includes('teal') ? 'rgb(20, 184, 166), rgb(45, 212, 191)' : benefit.gradient.includes('yellow') ? 'rgb(245, 158, 11), rgb(251, 191, 36)' : benefit.gradient.includes('violet') ? 'rgb(139, 92, 246), rgb(167, 139, 250)' : benefit.gradient.includes('cyan') ? 'rgb(6, 182, 212), rgb(34, 211, 238)' : benefit.gradient.includes('emerald') ? 'rgb(16, 185, 129), rgb(52, 211, 153)' : 'rgb(37, 99, 235), rgb(59, 130, 246)'})`}}>
                  <IconComponent className="w-7 h-7 text-white" />
                </div>
                
                {/* Content */}
                <div className="relative">
                  <h3 className="text-xl font-bold mb-3 transition-colors duration-300" style={{color: 'rgb(37, 99, 235)'}}>
                    {benefit.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                    {benefit.description}
                  </p>
                </div>
                
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className={`absolute inset-0 bg-gradient-to-r ${benefit.gradient} opacity-20 rounded-2xl blur-xl`}></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Call to Action */}
        <div className="text-center mt-20">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-8 max-w-4xl mx-auto relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-white/10"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Ace Your MDCAT?
              </h2>
              <p className="text-blue-100 text-lg mb-8">
                Join 10,000+ students who are already preparing with TayyariHub
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
  href="/auth/login"
  className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold hover:bg-blue-50 transform hover:scale-105 transition-all duration-300 shadow-lg inline-block"
>
  Start Free Trial
</a>

                <a href="/pricing" className="border-2 border-white text-white px-8 py-4 rounded-xl font-bold hover:bg-white hover:text-blue-600 transform hover:scale-105 transition-all duration-300 inline-block">
                  View Pricing</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Elements */}
      <div className="absolute top-1/4 right-10 w-4 h-4 bg-blue-400 rounded-full animate-ping opacity-75"></div>
      <div className="absolute bottom-1/3 left-10 w-3 h-3 bg-cyan-400 rounded-full animate-ping opacity-75 animation-delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-sky-400 rounded-full animate-ping opacity-75 animation-delay-2000"></div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
        
        .animation-delay-1000 { animation-delay: 1s; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
};

export default TayyariHubBenefits;
