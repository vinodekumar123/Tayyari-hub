"use client";
import React, { useState, useEffect } from "react";

const testimonials = [
  {
    name: "Areeba Khan",
    title: "MDCAT Student, Lahore",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    quote:
      "TayyariHub helped me clear my MDCAT with confidence. The quizzes and mock tests felt exactly like the real exam. I got admission in King Edward – couldn't be happier!",
    score: "95%",
    exam: "MDCAT"
  },
  {
    name: "Ahmed Raza",
    title: "LAT Aspirant, Islamabad",
    image: "https://randomuser.me/api/portraits/men/36.jpg",
    quote:
      "I was nervous about LAT, but the structured lessons and real-time feedback from TayyariHub made everything easier. I scored 85% and secured admission in Punjab Law College.",
    score: "85%",
    exam: "LAT"
  },
  {
    name: "Sana Bashir",
    title: "MDCAT Top Scorer, Karachi",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    quote:
      "Their biology section is the best I've seen. Detailed explanations, daily MCQs, and progress tracking helped me stay focused. Highly recommended for MDCAT aspirants!",
    score: "98%",
    exam: "MDCAT"
  },
];

const TestimonialSection = () => {
  const [activeCard, setActiveCard] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section id="reviews" className="relative py-24 px-6 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-blue-25 to-blue-50">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/5 rounded-full blur-2xl animate-bounce"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header with modern typography */}
        <div className={`text-center mb-16 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-white/20 mb-6">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-blue-600">
              Success Stories
            </span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-gray-900 via-blue-800 to-blue-700 bg-clip-text text-transparent">
              Students Who
            </span>
            <br />
            <span style={{ color: 'rgb(37, 99, 235)' }}>
              Achieved Excellence
            </span>
          </h2>
          
          <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Join thousands of successful students across Pakistan who transformed their dreams into reality through our comprehensive preparation platform.
          </p>
        </div>

        {/* Modern Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={`group relative transform transition-all duration-700 hover:scale-105 cursor-pointer ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
              }`}
              style={{ transitionDelay: `${index * 200}ms` }}
              onMouseEnter={() => setActiveCard(index)}
            >
              {/* Glassmorphism Card */}
              <div className="relative bg-white/70 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 h-full">
                {/* Floating Badge */}
                <div className="absolute -top-4 -right-4 bg-blue-600 text-white px-4 py-2 rounded-2xl text-sm font-bold shadow-lg transform rotate-3 group-hover:rotate-0 transition-transform duration-300">
                  {testimonial.score}
                </div>

                {/* Profile Section */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <img
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/50 shadow-lg"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-gray-900 text-lg">{testimonial.name}</h4>
                    <p className="text-gray-600 text-sm">{testimonial.title}</p>
                    <div className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-blue-100 rounded-full">
                      <span className="text-xs font-medium text-blue-700">{testimonial.exam}</span>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <div className="relative mb-6">
                  <svg className="absolute -top-2 -left-2 w-8 h-8 text-blue-200" fill="currentColor" viewBox="0 0 32 32">
                    <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2V8zm16 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2V8z"/>
                  </svg>
                  <p className="text-gray-700 leading-relaxed pl-6 italic">
                    "{testimonial.quote}"
                  </p>
                </div>

                {/* Star Rating with Animation */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-5 h-5 transition-all duration-300 ${
                        activeCard === index 
                          ? 'text-yellow-400 scale-110' 
                          : 'text-yellow-400'
                      }`}
                      style={{ transitionDelay: `${i * 100}ms` }}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Hover Effect Overlay */}
                <div className="absolute inset-0 bg-blue-600/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className={`text-center mt-16 transform transition-all duration-1000 delay-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <a href="/pricing" className="inline-flex items-center gap-4 px-8 py-4 bg-blue-600 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer group">
            <span className="text-white font-semibold">Join Thousand+ Successful Students</span>
            <svg className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
};

export default TestimonialSection;
