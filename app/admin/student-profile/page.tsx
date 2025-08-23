"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "@/app/firebase";
import {
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { ArrowRightCircle } from "lucide-react";

// ✅ simple toast util (replace with shadcn/ui toast if available)
function toast(msg: string, type: "success" | "error" = "success") {
  alert(`${type.toUpperCase()}: ${msg}`);
}

export default function StudentProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    plan: "",
    course: "",
    fatherName: "",
    district: "",
  });
  const [loading, setLoading] = useState(true);

  // 🟢 Load user profile
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setLoading(false);
        return;
      }

      setUid(user.uid);
      const ref = doc(db, "users", user.uid);

      try {
        // ⚡ try cache first
        const cachedSnap = await getDocFromCache(ref).catch(() => null);
        if (cachedSnap?.exists()) {
          setForm({ ...form, ...cachedSnap.data() } as any);
        }

        // 🟢 realtime sync from server
        const unsubscribeSnap = onSnapshot(ref, async (snap) => {
          if (snap.exists()) {
            setForm({ ...form, ...snap.data() } as any);
          } else {
            // auto-create if missing
            await setDoc(ref, {
              fullName: user.displayName || "",
              email: user.email || "",
              plan: "free",
              course: "",
              fatherName: "",
              district: "",
            });
            toast("Profile created, please complete details");
          }
          setLoading(false);
        });

        return () => unsubscribeSnap();
      } catch (err) {
        console.error("Firestore load error:", err);
        toast("Failed to load profile", "error");
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 🟢 Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.id]: e.target.value }));
  };

  // 🟢 Update profile with diff-check
  const handleUpdate = useCallback(async () => {
    if (!uid) return;

    const ref = doc(db, "users", uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        toast("Profile not found", "error");
        return;
      }

      const existing = snap.data();
      const updates: Record<string, any> = {};
      ["fullName", "course", "fatherName", "district"].forEach((field) => {
        if (form[field as keyof typeof form] !== existing[field]) {
          updates[field] = form[field as keyof typeof form];
        }
      });

      if (Object.keys(updates).length > 0) {
        await updateDoc(ref, updates);
        toast("Profile updated successfully");
      } else {
        toast("No changes to update");
      }
    } catch (err) {
      console.error("Update error:", err);
      toast("Update failed", "error");
    }
  }, [uid, form]);

  const editableFields = ["fullName", "fatherName", "district"];
  const displayFields = [
    "fullName",
    "email",
    "course",
    "plan",
    "fatherName",
    "district",
  ];

  // 🟢 Skeleton loader
  if (loading) {
    return (
      <div className="p-10">
        <h1 className="text-4xl font-bold text-gray-800 mb-10">
          Student Profile Editor
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl">
          {displayFields.map((key) => (
            <div key={key} className="w-full">
              <div className="h-6 w-24 bg-gray-200 rounded mb-2 animate-pulse"></div>
              <div className="h-12 w-full bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-100 to-white px-10 py-10">
      <h1 className="text-4xl font-bold text-gray-800 mb-10">
        Student Profile Editor
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl">
        {displayFields.map((key) => {
          const isEditable = editableFields.includes(key);
          return (
            <div key={key} className="w-full">
              <label
                htmlFor={key}
                className="block text-sm font-semibold text-gray-700 mb-1 capitalize"
              >
                {key}
              </label>
              <input
                id={key}
                value={form[key as keyof typeof form] || ""}
                onChange={isEditable ? handleChange : undefined}
                readOnly={!isEditable}
                className={`w-full border rounded-sm px-6 py-4 ${
                  isEditable
                    ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    : "bg-gray-50 text-gray-500"
                }`}
                placeholder={key}
              />
            </div>
          );
        })}

        {/* Upgrade Plan Button */}
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center bg-white border border-blue-600 text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-100 transition"
        >
          Upgrade Plan <ArrowRightCircle className="ml-2 w-5 h-5" />
        </Link>

        {/* Update Profile Button */}
        <div className="md:col-span-2 flex gap-4 mt-6">
          <button
            onClick={handleUpdate}
            className="inline-flex items-center justify-center bg-white border border-blue-600 text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-100 transition"
          >
            Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}
