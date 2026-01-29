"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Menu, X, ChevronDown, ArrowLeft } from "lucide-react";
import { auth, db } from "../../app/firebase";
import { ModeToggle } from "@/components/mode-toggle";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 50);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
            "university",
            "campus",
            "degree",
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

  const isHomePage = pathname === "/";

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled
        ? "bg-white/80 dark:bg-slate-950/80 backdrop-blur-md shadow-sm py-4 border-b border-transparent dark:border-slate-800"
        : "bg-transparent py-6"
        }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Back Button */}
          {!isHomePage && (
            <button
              onClick={() => router.back()}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${scrolled
                ? "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                : "text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
            >
              <ArrowLeft size={18} />
              <span className="hidden md:inline">Back</span>
            </button>
          )}

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className={`text-2xl font-black tracking-tighter ${scrolled ? 'text-blue-600 dark:text-blue-500' : 'text-slate-900 dark:text-white'}`}>
              TayyariHub
            </div>
          </Link>
        </div>

        {/* Desktop Nav */}
        <nav className={`hidden md:flex items-center gap-8 font-medium ${scrolled ? 'text-gray-700 dark:text-gray-200' : 'text-gray-700 dark:text-gray-200'}`}>
          <div className="relative group">
            <button className="flex items-center gap-1 hover:text-blue-500 dark:hover:text-blue-400 transition">
              Series <ChevronDown size={14} />
            </button>
            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left overflow-hidden">
              <Link href="/series/fresher" className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium">
                Fresher Series
              </Link>
              <Link href="/series/improver" className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium">
                Improver Series
              </Link>
            </div>
          </div>
          <a href="#courses" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Courses
          </a>
          <a href="#features" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Features
          </a>
          <a href="#schedule" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Schedule
          </a>
          <a href="#reviews" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Reviews
          </a>
          <a href="#pricing" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Pricing
          </a>
          <Link href="/about" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            About Us
          </Link>
          <Link href="/contact" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Contact Us
          </Link>

          <div className="flex items-center gap-4 ml-2">
            <ModeToggle />
            <button
              onClick={handleLoginClick}
              suppressHydrationWarning
              className={`px-6 py-2.5 rounded-full font-bold transition-all ${scrolled
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md dark:bg-blue-600 dark:hover:bg-blue-500"
                : "bg-white text-gray-900 hover:bg-gray-100"
                }`}
            >
              Sign In
            </button>
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden">
          <ModeToggle />
          <button
            className={`${scrolled ? 'text-gray-700 dark:text-gray-200' : 'text-gray-900 dark:text-white'}`}
            onClick={toggleMenu}
            suppressHydrationWarning
          >
            {mobileOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg shadow-xl border-t dark:border-slate-800 px-6 py-6 space-y-4 text-gray-800 dark:text-gray-200 font-medium flex flex-col items-center animate-fade-in-down">
          <div className="w-full border-b border-gray-100 dark:border-gray-800 pb-2 mb-2 space-y-2 flex flex-col items-center">
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Series</span>
            <Link href="/series/fresher" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
              Fresher Series
            </Link>
            <Link href="/series/improver" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
              Improver Series
            </Link>
          </div>
          <a href="#courses" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
            Courses
          </a>
          <a href="#features" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
            Features
          </a>
          <a href="#schedule" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
            Schedule
          </a>
          <a href="#pricing" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
            Pricing
          </a>
          <Link href="/about" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
            About Us
          </Link>
          <Link href="/contact" onClick={toggleMenu} className="block hover:text-blue-600 dark:hover:text-blue-400 text-lg">
            Contact Us
          </Link>
          <button
            onClick={() => {
              toggleMenu();
              handleLoginClick();
            }}
            className="block w-full max-w-xs px-4 py-3 text-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold"
          >
            Sign In
          </button>
        </div>
      )}
    </header>
  );
};

export default Navbar;
