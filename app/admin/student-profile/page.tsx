"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/app/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function StudentProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          console.log("✅ Auth user:", user.uid, user.email);
          setUid(user.uid);

          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            console.log("✅ Firestore data:", snap.data());
            setForm(snap.data());
          } else {
            console.warn("⚠️ No Firestore document found for UID:", user.uid);
            setForm({}); // keep empty instead of null
          }
        } else {
          console.log("⚠️ No auth user logged in");
          setUid(null);
          setForm(null);
        }
      } catch (err) {
        console.error("🔥 Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!form) return <div>No profile data found</div>;

  return (
    <div className="p-6">
      <h1>Student Profile</h1>
      <pre>{JSON.stringify(form, null, 2)}</pre>
    </div>
  );
}
