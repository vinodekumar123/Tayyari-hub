"use client";

import React, { useState, useEffect } from 'react';
import { Star, Clock, BookOpen, Users, Award, Phone, Facebook } from 'lucide-react';

const TayyariHubAnnouncement = () => {
  const [timeLeft, setTimeLeft] = useState({});
  const [currentTestIndex, setCurrentTestIndex] = useState(0);

  // Countdown timer
  useEffect(() => {
    const targetDate = new Date('2025-09-14T23:59:59');
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;
      
      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Featured tests rotation
  const featuredTests = [
    { name: "Biology XI Test 1", status: "FREE", color: "from-green-500 to-emerald-600" },
    { name: "FLP Mock 1", status: "FREE", color: "from-blue-500 to-cyan-600" },
    { name: "Whole XI Test 2", status: "FREE", color: "from-purple-500 to-indigo-600" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestIndex((prev) => (prev + 1) % featuredTests.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const testCategories = [
    {
      title: "Biology XI",
      icon: "🧪",
      tests: [
        { name: "Biology XI Test 1", status: "FREE", live: true },
        { name: "Biology XI Test 2", status: "PAID", live: true }
      ]
    },
    {
      title: "Chemistry XI", 
      icon: "⚗️",
      tests: [
        { name: "Chemistry XI Test 1", status: "PAID", live: true },
        { name: "Chemistry XI Test 2", status: "PAID", live: true }
      ]
    },
    {
      title: "Physics XI",
      icon: "📐", 
      tests: [
        { name: "Physics XI Test 1", status: "PAID", live: true },
        { name: "Physics XI Test 2", status: "PAID", live: true }
      ]
    },
    {
      title: "Whole XI Syllabus",
      icon: "📖",
      tests: [
        { name: "Whole XI Test 1", status: "PAID", live: true },
        { name: "Whole XI Test 2", status: "FREE", live: true }
      ]
    },
    {
      title: "Biology XII",
      icon: "📘",
      tests: [
        { name: "Biology XII Test 1", status: "PAID", live: true },
        { name: "Biology XII Test 2", status: "PAID", live: true }
      ]
    },
    {
      title: "Chemistry XII",
      icon: "⚗️",
      tests: [
        { name: "Chemistry XII Test 1", status: "PAID", live: true },
        { name: "Chemistry XII Test 2", status: "PAID", live: true }
      ]
    },
    {
      title: "Physics XII",
      icon: "📐",
      tests: [
        { name: "Physics XII Test 1", status: "PAID", live: true },
        { name: "Physics XII Test 2", status: "PAID", live: true }
      ]
    },
    {
      title: "Whole XII Syllabus", 
      icon: "📖",
      tests: [
        { name: "Whole XII Test 1", status: "PAID", live: true },
        { name: "Whole XII Test 2", status: "PAID", live: true }
      ]
    }
  ];

  const flpMocks = [
    { name: "FLP Mock 1", status: "FREE", date: "LIVE", color: "text-green-600" },
    { name: "FLP Mock 2", status: "PAID", date: "15 Sep, 2025", color: "text-blue-600" },
    { name: "FLP Mock 3", status: "PAID", date: "19 Sep, 2025", color: "text-purple-600" },
    { name: "FLP Mock 4", status: "PAID", date: "23 Sep, 2025", color: "text-orange-600" },
    { name: "FLP Mock 5", status: "PAID", date: "27 Sep, 2025", color: "text-pink-600" },
    { name: "FLP Mock 6", status: "PAID", date: "30 Sep, 2025", color: "text-indigo-600" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl animate-spin duration-[20s]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mt-20 text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-6 py-2 rounded-full font-bold text-lg mb-6 animate-bounce">
            📢 ANNOUNCEMENT: 50% OFF TAYYARI HUB TEST SERIES 2025 📢
          </div>
          
          <h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4 animate-pulse">
            MDCAT Test Series 2025
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Tayyari Hub, in collaboration with <span className="text-cyan-400 font-semibold">Medico Engineer</span>, proudly presents the most structured and powerful practice system for MDCAT aspirants 🚀
          </p>
        </div>

        {/* Featured Test Carousel */}
        <div className="mb-12">
          <div className="relative h-32 bg-gradient-to-r from-gray-800/50 to-gray-700/50 rounded-2xl border border-gray-600 overflow-hidden">
            <div 
              className={`absolute inset-0 bg-gradient-to-r ${featuredTests[currentTestIndex].color} opacity-90 flex items-center justify-center transition-all duration-1000`}
            >
              <div className="text-center">
                <div className="text-2xl font-bold mb-2">{featuredTests[currentTestIndex].name}</div>
                <div className="bg-white text-black px-4 py-1 rounded-full text-sm font-semibold">
                  {featuredTests[currentTestIndex].status} • LIVE NOW
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="text-center mb-12">
          <h3 className="text-2xl font-bold mb-4 text-yellow-400">⏰ Limited Time Offer Ends In:</h3>
          <div className="flex justify-center gap-4 flex-wrap">
            {Object.entries(timeLeft).map(([unit, value]) => (
              <div key={unit} className="bg-gradient-to-br from-red-500 to-pink-600 p-4 rounded-xl text-center min-w-[80px] shadow-lg transform hover:scale-105 transition-transform">
                <div className="text-2xl font-bold">{value || '0'}</div>
                <div className="text-sm capitalize">{unit}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Test Categories Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
          {testCategories.map((category, index) => (
            <div 
              key={category.title}
              className="bg-gradient-to-br from-gray-800/80 to-gray-700/80 rounded-xl p-6 border border-gray-600 hover:border-purple-500 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">{category.icon}</div>
                <h3 className="font-bold text-lg text-purple-300">{category.title}</h3>
              </div>
              <div className="space-y-2">
                {category.tests.map((test, testIndex) => (
                  <div key={testIndex} className="flex justify-between items-center bg-gray-700/50 rounded-lg p-3">
                    <span className="text-sm">{test.name}</span>
                    <div className="flex gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        test.status === 'FREE' 
                          ? 'bg-green-500 text-white' 
                          : 'bg-blue-500 text-white'
                      }`}>
                        {test.status}
                      </span>
                      {test.live && <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-500 text-white animate-pulse">LIVE</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* FLP Mocks Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            📝 Full-Length Paper (FLP) Mocks
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flpMocks.map((mock, index) => (
              <div 
                key={index}
                className="bg-gradient-to-br from-gray-800/80 to-gray-700/80 rounded-xl p-4 border border-gray-600 hover:border-yellow-500 transition-all duration-300 transform hover:scale-105"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-white">{mock.name}</h4>
                    <p className={`text-sm ${mock.color}`}>{mock.date}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    mock.status === 'FREE' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-blue-500 text-white'
                  }`}>
                    {mock.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            🌟 Exclusive Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Award className="w-6 h-6" />, title: "Advanced Student Portal", desc: "Clean, fast & reliable system" },
              { icon: <Clock className="w-6 h-6" />, title: "Attempt Anytime", desc: "Access tests anytime up to MDCAT 2025" },
              { icon: <Star className="w-6 h-6" />, title: "Instant Results", desc: "Mistake analysis & weak area identification" },
              { icon: <Users className="w-6 h-6" />, title: "Premium WhatsApp Groups", desc: "Guidance, discussion & doubt-solving" },
              { icon: <BookOpen className="w-6 h-6" />, title: "Last Days Review Notes", desc: "Specially designed for quick revision" },
              { icon: <Award className="w-6 h-6" />, title: "Real Exam Simulation", desc: "Exact MDCAT exam format preparation" }
            ].map((feature, index) => (
              <div 
                key={index}
                className="bg-gradient-to-br from-purple-800/50 to-blue-800/50 rounded-xl p-6 border border-purple-500/30 hover:border-purple-400 transition-all duration-300 transform hover:scale-105"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-purple-400">{feature.icon}</div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                </div>
                <p className="text-gray-300 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="text-center mb-12">
          <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-2xl p-8 border-2 border-yellow-400 max-w-md mx-auto transform hover:scale-105 transition-transform shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-yellow-300">🎁 Special Limited Time Offer</h2>
            <div className="space-y-4">
              <div className="text-lg">
                <span className="line-through text-gray-300">Original Fees: Rs. 1500</span>
              </div>
              <div className="text-3xl font-bold text-yellow-300">
                🔥 After Discount: Rs. 750 (50% OFF)
              </div>
              <div className="text-sm text-yellow-200">
                📅 Offer valid till: 14th September 2025
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mb-8">
          
      <a href="/auth/login" mb-10 className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-2xl text-xl transform hover:scale-105 transition-all duration-300 shadow-2xl mb-6 animate-pulse inline-block">
        👉 Register now at: TayyariHub.com
      </a>
    
          <div className="flex justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-lg">
              <Phone className="w-5 h-5 text-green-400" />
              <span>📞 +923237507673</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-lg">
              <Facebook className="w-5 h-5 text-blue-400" />
              <span>📲 Tayyari Hub</span>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center">
          <p className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            💡 Join now, practice smart, and secure your MDCAT 2025 success with Tayyari Hub! 🚀
          </p>
        </div>
      </div>
    </div>
  );
};

export default TayyariHubAnnouncement;
