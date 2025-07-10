"use client";

import React from "react";

const testimonials = [
  {
    name: "Areeba Khan",
    title: "MDCAT Student, Lahore",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    quote:
      "TayyariHub helped me clear my MDCAT with confidence. The quizzes and mock tests felt exactly like the real exam. I got admission in King Edward – couldn't be happier!",
  },
  {
    name: "Ahmed Raza",
    title: "LAT Aspirant, Islamabad",
    image: "https://randomuser.me/api/portraits/men/36.jpg",
    quote:
      "I was nervous about LAT, but the structured lessons and real-time feedback from TayyariHub made everything easier. I scored 85% and secured admission in Punjab Law College.",
  },
  {
    name: "Sana Bashir",
    title: "MDCAT Top Scorer, Karachi",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    quote:
      "Their biology section is the best I’ve seen. Detailed explanations, daily MCQs, and progress tracking helped me stay focused. Highly recommended for MDCAT aspirants!",
  },
];

const TestimonialSection = () => {
  return (
    <section id="reviews" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Student Success Stories
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto mb-12">
          Hear from students across Pakistan who achieved their goals in MDCAT and LAT through TayyariHub's trusted preparation system.
        </p>

        {/* Testimonial Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {testimonials.map((t, index) => (
            <div
              key={index}
              className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-4 mb-4">
                <img
                  src={t.image}
                  alt={t.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h4 className="font-semibold text-gray-800">{t.name}</h4>
                  <p className="text-sm text-gray-500">{t.title}</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mb-4">"{t.quote}"</p>
              <div className="text-yellow-400 text-sm">
                {"★★★★★".split("").map((s, i) => (
                  <span key={i}>★</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialSection;
