"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useAnimation, useMotionValue } from "framer-motion";
import { Quote, Star, Sparkles, Trophy, Crown, CheckCircle2 } from "lucide-react";
import Image from "next/image";

const testimonials = [
  {
    name: "Younis Memon",
    city: "LUMHS",
    role: "MBBS Student",
    image: "/avatars/younis.jpg",
    quote: "Tayari Hub was very helpful during my MDCAT preparation. The MCQs are high quality, and the weakness analysis feature helped me improve my weak areas. The admins are active and respond quickly whenever guidance is needed.",
    gradient: "from-amber-400 to-yellow-600",
    stats: "Selected"
  },
  {
    name: "Pahelwan Sajnani",
    city: "LUMHS",
    role: "MBBS Student",
    image: "/avatars/pahelwan.jpg",
    quote: "I joined Tayyari Hub for MDCAT preparation, and it truly made a difference. The guidance and test system were very helpful. My concepts became strong with regular practice. This platform contributed greatly to my selection.",
    gradient: "from-blue-400 to-indigo-600",
    stats: "Selected"
  },
  {
    name: "Sadhna Valasai",
    city: "LUMHS",
    role: "MBBS Student",
    image: "/avatars/sadhna.jpg",
    quote: "Tayyari Hub is an excellent platform for exam preparation. The MCQs are high quality, the practice system is very smooth, and mock tests feel just like the real exam. Highly recommended for serious students.",
    gradient: "from-emerald-400 to-teal-600",
    stats: "Selected"
  },
  {
    name: "Vikash Jaipal",
    city: "JSMU",
    role: "MBBS Student",
    image: "/avatars/vikash.jpg",
    quote: "Tayyari Hub makes preparation easy and effective. Well-structured MCQs, realistic mock tests, and a clean interface really help boost confidence. A must-use platform for focused exam prep.",
    gradient: "from-rose-400 to-red-600",
    stats: "Selected"
  },
  {
    name: "Sonia Bnabhro",
    city: "Khairpur",
    role: "MBBS Student",
    image: "/avatars/sonia.jpg",
    quote: "I am Sonia Bhanbhro from Khairpur, a repeater, and Alhamdulillah selected for MBBS (2025–26) through IBA MDCAT. After setbacks, I gave one last attempt with full faith in Allah and succeeded. Through self-study and help from Tayyari Hub I achieved my goal.",
    gradient: "from-violet-400 to-purple-600",
    stats: "Selected"
  },
];

const ReviewCard = ({ review }: { review: typeof testimonials[0] }) => {
  return (
    <div className="w-[350px] md:w-[450px] h-full flex-shrink-0 px-4">
      <div className="relative group h-full">
        {/* Glassmorphic Background */}
        <div className="absolute inset-0 bg-white dark:bg-slate-900 md:bg-white/60 md:dark:bg-slate-900/60 md:backdrop-blur-xl rounded-[2rem] border border-slate-100 dark:border-slate-800 md:border-white/40 md:dark:border-slate-700/50 shadow-sm md:shadow-xl transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-blue-500/10 group-hover:bg-white/80 dark:group-hover:bg-slate-800/80"></div>

        {/* Gradient Glow Effect */}
        <div className={`absolute -inset-0.5 bg-gradient-to-r ${review.gradient} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500 rounded-[2rem] -z-10`}></div>

        <div className="relative p-8 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex gap-4">
              <div className="relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${review.gradient} blur-lg opacity-20 group-hover:opacity-40 transition-opacity`}></div>
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-[2px] relative z-10">
                  <div className="w-full h-full rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                    <span className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-br ${review.gradient}`}>
                      {review.name.charAt(0)}
                    </span>
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-white p-0.5 rounded-full border-2 border-white dark:border-slate-900 z-20">
                  <CheckCircle2 className="w-3 h-3" />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                  {review.name}
                  <Crown className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                </h4>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{review.city}</p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${review.gradient} bg-opacity-10 text-white text-[10px] font-bold uppercase tracking-widest shadow-sm`}>
              {review.stats}
            </div>
          </div>

          {/* Content */}
          <Quote className="w-8 h-8 text-slate-200 dark:text-slate-800 mb-2 absolute top-6 right-6 rotate-12" />

          <p className="text-slate-600 dark:text-slate-300 italic text-base leading-relaxed mb-6 flex-1 relative z-10">
            &quot;{review.quote}&quot;
          </p>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            </div>
            <span className={`text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r ${review.gradient}`}>
              Verified Legend
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const TestimonialSection = () => {
  // We duplicate the testimonials to ensure smooth infinite scrolling
  const carouselItems = [...testimonials, ...testimonials, ...testimonials];

  return (
    <section className="py-24 relative overflow-hidden bg-slate-50/50 dark:bg-slate-950/50">
      {/* Background Decorations */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-100/20 dark:bg-blue-900/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/20 dark:bg-indigo-900/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10 mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold mb-6 shadow-sm"
        >
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="tracking-wide uppercase text-xs">Hall of Fame</span>
        </motion.div>

        <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-tight">
          Legends of <br className="md:hidden" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 via-blue-500 to-indigo-500">TayyariHub</span>
        </h2>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          Transforming aspirations into achievements. See how our students shattered records.
        </p>
      </div>

      {/* Carousel Container */}
      <div className="relative w-full overflow-hidden py-10">
        {/* Gradient Masks for smooth fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-40 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent z-20 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-40 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent z-20 pointer-events-none"></div>

        <div className="flex">
          <motion.div
            className="flex items-stretch gap-4 md:gap-8"
            animate={{
              x: ["0%", "-33.33%"], // Move by one set of items
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 30, // Adjust speed (seconds)
                ease: "linear",
              },
            }}
            whileHover={{ animationPlayState: "paused" }} // Note: Framer Motion interactions handle this differently, using hover to drag or pause needs complex setup. Simple hover pause is tricky with basic 'animate' prop in CSS-like way. 
          // To achieve actual pause on hover cleanly with Motion, we usually use useAnimation controls or CSS animation. 
          // Let's stick to smooth scrolling for now, or add a simple hover style.
          // Actually, for a marquee, CSS is often smoother/easier for pause-on-hover. Let's try to mimic that or accept continuous scroll.
          >
            {/* 
                            We need enough items to fill screen + scroll. 
                            We have 3 sets of 4 items = 12 items.
                            Logic: Translate X from 0 to -(width of 1 set).
                            If we use percentage, it's relative to the CONTAINER width? No, the element width.
                            If element width is Huge, -33.33% moves it by one set (if 3 sets).
                         */}
            {carouselItems.map((review, index) => (
              <ReviewCard key={index} review={review} />
            ))}
          </motion.div>
        </div>
      </div>

      <div className="mt-8 text-center relative z-10">
        <p className="text-sm text-slate-400 font-medium">
          <Sparkles className="w-4 h-4 inline mr-1 text-yellow-500" />
          Swipe to explore success stories
        </p>
      </div>
    </section>
  );
};

export default TestimonialSection;
