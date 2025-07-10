"use client";

import React from "react";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gray-50 text-gray-700 mt-20 border-t">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">

        {/* Logo & About */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-blue-600">Tayyari Hub</h2>
          <p className="text-sm text-gray-600">
            Empowering learners to achieve success through quality content, expert instructors, and innovative tools.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Explore</h3>
          <ul className="space-y-2 text-sm">
            <li><a href="#courses" className="hover:text-blue-600">Courses</a></li>
            <li><a href="#reviews" className="hover:text-blue-600">Reviews</a></li>
            <li><a href="#pricing" className="hover:text-blue-600">Pricing</a></li>
          </ul>
        </div>

        {/* Courses */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Courses</h3>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-blue-600">MDCAT</a></li>
            <li><a href="#" className="hover:text-blue-600">ECAT</a></li>
            <li><a href="#" className="hover:text-blue-600">LAT</a></li>
            <li><a href="#" className="hover:text-blue-600">NTS</a></li>
          </ul>
        </div>

        {/* Social */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
          <div className="flex gap-4">
            <a href="#" className="hover:text-blue-600"><Facebook /></a>
            <a href="#" className="hover:text-blue-600"><Twitter /></a>
            <a href="#" className="hover:text-blue-600"><Instagram /></a>
            <a href="#" className="hover:text-blue-600"><Youtube /></a>
          </div>
        </div>
      </div>

      <div className="border-t text-center py-4 text-sm text-gray-500">
        © {new Date().getFullYear()} EduMaster. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
