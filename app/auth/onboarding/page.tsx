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

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    fatherName: '', // ✅ New field added
    email: '',
    phone: '',
    city: '',
    university: '',
    campus: '',
    degree: '',
    course: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setForm((prev) => ({ ...prev, email: user.email || '' }));

        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();

          if (data.admin === true) {
            router.push('/dashboard/admin');
            return;
          }

          const required = [
            'fullName',
            'fatherName', // ✅ Validate this field
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
          }
        }
      } else {
        router.push('/auth/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

      setLoading(false);
      setShowPlanModal(true);
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      toast.error('Failed to save your information. Please try again.');
      setLoading(false);
    }
  };

  const handlePlanChoice = async (choice: 'free' | 'premium') => {
    if (!userId) return;
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
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000" />

      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
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
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="fullName"
                      placeholder="Your full name"
                      value={form.fullName}
                      onChange={(e) => handleChange('fullName', e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fatherName">Father's Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="fatherName"
                      placeholder="Your father's name"
                      value={form.fatherName}
                      onChange={(e) => handleChange('fatherName', e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="Your phone number"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="city"
                      placeholder="Your city"
                      value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className="pl-10 h-12 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      readOnly
                      className="pl-10 h-12 bg-gray-100 text-gray-500 cursor-not-allowed rounded-xl"
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
                  className="rounded-xl"
                >
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button
                  type="button"
                  onClick={() => setStep((prev) => prev + 1)}
                  className="bg-primary text-white rounded-xl"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-32 h-12 bg-primary text-white rounded-xl"
                >
                  {loading ? 'Saving...' : 'Finish'}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-md w-full text-center shadow-2xl space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Choose Your Plan</h2>
            <p className="text-gray-600">Upgrade to unlock unlimited quizzes, custom tests, and more!</p>
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <Button
                onClick={() => handlePlanChoice('free')}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl"
              >
                Continue Free
              </Button>
              <Button
                onClick={() => handlePlanChoice('premium')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              >
                Go Premium – 1000 PKR
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
