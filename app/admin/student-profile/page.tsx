"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/app/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { ArrowRightCircle } from "lucide-react";

export default function StudentProfilePage() {
  const [uid, setUid] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
  
    plan: '',
    course: "",
    fatherName: "",
    district: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUid(user.uid);
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setForm({
            fullName: data.fullName || "",
            email: data.email || "",
          
            course: data.course || "",
            plan: data.plan || "",
            fatherName: data.fatherName || "",
            district: data.district || "",
          });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleUpdate = async () => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const { fullName,  course, fatherName, district } = form;
    await updateDoc(ref, { fullName, course, fatherName, district });
    alert("Profile updated successfully");
  };

  const editableFields = ["fullName", "fatherName", "district"];
  const displayFields = ["fullName", "email", "course", "plan", "fatherName", "district"];

  if (loading) return <div className="p-6">Loading...</div>;

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
                disabled={!isEditable}
                className={`w-full border  rounded-sm px-6 py-4 ${
                  isEditable
                    ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    : "bg-white text-gray-500 cursor-not-allowed"
                }`}
                placeholder={key}
              />
            </div>
          );
        })}

        <Link
          href="/pricing"
          className="inline-flex items-center justify-center bg-white border border-blue-600 text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-100 transition"
        >
          Upgrade Plan <ArrowRightCircle className="ml-2 w-5 h-5" />
        </Link>

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