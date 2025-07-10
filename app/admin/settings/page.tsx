'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../.././firebase'; // adjust path if needed

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function UserProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    university: '',
    campus: '',
    degree: '',
    course: '',
    plan: '',
  });

  // 🟡 Detect and set authenticated user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setForm(prev => ({ ...prev, email: user.email || '' }));
        await fetchUserData(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  // 🟢 Fetch user profile data
  const fetchUserData = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        setForm(snapshot.data() as typeof form);
      } else {
        toast.warning('No profile data found.');
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      toast.error('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  // 🟣 Handle form input
  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // 🔵 Save updated profile
  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        ...form,
        updatedAt: new Date(),
      });
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-center py-10">Loading profile...</p>;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex justify-center">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">👤 My Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {[
            { label: 'Full Name', key: 'fullName' },
            { label: 'Email', key: 'email', readOnly: true },
            { label: 'Phone', key: 'phone' },
            { label: 'City', key: 'city' },
            { label: 'University', key: 'university' },
            { label: 'Campus', key: 'campus' },
            { label: 'Course', key: 'course' },
            { label: 'Degree', key: 'degree' },
            { label: 'Plan', key: 'plan', readOnly: true }
          ].map(({ label, key, readOnly }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={(form as any)[key] || ''}
                readOnly={readOnly}
                onChange={(e) => handleChange(key, e.target.value)}
                className={readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}
              />
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
