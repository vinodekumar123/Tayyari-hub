"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { Menu, X } from "lucide-react";
import app from "../../app/firebase"; // Make sure your Firebase app is initialized here

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);

  const toggleMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  // 🔐 Redirect authenticated users
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard/student");
      }
    });

    return () => unsubscribe();
  }, [auth, router]);

  return (
    <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-white/70 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="text-2xl font-bold text-blue-600">Tayyari Hub</div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8 text-gray-700 font-medium">
          <a href="#courses" className="hover:text-blue-600 transition">Courses</a>
          <a href="#reviews" className="hover:text-blue-600 transition">Reviews</a>
          <a href="#pricing" className="hover:text-blue-600 transition">Pricing</a>
          <Link href="/auth/login" className="ml-6 px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
            Sign In
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <button className="md:hidden text-gray-700" onClick={toggleMenu}>
          {mobileOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white/90 backdrop-blur-lg shadow-lg px-6 py-4 space-y-4 text-gray-800 font-medium">
          <a href="#courses" onClick={toggleMenu} className="block hover:text-blue-600">Courses</a>
          <a href="#features" onClick={toggleMenu} className="block hover:text-blue-600">Features</a>
          <a href="#reviews" onClick={toggleMenu} className="block hover:text-blue-600">Reviews</a>
          <Link
            href="/auth/login"
            className="block px-4 py-2 text-center bg-blue-600 text-white rounded-xl hover:bg-blue-700"
            onClick={toggleMenu}
          >
            Sign In
          </Link>
        </div>
      )}
    </header>
  );
};

export default Navbar;
