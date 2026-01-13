"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from "framer-motion";
import { auth, provider, db } from '../../firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { logUserSession } from '@/lib/sessionUtils';
import { getAuthErrorMessage, DeviceLimitError, SessionRevokedError } from '@/lib/authErrors';
import {
  validateEmail,
  validatePassword,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  formatRemainingTime,
  getRemainingLockTime
} from '@/lib/validation';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !navigatedRef.current && isMounted) {
        navigatedRef.current = true;
        try {
          // Check email verification
          if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
            setError('Please verify your email address. Check your inbox for the verification link.');
            await auth.signOut();
            navigatedRef.current = false;
            return;
          }

          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();

            // Check for required fields
            const requiredFields = ['fullName', 'fatherName', 'phone', 'district', 'course'];
            const isProfileComplete = requiredFields.every(field => userData[field] && userData[field].trim() !== '');
            const userRole = userData.role;

            if (userRole === 'superadmin' || userRole === 'admin' || userData.admin === true) {
              router.push('/dashboard/admin');
            } else if (userRole === 'teacher' || userData.teacher === true) {
              router.push('/dashboard/teacher');
            } else if (isProfileComplete) {
              router.push('/dashboard/student');
            } else {
              router.push('/auth/onboarding');
            }
          } else {
            router.push('/auth/onboarding');
          }
        } catch (err) {
          console.error('Navigation error:', err);
          navigatedRef.current = false;
        }
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check rate limit
    const rateLimit = checkRateLimit();
    if (rateLimit.isLimited) {
      const remainingTime = getRemainingLockTime();
      setError(`Too many failed attempts. Please try again in ${formatRemainingTime(remainingTime)}.`);
      return;
    }

    // Validate inputs
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error || 'Invalid email');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error || 'Invalid password');
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Log session - handle failures explicitly
      try {
        await logUserSession(userCredential.user);
        // Success - reset rate limit
        resetRateLimit();
      } catch (sessionError) {
        // Session logging failed - this is critical
        console.error("Session logging failed:", sessionError);

        if (sessionError instanceof DeviceLimitError) {
          // Sign out and show device limit error
          await auth.signOut();
          setError('Device limit reached. Please logout from another device first.');
          setIsLoading(false);
          return;
        }

        // For other session errors, show warning but allow login
        setError('Warning: Session tracking unavailable. Some features may be limited.');
        // Don't return - proceed with login
      }

    } catch (error) {
      console.error('Login error:', error);
      setError(getAuthErrorMessage(error));
      setPassword(''); // Clear password on failure
      recordFailedAttempt();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, provider);

      // Log session
      try {
        await logUserSession(result.user);
      } catch (sessionError) {
        console.error("Session logging failed:", sessionError);

        if (sessionError instanceof DeviceLimitError) {
          await auth.signOut();
          setError('Device limit reached. Please logout from another device first.');
          setIsLoading(false);
          return;
        }

        setError('Warning: Session tracking unavailable. Some features may be limited.');
      }

    } catch (error) {
      console.error('Google login error:', error);
      setError(getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setForgotPasswordSuccess(false);

    const emailValidation = validateEmail(forgotPasswordEmail || email);
    if (!emailValidation.valid) {
      setError('Please enter a valid email address');
      return;
    }

    const emailToUse = forgotPasswordEmail || email;

    try {
      await sendPasswordResetEmail(auth, emailToUse);
      setForgotPasswordSuccess(true);
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotPasswordSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Password reset error:', error);
      setError(getAuthErrorMessage(error));
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-950 overflow-hidden text-slate-200">

      {/* Cinematic Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] hidden sm:block"
          style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] hidden sm:block"
          style={{ animation: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite 2s' }}
        />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]"></div>
      </div>

      <noscript>
        <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md text-center">
            <h2 className="text-2xl font-bold mb-4">JavaScript Required</h2>
            <p className="text-slate-400">
              This application requires JavaScript to be enabled. Please enable JavaScript in your browser settings to continue.
            </p>
          </div>
        </div>
      </noscript>

      <div className="container relative z-10 max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-20 items-center">

        {/* Left: Hero Text (Only visible on large screens) */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden lg:block space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-blue-400 font-bold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Next-Gen Learning</span>
          </div>
          <h1 className="text-7xl font-black leading-tight tracking-tight">
            Welcome <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400">Back.</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-md leading-relaxed">
            Your personal dashboard is ready. Continue your journey towards excellence with our advanced analytics and curated content.
          </p>
          <div className="flex gap-4 pt-4">
            <div className="px-6 py-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
              <span className="block text-2xl font-bold text-white">10k+</span>
              <span className="text-sm text-slate-500">Active Students</span>
            </div>
            <div className="px-6 py-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
              <span className="block text-2xl font-bold text-white">98%</span>
              <span className="text-sm text-slate-500">Success Rate</span>
            </div>
          </div>
        </motion.div>

        {/* Right: Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group">
            {/* Subtle gradient border sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>

            <div className="mb-10 text-center lg:text-left">
              <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-6 text-sm font-medium">
                <ChevronLeft className="w-4 h-4" /> Back to Home
              </Link>
              <h2 className="text-3xl font-bold text-white mb-2">Sign In</h2>
              <p className="text-slate-400 text-sm">Enter your credentials to access your account.</p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Forgot Password Modal/Inline */}
            {showForgotPassword ? (
              <div className="mb-6 p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <h3 className="text-lg font-bold text-white mb-3">Reset Password</h3>
                {forgotPasswordSuccess ? (
                  <div className="text-green-400 text-sm">
                    ✓ Password reset link sent! Check your email.
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-400 mb-4">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      className="mb-3 h-11 rounded-xl bg-slate-950/50 border-white/10 focus:border-blue-500/50 focus:bg-slate-950 transition-all text-white placeholder:text-slate-600"
                      value={forgotPasswordEmail || email}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      autoComplete="email"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleForgotPassword}
                        className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold"
                      >
                        Send Reset Link
                      </Button>
                      <Button
                        onClick={() => {
                          setShowForgotPassword(false);
                          setError('');
                        }}
                        variant="ghost"
                        className="h-10 px-4 text-slate-400 hover:text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300 ml-1">Email</Label>
                  <div className="relative group/input">
                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-500 group-hover/input:text-slate-300 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      className="pl-12 h-12 rounded-xl bg-slate-950/50 border-white/10 focus:border-blue-500/50 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 transition-all text-white placeholder:text-slate-600"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="text-slate-300 ml-1">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                      disabled={isLoading}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative group/input">
                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-500 group-hover/input:text-slate-300 transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      className="pl-12 pr-12 h-12 rounded-xl bg-slate-950/50 border-white/10 focus:border-blue-500/50 focus:bg-slate-950 focus:ring-4 focus:ring-blue-500/10 transition-all text-white placeholder:text-slate-600"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded"
                      disabled={isLoading}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all duration-300 border border-t-white/20 disabled:hover:translate-y-0"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing In...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            )}

            {!showForgotPassword && (
              <>
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                  <div className="relative flex justify-center text-xs uppercase font-bold text-slate-500">
                    <span className="bg-slate-900/40 px-4">OR</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full h-12 bg-white/5 hover:bg-white/10 disabled:bg-white/5 disabled:text-slate-600 border border-white/10 rounded-xl font-medium text-white flex items-center justify-center gap-3 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                  </svg>
                  Continue with Google
                </Button>

                <p className="text-center text-sm text-slate-500 mt-8">
                  New here? <Link href="/auth/register" className="font-bold text-blue-400 hover:text-blue-300 hover:underline">Create account</Link>
                </p>

                <div className="text-center text-xs text-slate-600 mt-6">
                  By signing in, you agree to our{" "}
                  <Link href="/privacy-policy" className="hover:text-blue-400 transition-colors">Terms and Conditions</Link>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
