"use client";

import React from "react";
import { motion } from "framer-motion";
import { FaWhatsapp } from "react-icons/fa";
import { Send, Users, Sparkles, ArrowRight } from "lucide-react";

const groups = [
  {
    name: "MDCAT Group 1",
    link: "https://chat.whatsapp.com/Ll5ELlM2jSKEYpm7SA4iXN?mode=ac_t",
    members: "1000+",
    status: "Active"
  },
  {
    name: "MDCAT Group 2",
    link: "https://chat.whatsapp.com/BxkM0COhAoV9YpsxdaMfzu?mode=ac_t",
    members: "950+",
    status: "Filling Fast"
  },
  {
    name: "MDCAT Group 3",
    link: "https://chat.whatsapp.com/CoU5mXmKb9EFSwmeY9UT0C?mode=ac_t",
    members: "800+",
    status: "Active"
  },
  {
    name: "MDCAT Group 4",
    link: "https://chat.whatsapp.com/EQ0fca2YBSE1lEkKXwP0wR?mode=ac_t",
    members: "Full",
    status: "Waitlist"
  },
  {
    name: "MDCAT Group 5",
    link: "https://chat.whatsapp.com/L0tvdVnpMSd3zCZD94vtZr?mode=ac_t",
    members: "New",
    status: "Open"
  },
];

const WhatsappInviteSection = () => {
  return (
    <section id="whatsapp" className="relative py-24 overflow-hidden bg-white dark:bg-slate-950">
      {/* Ambient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-green-50 to-transparent dark:from-green-900/20 opacity-60"></div>
        <div className="absolute top-20 right-0 w-96 h-96 bg-green-100 dark:bg-green-900/20 rounded-full blur-[100px] opacity-40"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-100 dark:bg-emerald-900/20 rounded-full blur-[80px] opacity-30"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,197,94,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,197,94,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] dark:opacity-20"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100/50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 font-bold mb-6"
          >
            <FaWhatsapp className="w-5 h-5" />
            <span>Join the Community</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight"
          >
            Join Our MDCAT <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500 dark:from-green-400 dark:to-emerald-400">WhatsApp Groups</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
          >
            Get daily updates, expert guidance, peer discussions, and <span className="font-semibold text-green-600 dark:text-green-400">preparation tips</span> — all in one place, directly on WhatsApp.
          </motion.p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-center">
          {groups.map((group, index) => (
            <motion.a
              key={index}
              href={group.link}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 hover:-translate-y-1 block overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <FaWhatsapp className="w-24 h-24 rotate-12 dark:text-green-400" />
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-green-100 dark:border-green-900/50">
                  <FaWhatsapp className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">{group.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <Users className="w-3 h-3" />
                    <span>{group.members} Members</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto">
                <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${group.status === "Active" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                  group.status === "Filling Fast" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                  {group.status}
                </div>

                <div className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400 group-hover:translate-x-1 transition-transform">
                  Join Now
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </motion.a>
          ))}

          {/* Coming Soon Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center opacity-70 hover:opacity-100 transition-opacity"
          >
            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300">More Coming Soon</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Stay tuned for subject-specific groups!</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default WhatsappInviteSection;
