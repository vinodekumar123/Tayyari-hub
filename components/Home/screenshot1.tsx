"use client";

import React, { useState, useMemo } from "react";
import { Calendar, Clock, BookOpen, Users, Filter, Search } from "lucide-react";
// Move test data to module scope for stable identity
const testData = [
  { title: 'Screenshot Test 1', subtitle: 'Fast Practice', img: '/test1.png' },
  { title: 'Screenshot Test 2', subtitle: 'Deep Work', img: '/test2.png' },
  { title: 'Screenshot Test 3', subtitle: 'Timed Mode', img: '/test3.png' }
];

// derive scheduledTests at module scope
const scheduledTests = testData.map((t, idx) => ({
  id: idx + 1,
  subject: t.title,
  testName: t.subtitle,
  date: 'TBA',
  type: 'Free',
  gap: ''
}));

const TayyariHubTimetable = () => {
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Use module-scope `testData` defined above

  const subjects = [...new Set(scheduledTests.map((test) => test.subject))];

  const getSubjectColor = (subject) => {
    const colors = {
      "Biology XI": "bg-emerald-50 border-emerald-200 text-emerald-800",
      "Biology XII": "bg-emerald-50 border-emerald-200 text-emerald-800",
      "Chemistry XI": "bg-orange-50 border-orange-200 text-orange-800",
      "Chemistry XII": "bg-orange-50 border-orange-200 text-orange-800",
      "Physics XI": "bg-blue-50 border-blue-200 text-blue-800",
      "Physics XII": "bg-blue-50 border-blue-200 text-blue-800",
      "Whole XI Syllabus": "bg-purple-50 border-purple-200 text-purple-800",
      "Whole XII Syllabus": "bg-purple-50 border-purple-200 text-purple-800",
      "FLP Mocks": "bg-rose-50 border-rose-200 text-rose-800",
    };
    return colors[subject] || "bg-gray-50 border-gray-200 text-gray-800";
  };

  const getSubjectIcon = (subject) => {
    if (subject.includes("Biology")) return "🧬";
    if (subject.includes("Chemistry")) return "⚗️";
    if (subject.includes("Physics")) return "⚛️";
    if (subject.includes("Whole")) return "📚";
    if (subject.includes("FLP")) return "📝";
    return "📖";
  };

  const filteredTests = useMemo(() => {
    return scheduledTests.filter((test) => {
      const matchesSubject = selectedSubject === "all" || test.subject === selectedSubject;
      const matchesType = selectedType === "all" || test.type.toLowerCase() === selectedType;
      const matchesSearch =
        test.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.subject.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSubject && matchesType && matchesSearch;
    });
  }, [selectedSubject, selectedType, searchQuery]);

  const isUpcoming = (dateStr) => {
    const testDate = new Date(dateStr.replace(",", "") + " 2025");
    const today = new Date();
    return testDate >= today;
  };

  const isToday = (dateStr) => {
    const testDate = new Date(dateStr.replace(",", "") + " 2025");
    const today = new Date();
    return testDate.toDateString() === today.toDateString();
  };

  return (
    <section id="screenshot" className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Tayyari Hub Test Series
            </h1>
          </div>
          <p className="text-gray-600 text-lg">Master your preparation with our comprehensive test schedule</p>
        </div>

        {/* Filter Controls */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Filters:</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Types</option>
                <option value="free">Free Only</option>
                <option value="paid">Paid Only</option>
              </select>
            </div>

            <div className="text-sm text-gray-500">{filteredTests.length} tests found</div>
          </div>
        </div>

        {/* Test Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTests.map((test) => (
            <div
              key={test.id}
              className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 ${
                isToday(test.date) ? "ring-2 ring-blue-500 shadow-blue-100" : ""
              }`}
            >
              {/* Card Header */}
              <div className={`px-6 py-4 ${getSubjectColor(test.subject)} border-b`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getSubjectIcon(test.subject)}</span>
                  <div>
                    <h3 className="font-semibold text-lg">{test.subject}</h3>
                    <p className="text-sm opacity-75">Test Series</p>
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-6">
                <h4 className="font-bold text-xl text-gray-800 mb-4">{test.testName}</h4>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-gray-600">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">{test.date}</span>
                    {isToday(test.date) && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-semibold rounded-full">Today</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        test.type === "Free" ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {test.type}
                    </span>
                  </div>

                  {test.gap && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">Gap Period</span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">{test.gap}</p>
                    </div>
                  )}
                </div>

                {/* Availability Info - Only for past tests */}
                {!isUpcoming(test.date) && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700 font-medium text-center">Available on portal upto MDCAT 2025</p>
                  </div>
                )}

                {/* Action Button */}
                <a
                  href="/pricing"
                  className={`block w-full ${!isUpcoming(test.date) ? "mt-4" : "mt-6"} py-3 px-4 rounded-xl font-semibold transition-all duration-200 text-center ${
                    isUpcoming(test.date)
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-blue-200"
                      : "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-200"
                  }`}
                >
                  {isUpcoming(test.date) ? "Register Now" : "Register and Attempt"}
                </a>
              </div>

              {/* Serial Number Badge */}
              <div className="absolute top-4 right-4 w-8 h-8 bg-white bg-opacity-90 backdrop-blur-sm rounded-full flex items-center justify-center text-sm font-bold text-gray-600 shadow-sm">
                {test.id}
              </div>
            </div>
          ))}
        </div>

        {filteredTests.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No tests found</h3>
            <p className="text-gray-500">Try adjusting your filters or search query</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default TayyariHubTimetable;
