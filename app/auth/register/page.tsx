"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, provider, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { logUserSession, setLoginInProgress, clearLoginInProgress } from "@/lib/sessionUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, ChevronLeft, User, Trophy, BarChart3, BookOpen, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    setLoginInProgress(); // Set flag BEFORE registration
    document.body.style.cursor = "wait";
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Log initial session for new user
      try {
        await logUserSession(userCredential.user);
        clearLoginInProgress();
      } catch (sessionError) {
        console.warn('Initial session logging failed, will retry on next page load:', sessionError);
        clearLoginInProgress();
        // Don't block registration flow
      }
      router.push("/auth/onboarding");
    } catch (err: any) {
      clearLoginInProgress();
      setError(
        err.code === "auth/email-already-in-use"
          ? "Account exists. Please sign in."
          : err.message
      );
    } finally {
      setIsLoading(false);
      document.body.style.cursor = "default";
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setLoginInProgress(); // Set flag BEFORE Google signup
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Log session for Google signup
      await logUserSession(user);
      clearLoginInProgress();

      // Check if user exists and is complete
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const requiredFields = ['fullName', 'fatherName', 'phone', 'district', 'course'];
        const isProfileComplete = requiredFields.every(field => userData[field] && userData[field].trim() !== '');

        if (userData.admin === true) {
          router.push('/dashboard/admin');
        } else if (isProfileComplete) {
          router.push('/dashboard/student');
        } else {
          router.push('/auth/onboarding');
        }
      } else {
        router.push("/auth/onboarding");
      }
    } catch (err: any) {
      console.error(err);
      clearLoginInProgress();
      setError("Google signup failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const FeatureItem = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-blue-400" />
      </div>
      <div>
        <h4 className="font-bold text-slate-200">{title}</h4>
        <p className="text-sm text-slate-500 leading-snug">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-950 overflow-hidden text-slate-200">

      {/* Cinematic Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse-slow hidden sm:block"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse-slow delay-1000 hidden sm:block"></div>
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]"></div>
      </div>

      <div className="container relative z-10 max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-20 items-center">

        {/* Left: Info (Only visible on large screens) */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden lg:block space-y-10"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-sm mb-6">
              <Trophy className="w-4 h-4" />
              <span>Join 10,000+ Achievers</span>
            </div>
            <h1 className="text-6xl font-black leading-tight tracking-tight mb-6">
              Unlock Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">Potential.</span>
            </h1>
            <p className="text-lg text-slate-400 max-w-md leading-relaxed">
              Create your free account today and get instant access to premium study materials.
            </p>
          </div>

          <div className="grid gap-4">
            <FeatureItem icon={BookOpen} title="Smart Question Bank" desc="Thousands of verified MCQs with detailed explanations." />
            <FeatureItem icon={BarChart3} title="Performance Analytics" desc="Track your progress and identify weak areas instantly." />
          </div>
        </motion.div>

        {/* Right: Register Form */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 md:p-10 shadow-2xl relative overflow-hidden">

            <div className="mb-8 text-center lg:text-left">
              <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm font-medium">
                <ChevronLeft className="w-4 h-4" /> Back to Home
              </Link>
              <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
              <p className="text-slate-400 text-sm">Join the community for free.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-center gap-3 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-300 ml-1 text-xs uppercase tracking-wider font-bold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="h-11 rounded-xl bg-slate-950/50 border-white/10 focus:border-blue-500/50 focus:bg-slate-950 transition-all text-white placeholder:text-slate-600"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300 ml-1 text-xs uppercase tracking-wider font-bold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  className="h-11 rounded-xl bg-slate-950/50 border-white/10 focus:border-blue-500/50 focus:bg-slate-950 transition-all text-white placeholder:text-slate-600"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-slate-300 ml-1 text-xs uppercase tracking-wider font-bold">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  className="h-11 rounded-xl bg-slate-950/50 border-white/10 focus:border-blue-500/50 focus:bg-slate-950 transition-all text-white placeholder:text-slate-600"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300 border border-t-white/20"
                >
                  {isLoading ? "Creating Account..." : "Join Now"}
                </Button>
              </div>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
              <div className="relative flex justify-center text-xs uppercase font-bold text-slate-500">
                <span className="bg-[#0f172a] px-4">OR</span>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={handleGoogleSignup}
              disabled={isLoading}
              className="w-full h-11 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
              </svg>
              Sign up with Google
            </Button>

            <p className="text-center text-sm text-slate-500 mt-6">
              Already have an account? <Link href="/auth/login" className="font-bold text-blue-400 hover:text-blue-300 hover:underline">Sign in</Link>
            </p>

            <div className="text-center text-xs text-slate-600 mt-6">
              By signing up, you agree to our{" "}
              <Link href="/privacy-policy" className="hover:text-blue-400 transition-colors">Terms and Conditions</Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
