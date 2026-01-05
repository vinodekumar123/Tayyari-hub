"use client";
import React, { useState, useEffect } from "react";
import { GraduationCap, ShieldCheck, FileText, Terminal, ArrowRight, Sparkles, Zap, Star, TrendingUp, Brain, Target, Clock, Users, Trophy, ChevronRight, Activity } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue, useScroll, useTransform } from "framer-motion";

const courses = [
  {
    title: "MDCAT",
    subtitle: "Medical College Admission Test",
    description: "Prepare for your medical future with our comprehensive question bank, full-length papers, and detailed performance analytics.",
    stats: "Active",
    label: "Enroll Now",
    students: "5,000+",
    gradient: "from-cyan-500 via-blue-500 to-purple-500",
    glowColor: "rgba(6, 182, 212, 0.4)",
    icon: <GraduationCap className="w-6 h-6" />,
    features: ["20k+ MCQs", "Detailed Explanations", "Doubt Solver"],
    pattern: "medical",
    delay: 0,
    status: "active"
  },
  {
    title: "ECAT",
    subtitle: "Engineering College Admission Test",
    description: "Engineering prep platform currently in development to help you secure admission in top engineering universities (UET, NUST).",
    stats: "Soon",
    label: "Status",
    students: "Waitlist",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    glowColor: "rgba(16, 185, 129, 0.4)",
    icon: <Terminal className="w-6 h-6" />,
    features: ["Coming Soon", "Engineering", "Math/Phys"],
    pattern: "engineering",
    delay: 0.15,
    status: "coming-soon"
  },
  {
    title: "LAT",
    subtitle: "Law Admission Test",
    description: "Dedicated preparation for future lawyers. Comprehensive study material and mock tests coming your way soon.",
    stats: "Soon",
    label: "Status",
    students: "Waitlist",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    glowColor: "rgba(251, 146, 60, 0.4)",
    icon: <FileText className="w-6 h-6" />,
    features: ["Coming Soon", "Legal", "Reasoning"],
    pattern: "law",
    delay: 0.3,
    status: "coming-soon"
  },
  {
    title: "NTS",
    subtitle: "National Testing Service",
    description: "Adaptive learning system for NTS success. We are building a robust platform to help you ace your tests.",
    stats: "Soon",
    label: "Status",
    students: "Waitlist",
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    glowColor: "rgba(139, 92, 246, 0.4)",
    icon: <ShieldCheck className="w-6 h-6" />,
    features: ["Coming Soon", "GAT/NAT", "General"],
    pattern: "nts",
    delay: 0.45,
    status: "coming-soon"
  },
];

