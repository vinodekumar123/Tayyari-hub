"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pencil, Trash, Plus, Loader2 } from "lucide-react";

const QuestionBankPage = () => {
  const router = useRouter();
  const [questions, setQuestions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const snapshot = await getDocs(collection(db, "questions"));
        const fetched = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setQuestions(fetched);
        setFiltered(fetched);
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  const handleSearch = (e) => {
    const keyword = e.target.value.toLowerCase();
    setSearch(keyword);
    const filtered = questions.filter((q) =>
      q.course?.toLowerCase().includes(keyword) ||
      q.subject?.toLowerCase().includes(keyword) ||
      q.chapter?.toLowerCase().includes(keyword)
    );
    setFiltered(filtered);
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this question?");
    if (!confirm) return;

    await deleteDoc(doc(db, "questions", id));
    const updated = questions.filter((q) => q.id !== id);
    setQuestions(updated);
    setFiltered(updated);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          📘 Question Bank
        </h1>
        <Button onClick={() => router.push("/admin/questions/create")}>
          <Plus className="h-4 w-4 mr-2" />
          New Question
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-xl">
        <Input
          placeholder="Search by course, subject, or chapter..."
          value={search}
          onChange={handleSearch}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="h-8 bg-gray-100 rounded"></div>
                <div className="h-8 bg-gray-100 rounded"></div>
              </div>
              <div className="flex justify-end gap-2">
                <div className="h-8 w-20 bg-gray-300 rounded"></div>
                <div className="h-8 w-20 bg-gray-300 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">No questions found.</p>
      ) : (
        <div className="space-y-6">
          {filtered.map((question, idx) => {
            const {
              id,
              questionText,
              options = [],
              correctAnswer,
              course,
              subject,
              chapter,
              difficulty,
            } = question;

            return (
              <Card key={id} className="p-5 bg-white shadow-sm rounded-xl">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                  <h2 className="text-base font-semibold text-gray-800">
                    {idx + 1}. {questionText}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {course && <Badge>{course}</Badge>}
                    {subject && <Badge variant="outline">{subject}</Badge>}
                    {chapter && <Badge variant="secondary">{chapter}</Badge>}
                    {difficulty && <Badge>{difficulty}</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  {options.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-md border text-sm ${
                        opt === correctAnswer
                          ? "bg-green-100 border-green-400 text-green-900"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(`/admin/questions/create?id=${id}`)
                    }
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(id)}
                  >
                    <Trash className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestionBankPage;
