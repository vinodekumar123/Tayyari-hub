'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../firebase';
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, User, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [step, setStep] = useState(1);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    fatherName: '',
    email: '',
    phone: '',
    district: '',
    university: '',
    campus: '',
    degree: '',
    course: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/auth/login');
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      setForm((prev) => ({ ...prev, email: user.email || '' }));

      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();

          if (data.admin === true) {
            router.push('/dashboard/admin');
            setLoading(false);
            return;
          }

          const required = [
            'fullName',
            'fatherName',
            'email',
            'phone',
            'city',
            'university',
            'campus',
            'degree',
            'course',
          ];
          const incomplete = required.some((field) => !data[field]);

          if (!incomplete) {
            router.push('/dashboard/student');
          } else {
            // Update form with existing data
            setForm((prev) => ({
              ...prev,
              ...data,
              email: user.email || prev.email,
            }));
            setLoading(false);
          }
        } else {
          setLoading(false); // No user data, proceed with onboarding
        }
      } catch (error) {
        console.error('Error checking user data:', error);
        toast.error('Failed to load user data. Please try again.');
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    try {
      await setDoc(doc(db, 'users', userId), {
        ...form,
        uid: userId,
        createdAt: serverTimestamp(),
        plan: 'free',
      });

      setShowPlanModal(true);
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast.error('Failed to save your information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChoice = async (choice) => {
    if (!userId) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        plan: choice,
      });

      const userSnap = await getDoc(doc(db, 'users', userId));
      const data = userSnap.exists() ? userSnap.data() : {};

      if (choice === 'free') {
        if (data.admin) {
          router.push('/dashboard/admin');
        } else {
          router.push('/dashboard/student');
        }
      } else {
        router.push('/premium');
      }
    } catch (err) {
      console.error('Failed to save plan choice:', err);
      toast.error('Could not save your plan choice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4 relative">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000" />
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-t-primary border-gray-200 rounded-full animate-spin" />
            <p className="text-white text-lg font-semibold">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000" />

      <Card className="w-full max-w-md sm:max-w-lg md:max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-bold text-center">
            {step === 1 ? 'Complete Your Profile' : 'Education Details'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="fullName"
                      placeholder="Your full name"
                      value={form.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="fatherName"
                      placeholder="Your father's name"
                      value={form.fatherName}
                      onChange={(e) => handleChange('fatherName', e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Your phone number"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">District</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="city"
                      placeholder="Your city"
                      value={form.city}
                      onChange={(e) => handleChange('district', e.target.value)}
                      className="pl-10 h-12 rounded-xl text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      readOnly
                      className="pl-10 h-12 bg-gray-100 text-gray-500 cursor-not-allowed rounded-xl text-sm sm:text-base"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="university">University</Label>
                  <Input
                    id="university"
                    placeholder="e.g. Punjab University"
                    value={form.university}
                    onChange={(e) => handleChange('university', e.target.value)}
                    className="h-12 rounded-xl text-sm sm:text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="campus">Campus</Label>
                  <Input
                    id="campus"
                    placeholder="e.g. Lahore Campus"
                    value={form.campus}
                    onChange={(e) => handleChange('campus', e.target.value)}
                    className="h-12 rounded-xl text-sm sm:text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="course">Course</Label>
                  <Input
                    id="course"
                    placeholder="e.g. Computer Science"
                    value={form.course}
                    onChange={(e) => handleChange('course', e.target.value)}
                    className="h-12 rounded-xl text-sm sm:text-base"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="degree">Degree</Label>
                  <Input
                    id="degree"
                    placeholder="e.g. BSCS"
                    value={form.degree}
                    onChange={(e) => handleChange('degree', e.target.value)}
                    className="h-12 rounded-xl text-sm sm:text-base"
                    required
                  />
                </div>
              </>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((prev) => prev - 1)}
                  className="rounded-xl h-12 w-24"
                >
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button
                  type="button"
                  onClick={() => setStep((prev) => prev + 1)}
                  className="bg-primary text-white rounded-xl h-12 w-24"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-32 h-12 bg-primary text-white rounded-xl"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-t-white border-gray-400 rounded-full animate-spin" />
                      Saving...
                    </div>
                  ) : (
                    'Finish'
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full text-center shadow-2xl space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Choose Your Plan</h2>
            <p className="text-gray-600 text-sm sm:text-base">Upgrade to unlock unlimited quizzes, custom tests, and more!</p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button
                onClick={() => handlePlanChoice('free')}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl h-12"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-t-primary border-gray-400 rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  'Continue Free'
                )}
              </Button>
              <Button
                onClick={() => handlePlanChoice('premium')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-t-white border-gray-400 rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  'Go Premium – 1000 PKR'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}