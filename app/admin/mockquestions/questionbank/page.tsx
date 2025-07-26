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

  type Question = {
    id: string;
    questionText: string;
    options: string[];
    correctAnswer: string;
    course?: string;
    subject?: string;
    chapter?: string;
    difficulty?: string;
  };

  const [questions, setQuestions] = useState<Question[]>([]);
  const [filtered, setFiltered] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const snapshot = await getDocs(collection(db, "mock-questions"));
        const fetched: Question[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Question, "id">),
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

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keyword = e.target.value.toLowerCase();
    setSearch(keyword);
    const filtered = questions.filter((q) =>
      q.course?.toLowerCase().includes(keyword) ||
      q.subject?.toLowerCase().includes(keyword) ||
      q.chapter?.toLowerCase().includes(keyword)
    );
    setFiltered(filtered);
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm("Are you sure you want to delete this question?");
    if (!confirm) return;

    await deleteDoc(doc(db, "mock-questions", id));
    const updated = questions.filter((q) => q.id !== id);
    setQuestions(updated);
    setFiltered(updated);
  };

  return (
    <div className="min-h-screen bg-white rounded-xl p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            📘 Question Bank
          </h1>
          <span className="text-sm sm:text-base text-gray-600">
            (Total Questions: {questions.length})
          </span>
        </div>
        <Button
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          onClick={() => router.push("/admin/mockquestions/create")}
        >
          <Plus className="h-5 w-5 mr-2" />
          New Question
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-full sm:max-w-xl">
        <Input
          placeholder="Search by course, subject, or chapter..."
          value={search}
          onChange={handleSearch}
          className="w-full py-6 px-4 border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-md"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse bg-white shadow-md">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="h-6 bg-gray-100 rounded"></div>
                <div className="h-6 bg-gray-100 rounded"></div>
              </div>
              <div className="flex justify-end gap-2">
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-lg mt-10">No questions found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6">
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
              <Card
                key={id}
                className="p-4 bg-white shadow-md hover:shadow-lg transition-shadow duration-300 rounded-xl"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-start gap-1">
  {idx + 1}.{' '}
  <span
    className="prose max-w-prose inline"
    dangerouslySetInnerHTML={{ __html: questionText }}
  />
</h2>

                  <div className="flex flex-wrap gap-2">
                    {course && <Badge className="bg-blue-100 text-blue-800">{course}</Badge>}
                    {subject && <Badge variant="outline" className="border-blue-200 text-gray-700">{subject}</Badge>}
                    {chapter && <Badge variant="secondary" className="bg-gray-100 text-gray-700">{chapter}</Badge>}
                    {difficulty && <Badge className="bg-green-100 text-green-800">{difficulty}</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 mb-4">
                  {options.map((opt, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-md border text-sm ${
                        opt === correctAnswer
                          ? "bg-green-100 border-green-400 text-green-900"
                          : "bg-gray-50 border-gray-200 text-gray-700"
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-300 hover:bg-gray-100 text-gray-700"
                    onClick={() => router.push(`/admin/mockquestions/create?id=${id}`)}
                  >
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="hover:bg-red-700 text-white"
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