import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, BarChart3, Globe, ArrowRight, Sparkles, Zap, Star, Target, BookOpen, Award, TrendingUp } from 'lucide-react';

const TayyariHubHero = () => {
  const [currentText, setCurrentText] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef(null);
  const [particles, setParticles] = useState([]);

  const texts = [
    'Your Mock Test Partner',
    'Your FLP Partner', 
    'MDCAT 2025 Preparation'
  ];

  // Initialize floating particles
  useEffect(() => {
    const newParticles = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      speed: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.2,
      color: ['from-blue-400', 'from-purple-400', 'from-pink-400', 'from-indigo-400'][Math.floor(Math.random() * 4)]
    }));
    setParticles(newParticles);
  }, []);

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setMousePosition({ 
          x: (e.clientX - rect.left) / rect.width, 
          y: (e.clientY - rect.top) / rect.height 
        });
      }
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
    };
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
      bgColor: "from-amber-50 to-orange-50",
      shadowColor: "shadow-amber-200/50"
    },
    { 
      icon: Users, 
      text: "Premium Groups", 
      subtext: "Expert Guidance",
      color: "from-rose-400 via-pink-400 to-purple-400",
      bgColor: "from-rose-50 to-pink-50",
      shadowColor: "shadow-rose-200/50"
    },
    { 
      icon: Globe, 
      text: "Student Portal", 
      subtext: "24/7 Access",
      color: "from-blue-400 via-cyan-400 to-teal-400",
      bgColor: "from-blue-50 to-cyan-50",
      shadowColor: "shadow-blue-200/50"
    },
    { 
      icon: BarChart3, 
      text: "Test Analytics", 
      subtext: "AI Insights",
      color: "from-emerald-400 via-green-400 to-lime-400",
      bgColor: "from-emerald-50 to-green-50",
      shadowColor: "shadow-emerald-200/50"
    }
  ];

  const floatingIcons = [
    { icon: BookOpen, delay: 0, position: { top: '15%', left: '8%' } },
    { icon: Target, delay: 1000, position: { top: '25%', right: '12%' } },
    { icon: Award, delay: 2000, position: { bottom: '30%', left: '15%' } },
    { icon: TrendingUp, delay: 1500, position: { bottom: '20%', right: '8%' } },
  ];

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50 relative overflow-hidden"
      style={{
        transform: `translateY(${scrollY * 0.1}px)`,
      }}
    >
      {/* Advanced Background System */}
      <div className="absolute inset-0">
        {/* Animated Mesh Gradient */}
        <div 
          className="absolute inset-0 opacity-40"
          style={{
            background: `
              radial-gradient(circle at ${mousePosition.x * 100}% ${mousePosition.y * 100}%, 
                rgba(99, 102, 241, 0.15) 0%, 
                rgba(168, 85, 247, 0.1) 30%, 
                rgba(236, 72, 153, 0.08) 60%, 
                transparent 100%)
            `
          }}
        ></div>
        
        {/* Dynamic Orbs with Mouse Interaction */}
        <div 
          className="absolute w-[600px] h-[600px] bg-gradient-to-br from-violet-200/40 via-purple-300/30 to-fuchsia-200/40 rounded-full filter blur-3xl animate-pulse"
          style={{
            transform: `translate(${mousePosition.x * 80 - 200}px, ${mousePosition.y * 80 - 200}px) rotate(${mousePosition.x * 45}deg)`,
            top: '10%',
            left: '60%',
            animationDuration: '6s'
          }}
        ></div>
        <div 
          className="absolute w-[500px] h-[500px] bg-gradient-to-br from-cyan-200/40 via-blue-300/30 to-indigo-200/40 rounded-full filter blur-3xl animate-pulse"
          style={{
            transform: `translate(${mousePosition.x * -60 + 100}px, ${mousePosition.y * -60 + 100}px) rotate(${-mousePosition.y * 30}deg)`,
            bottom: '10%',
            left: '5%',
            animationDuration: '8s'
          }}
        ></div>
        <div 
          className="absolute w-[400px] h-[400px] bg-gradient-to-br from-emerald-200/40 via-green-300/30 to-lime-200/40 rounded-full filter blur-3xl animate-pulse"
          style={{
            transform: `translate(${mousePosition.x * 40}px, ${mousePosition.y * 40}px) scale(${1 + mousePosition.y * 0.2})`,
            top: '50%',
            right: '70%',
            animationDuration: '10s'
          }}
        ></div>

        {/* Animated Particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className={`absolute w-${Math.floor(particle.size)} h-${Math.floor(particle.size)} bg-gradient-to-r ${particle.color} to-transparent rounded-full animate-float opacity-${Math.floor(particle.opacity * 100)}`}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${particle.id * 200}ms`,
              animationDuration: `${particle.speed + 3}s`,
              transform: `translate(${mousePosition.x * 10}px, ${mousePosition.y * 10}px)`
            }}
          ></div>
        ))}
      </div>

      {/* Floating Icons */}
      {floatingIcons.map((item, index) => {
        const Icon = item.icon;
        return (
          <div
            key={index}
            className="absolute w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/30 shadow-lg animate-float opacity-60 hover:opacity-100 hover:scale-125 transition-all duration-500 cursor-pointer"
            style={{
              ...item.position,
              animationDelay: `${item.delay}ms`,
              animationDuration: '4s',
              transform: `translate(${mousePosition.x * 15}px, ${mousePosition.y * 15}px)`
            }}
          >
            <Icon className="w-8 h-8 text-indigo-600" />
          </div>
        );
      })}

      {/* Advanced Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: `translate(${mousePosition.x * -10}px, ${mousePosition.y * -10}px)`
        }}
      ></div>
      
      <div className="relative min-h-screen flex items-center justify-center px-6 py-16">
        <div className={`max-w-7xl mx-auto text-center transform transition-all duration-1500 ease-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}>
          
          {/* Enhanced Status Badge */}
          <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white/90 backdrop-blur-xl border border-gray-200/60 shadow-2xl mb-8 transform transition-all duration-1200 delay-200 hover:scale-110 hover:shadow-3xl hover:-translate-y-2 group ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <Sparkles className="w-5 h-5 text-amber-500 animate-spin [animation-duration:3s]" />
            </div>
            <span className="text-base font-bold bg-gradient-to-r from-gray-700 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              MDCAT 2025 • Live Now • 15k+ Students
            </span>
            <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full group-hover:scale-150 transition-transform duration-300"></div>
          </div>

          {/* Hero Title with Advanced Effects */}
          <div className="mb-12 relative">
            {/* Title Glow Effect */}
            <div className="absolute inset-0 text-6xl md:text-8xl lg:text-9xl font-black tracking-tight opacity-20 blur-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent scale-105">
              Tayyari Hub
            </div>
            
            <h1 className="relative text-6xl md:text-8xl lg:text-9xl font-black mb-8 tracking-tight transform hover:scale-105 transition-transform duration-500">
              <span 
                className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent drop-shadow-lg"
                style={{
                  filter: `hue-rotate(${mousePosition.x * 30}deg)`
                }}
              >
                Tayyari Hub
              </span>
            </h1>
            
            {/* Enhanced Typing Animation */}
            <div className="h-24 md:h-28 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent blur-sm animate-pulse"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-100/30 via-purple-100/30 to-pink-100/30 rounded-3xl animate-pulse [animation-duration:3s]"></div>
              <h2 className="relative text-3xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-slate-800 via-indigo-700 to-purple-700 bg-clip-text text-transparent">
                {displayText}
                <span className="animate-pulse text-indigo-600 ml-1 text-7xl">|</span>
              </h2>
              
              {/* Typing Effect Particles */}
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-1 h-1 bg-purple-400 rounded-full animate-bounce delay-200 mt-1"></div>
              </div>
            </div>
          </div>

          {/* Enhanced Subheading with Animation */}
          <div className={`transform transition-all duration-1200 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
            <div className="relative mb-6">
              <p className="text-2xl md:text-3xl text-gray-600 mb-4 max-w-4xl mx-auto leading-relaxed font-semibold">
                Your ultimate companion for 
                <span 
                  className="text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text font-black animate-pulse"
                  style={{
                    textShadow: `0 0 20px rgba(99, 102, 241, 0.3)`
                  }}
                > MDCAT 2025 success</span>
              </p>
              <p className="text-xl text-gray-500 mb-20 max-w-3xl mx-auto font-medium">
                Comprehensive mock tests, focused learning programs, and AI-powered analytics
              </p>
            </div>
          </div>

          {/* Ultra-Premium Feature Cards */}
          <div className={`transform transition-all duration-1500 delay-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24 max-w-7xl mx-auto">
              {highlights.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div 
                    key={index}
                    className={`group relative bg-white/80 backdrop-blur-2xl rounded-3xl p-10 border border-gray-200/60 shadow-xl hover:shadow-3xl ${item.shadowColor} hover:shadow-2xl transform hover:-translate-y-6 hover:scale-105 hover:rotate-1 transition-all duration-700 cursor-pointer overflow-hidden`}
                    style={{ 
                      animationDelay: `${800 + index * 200}ms`,
                      transform: `translateY(${mousePosition.y * 5}px) translateX(${mousePosition.x * 3}px)`
                    }}
                  >
                    {/* Multiple Background Layers */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.bgColor} opacity-0 group-hover:opacity-80 transition-opacity duration-700 rounded-3xl`}></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/50 via-transparent to-white/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    {/* Enhanced Shimmer Effect */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1200 ease-out skew-x-12"></div>
                    
                    {/* Floating Particles around cards */}
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-bounce transition-all duration-500"></div>
                    <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-0 group-hover:opacity-100 group-hover:animate-bounce delay-200 transition-all duration-500"></div>
                    
                    <div className="relative">
                      {/* Enhanced Icon Container */}
                      <div className={`w-24 h-24 bg-gradient-to-r ${item.color} rounded-3xl flex items-center justify-center mb-8 shadow-2xl group-hover:shadow-3xl group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 mx-auto relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-white/20 rounded-3xl animate-pulse"></div>
                        <Icon className="w-12 h-12 text-white drop-shadow-lg relative z-10" />
                      </div>
                      
                      {/* Enhanced Content */}
                      <div className="text-center relative">
                        <h3 className="text-xl font-black text-gray-800 mb-3 group-hover:text-gray-900 group-hover:scale-105 transition-all duration-300">
                          {item.text}
                        </h3>
                        <p className="text-base text-gray-500 group-hover:text-gray-600 font-semibold group-hover:scale-105 transition-all duration-300">
                          {item.subtext}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ultra-Enhanced CTA Section */}
          <div className={`transform transition-all duration-1500 delay-700 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}>
            <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-20">
              {/* Primary CTA with Multiple Effects */}
              <button className="group relative px-16 py-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-black rounded-3xl overflow-hidden transform hover:scale-110 hover:-translate-y-2 hover:rotate-1 transition-all duration-500 text-2xl min-w-[380px] shadow-2xl hover:shadow-indigo-500/30">
                {/* Multiple Background Layers */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity duration-400"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-800 via-purple-800 to-pink-800 opacity-0 group-hover:opacity-50 transition-opacity duration-600 delay-100"></div>
                
                {/* Animated Light Sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out skew-x-12"></div>
                
                {/* Pulsing Border */}
                <div className="absolute inset-0 rounded-3xl border-2 border-white/30 group-hover:border-white/60 transition-colors duration-300"></div>
                
                <div className="relative flex items-center justify-center gap-4">
                  <span className="group-hover:scale-105 transition-transform duration-300">Start Your Journey</span>
                  <div className="relative">
                    <ArrowRight className="w-8 h-8 group-hover:translate-x-3 group-hover:scale-125 transition-all duration-300" />
                    <div className="absolute inset-0 bg-white/30 rounded-full scale-0 group-hover:scale-150 transition-transform duration-500"></div>
                  </div>
                </div>
              </button>

              {/* Secondary CTA with Glass Effect */}
              <button className="group relative px-16 py-8 bg-white/90 backdrop-blur-2xl text-gray-800 font-black rounded-3xl border-2 border-gray-200/60 hover:border-indigo-300 transform hover:scale-110 hover:-translate-y-2 hover:-rotate-1 transition-all duration-500 text-2xl min-w-[380px] shadow-xl hover:shadow-2xl hover:bg-white overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-400 rounded-3xl"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-100/50 to-purple-100/50 opacity-0 group-hover:opacity-60 transition-opacity duration-600 delay-100 rounded-3xl"></div>
                
                <div className="relative flex items-center justify-center gap-4">
                  <div className="relative">
                    <Trophy className="w-8 h-8 group-hover:rotate-12 group-hover:scale-125 transition-all duration-400 text-indigo-600" />
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full scale-0 group-hover:scale-200 opacity-20 transition-all duration-500"></div>
                  </div>
                  <span className="group-hover:scale-105 transition-transform duration-300">Explore Plans</span>
                </div>
              </button>
            </div>
          </div>

          {/* Ultra-Enhanced Stats Section */}
          <div className={`transform transition-all duration-1500 delay-900 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'}`}>
            <div className="relative p-12 bg-white/70 backdrop-blur-2xl rounded-3xl border border-gray-200/60 shadow-2xl max-w-5xl mx-auto overflow-hidden">
              {/* Animated Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 via-purple-50/50 to-pink-50/50 animate-pulse [animation-duration:4s]"></div>
              
              <div className="relative flex flex-wrap justify-center items-center gap-16">
                <div className="flex flex-col items-center group cursor-pointer transform hover:scale-110 transition-all duration-400">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Star className="w-8 h-8 text-amber-500 animate-spin [animation-duration:3s]" />
                      <div className="absolute inset-0 bg-amber-300 rounded-full scale-150 opacity-30 animate-pulse"></div>
                    </div>
                    <span className="text-4xl md:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent group-hover:scale-125 transition-transform duration-400">
                      15k+
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors duration-300">Happy Students</span>
                </div>
                
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
                
                <div className="flex flex-col items-center group cursor-pointer transform hover:scale-110 transition-all duration-400">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Trophy className="w-8 h-8 text-emerald-500 animate-bounce [animation-duration:2s]" />
                      <div className="absolute inset-0 bg-emerald-300 rounded-full scale-150 opacity-30 animate-pulse delay-500"></div>
                    </div>
                    <span className="text-4xl md:text-5xl font-black bg-gradient-to-r from-emerald-600 via-green-600 to-lime-600 bg-clip-text text-transparent group-hover:scale-125 transition-transform duration-400">
                      98.5%
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors duration-300">Success Rate</span>
                </div>
                
                <div className="w-px h-16 bg-gradient-to-b from-transparent via-gray-300 to-transparent"></div>
                
                <div className="flex flex-col items-center group cursor-pointer transform hover:scale-110 transition-all duration-400">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Zap className="w-8 h-8 text-amber-500 animate-pulse [animation-duration:1.5s]" />
                      <div className="absolute inset-0 bg-amber-300 rounded-full scale-150 opacity-30 animate-pulse delay-300"></div>
                    </div>
                    <span className="text-4xl md:text-5xl font-black bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 bg-clip-text text-transparent group-hover:scale-125 transition-transform duration-400">
                      22+
                    </span>
                  </div>
                  <span className="text-lg font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors duration-300">Mock Tests</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Floating Elements */}
      <div className="absolute top-16 right-16 w-6 h-6 bg-gradient-to-r from-pink-400 to-rose-400 rounded-full animate-bounce delay-1000 opacity-70 hover:scale-150 transition-transform duration-300"></div>
      <div className="absolute top-1/3 left-12 w-4 h-4 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full animate-bounce delay-2000 opacity-70 hover:scale-150 transition-transform duration-300"></div>
      <div className="absolute bottom-1/4 right-1/4 w-8 h-8 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full animate-bounce delay-3000 opacity-50 hover:scale-150 transition-transform duration-300"></div>
      
      {/* Custom Advanced Animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-15px) rotate(2deg); }
          66% { transform: translateY(-5px) rotate(-1deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
          50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.6); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default TayyariHubHero;