const FloatingParticles = () => {
  const [particles, setParticles] = useState<Array<{ x: number, y: number, duration: number }>>([]);

  useEffect(() => {
    const newParticles = [...Array(20)].map(() => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      duration: Math.random() * 20 + 10
    }));
    setParticles(newParticles);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400/30 dark:bg-blue-400/20 rounded-full"
          initial={{
            x: particle.x,
            y: particle.y,
          }}
          animate={{
            y: [null, Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000)],
            x: [null, Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000)],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

const CourseCard = ({ course, index }: { course: any, index: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, rotateX: 10 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{
        delay: course.delay,
        duration: 0.8,
        ease: [0.25, 0.4, 0.25, 1]
      }}
      viewport={{ once: true }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      className="group relative h-full"
      style={{ perspective: "1000px" }}
    >
      {/* Outer glow */}
      <motion.div
        className="absolute -inset-1 rounded-3xl opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-700"
        animate={{
          background: isHovered
            ? `radial-gradient(circle at center, ${course.glowColor}, transparent 70%)`
            : 'transparent'
        }}
      />

      {/* Card container with 3D transform */}
      <motion.div
        className="relative h-full"
        whileHover={{
          scale: 1.02,
          transition: { duration: 0.3, ease: "easeOut" }
        }}
      >
        <div className="relative h-full rounded-3xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 bg-gradient-to-br from-white via-slate-50/50 to-white border border-slate-200/80 dark:border-slate-800/50 overflow-hidden shadow-xl dark:shadow-2xl backdrop-blur-sm">

          {/* Animated mesh gradient */}
          <motion.div
            className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${course.gradient}`}
            style={{ mixBlendMode: 'overlay', opacity: 0.1 }}
          />

          {/* Spotlight effect */}
          <motion.div
            className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: useMotionTemplate`
                radial-gradient(
                  650px circle at ${mouseX}px ${mouseY}px,
                  ${course.glowColor},
                  transparent 70%
                )
              `,
            }}
          />

          {/* Animated pattern overlay */}
          <div className="absolute inset-0 opacity-0">
            <svg width="100%" height="100%">
              <defs>
                <pattern id={`pattern-${index}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="1.5"
                    fill="currentColor"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#pattern-${index})`} className="text-slate-900 dark:text-white" />
            </svg>
          </div>

          {/* Top accent line with animation */}
          <motion.div
            className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${course.gradient}`}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ delay: course.delay + 0.3, duration: 0.8 }}
            viewport={{ once: true }}
          />

          {/* Content */}
          <div className="relative h-full p-8 flex flex-col z-10">

            {/* Header with floating animation */}
            <div className="flex items-start justify-between mb-8">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className={`relative p-4 rounded-2xl bg-gradient-to-br ${course.gradient} shadow-2xl group-hover:shadow-3xl transition-shadow duration-500`}
              >
                {/* Icon glow */}
                <div className="absolute inset-0 rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity bg-gradient-to-br from-white/50 to-transparent" />
                <div className="relative text-white">
                  {course.icon}
                </div>
              </motion.div>

              <div className="text-right">
                <motion.div
                  className="text-4xl font-black bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {course.stats}
                </motion.div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  {course.label}
                </div>
              </div>
            </div>

            {/* Title with gradient animation */}
            <div className="mb-6">
              <motion.h3
                className="text-3xl font-black mb-2 text-slate-900 dark:text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-slate-900 group-hover:via-slate-700 group-hover:to-slate-900 dark:group-hover:from-white dark:group-hover:via-slate-200 dark:group-hover:to-white transition-all duration-500"
                whileHover={{ x: 5 }}
              >
                {course.title}
              </motion.h3>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 tracking-wide">
                {course.subtitle}
              </p>
            </div>

            {/* Description */}
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 mb-6 flex-grow">
              {course.description}
            </p>

            {/* Stats row */}
            <div className="flex items-center gap-4 mb-6 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <Users className="w-3.5 h-3.5" />
                <span className="font-semibold">{course.students}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-semibold">Self-paced</span>
              </div>
            </div>

            {/* Features with stagger animation */}
            <div className="flex flex-wrap gap-2 mb-8">
              {course.features.map((feature: string, idx: number) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: course.delay + 0.1 * idx }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm shadow-sm hover:shadow-md transition-all cursor-default"
                >
                  {feature}
                </motion.span>
              ))}
            </div>

            {/* CTA Button */}
            <motion.button
              whileHover={course.status === 'active' ? { scale: 1.03, y: -2 } : {}}
              whileTap={course.status === 'active' ? { scale: 0.98 } : {}}
              disabled={course.status !== 'active'}
              className={`relative w-full py-4 px-6 rounded-2xl font-bold text-white shadow-lg transition-all duration-300 overflow-hidden group/btn ${course.status === 'active'
                ? `bg-gradient-to-r ${course.gradient} hover:shadow-2xl`
                : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed opacity-70'
                }`}
            >
              {course.status === 'active' && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '100%' }}
                  transition={{ duration: 0.6 }}
                />
              )}
              <span className="relative flex items-center justify-center gap-2">
                <span>{course.status === 'active' ? 'Start Learning' : 'Coming Soon'}</span>
                {course.status === 'active' && <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />}
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const CoursesSection = () => {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);

  return (
    <section id="courses" className="relative min-h-screen flex items-center py-32 px-4 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-black dark:via-slate-950 dark:to-black overflow-hidden">

      {/* Animated background blobs */}
      <motion.div
        className="absolute inset-0 overflow-hidden"
        style={{ y, opacity }}
      >
        <motion.div
          className="absolute top-1/4 -left-48 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-purple-500/10 dark:from-blue-500/5 dark:via-cyan-500/5 dark:to-purple-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 -right-48 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 dark:from-purple-500/5 dark:via-pink-500/5 dark:to-orange-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -50, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-500/5 dark:via-teal-500/5 dark:to-cyan-500/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </motion.div>

      {/* Floating particles */}
      <FloatingParticles />

      <div className="relative max-w-7xl mx-auto w-full z-10">

        {/* Header Section */}
        <div className="text-center mb-20 space-y-8">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl border border-blue-500/20 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 text-sm font-bold shadow-lg"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4" />
            </motion.div>
            <span className="tracking-wide">TRANSFORM YOUR FUTURE</span>
          </motion.div>

          {/* Main Heading */}
          <div className="space-y-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-none"
            >
              <motion.span
                className="inline-block text-slate-900 dark:text-white"
                whileInView={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                Master Your
              </motion.span>
              <br />
              <span className="relative inline-block">
                <span className="text-slate-900 dark:text-white">
                  Entrance Exam
                </span>
                {/* Underline decoration */}
                <motion.div
                  className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  viewport={{ once: true }}
                />
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
              className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium"
            >
              Experience the future of test preparation with AI-driven learning paths,
              <span className="text-slate-900 dark:text-white font-bold"> interactive simulations</span>, and
              <span className="text-slate-900 dark:text-white font-bold"> personalized coaching</span>
            </motion.p>
          </div>
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          viewport={{ once: true }}
          className="relative mb-20"
        >
          <div className="relative p-8 rounded-3xl bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-2xl overflow-hidden">

            {/* Animated background gradient */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-pink-500/10"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "linear"
              }}
            />

            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: <Brain className="w-6 h-6" />, label: "AI-Powered", value: "Learning", gradient: "from-cyan-500 to-blue-500" },
                { icon: <Target className="w-6 h-6" />, label: "15,000+", value: "Active Students", gradient: "from-purple-500 to-pink-500" },
                { icon: <Trophy className="w-6 h-6" />, label: "92.5%", value: "Avg Success Rate", gradient: "from-orange-500 to-red-500" },
              ].map((stat, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700/50 cursor-default group"
                >
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg group-hover:shadow-xl transition-shadow`}>
                    <div className="text-white">
                      {stat.icon}
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">{stat.label}</div>
                    <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">{stat.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {courses.map((course, index) => (
            <CourseCard key={index} course={course} index={index} />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-20"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 text-white dark:text-slate-900 font-bold shadow-2xl hover:shadow-3xl transition-all"
          >
            <span>Explore All Courses</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>
        </motion.div>

      </div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </section>
  );
};

export default CoursesSection;