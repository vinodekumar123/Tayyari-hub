"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import l1 from "/app/assets/hero.png"; // ✅ Adjust the path if needed
import Link from "next/link";

const HeroSection = () => {
  useEffect(() => {
    const counters = document.querySelectorAll(".counter");
    counters.forEach((counter) => {
      const target = Number(counter.getAttribute("data-target"));
      let current = 0;
      const increment = target / 100;

      const update = () => {
        current += increment;
        if (current < target) {
          (counter as HTMLElement).innerText = Math.floor(current).toLocaleString();
          requestAnimationFrame(update);
        } else {
          (counter as HTMLElement).innerText = target.toLocaleString();
        }
      };

      update();
    });
  }, []);

  return (
    <section className="relative bg-white overflow-hidden min-h-screen flex items-center justify-center px-4 sm:px-6 py-20">
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .float {
          animation: float 4s ease-in-out infinite;
        }
        .float-delay {
          animation: float 4s ease-in-out infinite;
          animation-delay: 3s;
        }
      `}</style>

      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
        {/* Left Content */}
        <div className="space-y-6 text-center md:text-left">
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight text-gray-900">
            Prepare with Confidence
            <br />
            <span className="text-blue-600">Crack Your Entry Test</span>
          </h1>
          <p className="text-lg text-gray-600">
            Join thousands of students mastering MDCAT, LAT, ECAT, and NTS through intelligent test systems and performance tracking.
          </p>
          <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-4">
            <Link
              href="/auth/login"
                          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl shadow-md hover:bg-blue-700 transition"
            >
              Start Prepration
            </Link>

            <a
              href="#"
              className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-100 transition"
            >
              View Courses
            </a>
          </div>
        </div>

        {/* Right Image with Floating Stats */}
        <div className="relative flex justify-center items-center w-full mt-10 md:mt-0">
          {/* Dashed Blue Circle */}
          <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full border-4 border-pink-300 border-dashed z-0"></div>
     {/* Foreground Image */}
          <Image
            src={l1}
            alt="Student"
            width={400}
            height={400}
            className="relative  object-contain"
            priority
          />
          {/* Floating Widgets */}
          <div className="absolute top-0 left-0 float">
            <div className="backdrop-blur-lg bg-white/80 px-4 py-2 rounded-xl shadow  text-2xl text-gray-800">
               <strong className="text-blue-600 text-4xl counter" data-target="75000"> 🎓 7129</strong>
              <br />
              Students Enrolled
            </div>
          </div>

          <div className="absolute bottom-4 left-0 float-delay">
            <div className="backdrop-blur-lg bg-white/80 px-4 py-2 rounded-xl shadow  text-2xl-gray-800">
               <strong className="text-blue-600 text-4xl counter" data-target="250">📚 4</strong>
              <br />
              Courses
            </div>
          </div>

          {/* <div className="absolute top-4 right-0 float-delay">
            <div className="backdrop-blur-lg bg-white/80 px-4 py-2 rounded-xl shadow text-sm text-gray-800">
              ❓ <strong className="text-blue-600 text-4xl counter" data-target="1200000">150k</strong>
              <br />
              Questions Answered
            </div>
          </div> */}

          <div className="absolute bottom-2 right-2 float">
            <div className="backdrop-blur-lg bg-white/80 px-4 py-2 rounded-xl shadow  text-2xl text-gray-800">
               <strong className="text-blue-600 text-4xl counter" data-target="3500"> 📃 13056</strong>
              <br />
              Tests Created
            </div>
          </div>

     
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
