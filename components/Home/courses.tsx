"use client";

import React from "react";
import { GraduationCap, ShieldCheck, FileText, Terminal } from "lucide-react";

const courses = [
  {
    title: "MDCAT",
    subtitle: "Medical College Admission Test",
    bg: "bg-blue-600",
    icon: <GraduationCap className="w-8 h-8 text-white" />,
  },
  {
    title: "ECAT",
    subtitle: "Engineering College Admission Test",
    bg: "bg-green-600",
    icon: <Terminal className="w-8 h-8 text-white" />,
  },
  {
    title: "LAT",
    subtitle: "Law Admission Test",
    bg: "bg-yellow-500",
    icon: <FileText className="w-8 h-8 text-white" />,
  },
  {
    title: "NTS",
    subtitle: "National Testing Service",
    bg: "bg-purple-600",
    icon: <ShieldCheck className="w-8 h-8 text-white" />,
  },
];

const CoursesSection = () => {
  return (
    <section id="courses" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl font-extrabold text-gray-900 text-center mb-16">
          Explore Our Core Courses
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {courses.map((course, index) => (
            <div
              key={index}
              className={`p-8 rounded-2xl shadow-lg hover:shadow-2xl transform hover:-translate-y-1 transition duration-300 ease-in-out text-white ${course.bg}`}
            >
              <div className="mb-6">{course.icon}</div>
              <h3 className="text-2xl font-bold mb-2">{course.title}</h3>
              <p className="text-md font-medium">{course.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoursesSection;
