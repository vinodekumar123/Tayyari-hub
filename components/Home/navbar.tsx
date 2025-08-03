"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { Menu, X } from "lucide-react";
import { app } from "../../app/firebase";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const toggleMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLoginClick = async () => {
    const user = auth.currentUser;
    if (user) {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.admin === true) {
          router.push("/dashboard/admin");
        } else {
          const requiredFields = [
            "fullName",
            "email",
            "phone",
            "district",
           
            "course",
          ];
          const incomplete = requiredFields.some((field) => !data[field]);

          if (incomplete) {
            router.push("/auth/register");
          } else {
            router.push("/dashboard/student");
          }
        }
      } else {
        router.push("/auth/register");
      }
    } else {
      router.push("/auth/login");
    }
  };

  // Auto navigation effect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.admin === true) {
            router.push("/dashboard/admin");
          } else {
            const requiredFields = [
              "fullName",
              "email",
              "phone",
              "district",
            
              "course",
            ];
            const incomplete = requiredFields.some((field) => !data[field]);

            if (incomplete) {
              router.push("/auth/register");
            } else {
              router.push("/dashboard/student");
            }
          }
        }
        // If no user document exists, it's likely a new user—do nothing, wait for manual Sign In
      }
    });

    return () => unsubscribe();
  }, []);

 return (
  <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-md bg-white/70 shadow-sm transition-all">
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <div className="text-2xl font-bold text-blue-600">Tayyari Hub</div>

      {/* Desktop Nav */}
      <nav className="hidden md:flex items-center gap-8 text-gray-700 font-medium">
        <a href="#courses" className="hover:text-blue-600 transition">
          Courses
        </a>
        <a href="#reviews" className="hover:text-blue-600 transition">
          Reviews
        </a>
        <a href="#pricing" className="hover:text-blue-600 transition">
          Pricing
        </a>
        <button
          onClick={handleLoginClick}
          className="ml-6 px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          Sign In
        </button>
      </nav>

      {/* Mobile Menu Button (Only One Shows At A Time) */}
      <div className="md:hidden z-50">
        <button
          className="text-gray-700"
          onClick={toggleMenu}
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>
    </div>

    {/* Mobile Dropdown Menu */}
    {mobileOpen && (
      <div className="md:hidden bg-white/90 backdrop-blur-lg shadow-lg px-6 py-4 space-y-4 text-gray-800 font-medium z-40 relative">
        <a href="#courses" onClick={toggleMenu} className="block hover:text-blue-600">
          Courses
        </a>
        <a href="#features" onClick={toggleMenu} className="block hover:text-blue-600">
          Features
        </a>
        <a href="#reviews" onClick={toggleMenu} className="block hover:text-blue-600">
          Reviews
        </a>
        <button
          onClick={() => {
            toggleMenu();
            handleLoginClick();
          }}
          className="block w-full px-4 py-2 text-center bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Sign In
        </button>
      </div>
    )}
  </header>
);

};

export default Navbar;
