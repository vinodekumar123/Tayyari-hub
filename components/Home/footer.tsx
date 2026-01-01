"use client";

import React from "react";
import { motion } from "framer-motion";
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin, ArrowRight, Heart } from "lucide-react";
import Link from "next/link";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    product: [
      { name: "MDCAT Series", href: "#" },
      { name: "Engineering (ECAT)", href: "#" },
      { name: "Logic & Reasoning", href: "#" },
      { name: "Mock Exams", href: "#" },
    ],
    company: [
      { name: "About Us", href: "#" },
      { name: "Success Stories", href: "#reviews" },
      { name: "Careers", href: "#" },
      { name: "Contact", href: "#" },
    ],
    support: [
      { name: "Help Center", href: "#" },
      { name: "Terms of Service", href: "#" },
      { name: "Privacy Policy", href: "#" },
      { name: "Cookie Policy", href: "#" },
    ]
  };

  return (
    <footer className="bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 relative overflow-hidden border-t border-slate-200 dark:border-slate-800">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-blue-100 dark:bg-blue-600/10 rounded-full blur-[100px] opacity-40 dark:opacity-100"></div>
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-indigo-100 dark:bg-purple-600/10 rounded-full blur-[100px] opacity-40 dark:opacity-100"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 mb-20">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-8">
            <Link href="/" className="inline-block group">
              <span className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                Tayyari<span className="text-blue-600 dark:text-blue-500 transition-colors duration-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">Hub</span>
                <span className="text-blue-600 dark:text-blue-500">.</span>
              </span>
            </Link>
            <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-md font-medium">
              Empowering students with intelligent tools, expert content, and a community of achievers. Your dream university is just one prep away.
            </p>
            <div className="flex gap-4 pt-4">
              <SocialIcon icon={<Facebook className="w-5 h-5" />} href="https://facebook.com/tayyarihub" color="hover:bg-[#1877F2] hover:border-[#1877F2]" />
              <SocialIcon icon={<Twitter className="w-5 h-5" />} href="#" color="hover:bg-[#1DA1F2] hover:border-[#1DA1F2]" />
              <SocialIcon icon={<Instagram className="w-5 h-5" />} href="#" color="hover:bg-[#E4405F] hover:border-[#E4405F]" />
              <SocialIcon icon={<Youtube className="w-5 h-5" />} href="#" color="hover:bg-[#FF0000] hover:border-[#FF0000]" />
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-2 md:col-span-1 pt-2">
            <h4 className="font-bold text-slate-900 dark:text-white mb-8 text-lg">Product</h4>
            <ul className="space-y-4">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="group flex items-center gap-2 text-base hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500 transition-colors"></span>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 md:col-span-1 pt-2">
            <h4 className="font-bold text-slate-900 dark:text-white mb-8 text-lg">Company</h4>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="group flex items-center gap-2 text-base hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500 transition-colors"></span>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter / Contact */}
          <div className="lg:col-span-3 pt-2">
            <h4 className="font-bold text-slate-900 dark:text-white mb-8 text-lg">Contact Us</h4>
            <div className="space-y-4 text-sm text-slate-500">
              <div className="flex items-center gap-3 group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:scale-110 transition-transform">
                  <Mail className="w-4 h-4 text-blue-500" />
                </div>
                <span>tayyarihub@medicoengineer.com</span>
              </div>
              <div className="flex items-center gap-3 group cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group-hover:scale-110 transition-transform">
                  <Phone className="w-4 h-4 text-blue-500" />
                </div>
                <span>03237507673</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-100 dark:border-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            © {currentYear} TayyariHub. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-50 dark:bg-slate-900/50 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800">
            <span>Made with</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            >
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            </motion.div>
            <span>By Medico Engineer</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

const SocialIcon = ({ icon, href, color }: { icon: React.ReactNode, href: string, color: string }) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-all duration-300 ${color} hover:text-white hover:scale-110 shadow-sm hover:shadow-lg`}
    >
      {icon}
    </a>
  );
};

export default Footer;
