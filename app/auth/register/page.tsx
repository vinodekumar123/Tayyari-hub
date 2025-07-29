
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, provider } from "../../firebase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, BookOpen, Sparkles, ArrowRight } from "lucide-react";

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
    document.body.style.cursor = "wait";
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/onboarding");
    } catch (err: any) {
      setError(
        err.code === "auth/email-already-in-use"
          ? "This email is already registered. Please sign in."
          : err.message
      );
    } finally {
      setIsLoading(false);
      document.body.style.cursor = "default";
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    document.body.style.cursor = "wait";
    try {
      await signInWithPopup(auth, provider);
      router.push("/auth/onboarding");
    } catch (err: any) {
      if (err.code === "auth/popup-closed-by-user") {
        setError("Google Sign-In was cancelled. Please try again.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup was blocked by your browser. Please allow popups and try again.");
      } else {
        setError("Google Sign-In failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
      document.body.style.cursor = "default";
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3 mb-6 group">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <span className="text-3xl font-bold text-primary">Tayyari Hub</span>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Create Account</h1>
          <p className="text-gray-600 text-lg">Join the journey to success</p>
        </div>

        <Card className="glass-card border shadow-2xl">
          <CardContent className="space-y-6">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email"
                    required
                    className="pl-12 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="pl-12 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="pl-12 h-12 border-gray-200 focus:border-primary focus:ring-primary/20 rounded-xl"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-primary text-white rounded-xl shadow-md hover:bg-blue-700 transition-all duration-300 font-semibold text-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5" />
                    <span>Create Account</span>
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-gray-500 font-medium">Or continue with</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleGoogleSignup}
              className="w-full h-12 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl transition-all duration-300 font-medium"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
                  <span>Signing up...</span>
                </div>
              ) : (
                <>
                  <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Already have an account? </span>
              <Link href="/auth/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
