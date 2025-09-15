"use client";
import React, { useState, useMemo } from 'react';
import { Calendar, Filter, BookOpen, Users } from 'lucide-react';

const TestSchedule = () => {
  // Available tests data
  const availableTests = [
    { name: 'BIOLOGY XI', tests: 2, mcqs: 100, subject: 'Biology', class: 'XI', type: 'Subject', free: true },
    { name: 'CHEMISTRY XI', tests: 2, mcqs: 100, subject: 'Chemistry', class: 'XI', type: 'Subject', free: false },
    { name: 'PHYSICS XI', tests: 2, mcqs: 100, subject: 'Physics', class: 'XI', type: 'Subject', free: false },
    { name: 'WHOLE XI SYLLABUS', tests: 2, mcqs: 180, subject: 'All', class: 'XI', type: 'Complete', free: true },
    { name: 'BIOLOGY XII', tests: 2, mcqs: 100, subject: 'Biology', class: 'XII', type: 'Subject', free: false },
    { name: 'CHEMISTRY XII', tests: 2, mcqs: 100, subject: 'Chemistry', class: 'XII', type: 'Subject', free: false },
    { name: 'PHYSICS XII', tests: 2, mcqs: 100, subject: 'Physics', class: 'XII', type: 'Subject', free: false },
    { name: 'WHOLE XII SYLLABUS', tests: 2, mcqs: 180, subject: 'All', class: 'XII', type: 'Complete', free: false },
    { name: 'FULL-LENGTH PAPER (FLP) MOCKS XI', tests: 1, mcqs: 180, subject: 'All', class: 'XI', type: 'Mock', free: true },
    { name: 'FULL-LENGTH PAPER (FLP) MOCK', tests: 1, mcqs: 180, subject: 'All', class: 'XI & XII', type: 'Mock', free: true }
  ];

  // Upcoming tests data
  const upcomingTests = [
    { name: 'HALF XI', date: '17 SEP', mcqs: 180, type: 'Half', class: 'XI', free: false },
    { name: 'FULL XI', date: '20 SEP', mcqs: 180, type: 'Full', class: 'XI', free: false },
    { name: 'HALF XII', date: '23 SEP', mcqs: 180, type: 'Half', class: 'XII', free: false },
    { name: 'FULL XII', date: '26 SEP', mcqs: 180, type: 'Full', class: 'XII', free: false },
    { name: 'FLP-2', date: '30 SEP', mcqs: 180, type: 'Mock', class: 'XI & XII', free: false },
    { name: 'FLP-3', date: '04 OCT', mcqs: 180, type: 'Mock', class: 'XI & XII', free: false },
    { name: 'FLP-4', date: '08 OCT', mcqs: 180, type: 'Mock', class: 'XI & XII', free: false },
    { name: 'FLP-5', date: '12 OCT', mcqs: 180, type: 'Mock', class: 'XI & XII', free: false },
    { name: 'FLP-6', date: '17 OCT', mcqs: 180, type: 'Mock', class: 'XI & XII', free: false }
  ];

  // Filter states
  const [filters, setFilters] = useState({
    subject: 'All',
    class: 'All',
    type: 'All',
    payment: 'All',
    showAvailable: true,
    showUpcoming: true
  });

  // Filter options
  const subjects = ['All', 'Biology', 'Chemistry', 'Physics'];
  const classes = ['All', 'XI', 'XII'];
  const types = ['All', 'Subject', 'Complete', 'Mock', 'Half', 'Full'];
  const paymentOptions = ['All', 'Free', 'Paid'];

  // Filtered data
  const filteredAvailable = useMemo(() => {
    return availableTests.filter(test => {
      if (filters.subject !== 'All' && test.subject !== filters.subject) return false;
      if (filters.class !== 'All' && test.class !== filters.class) return false;
      if (filters.type !== 'All' && test.type !== filters.type) return false;
      if (filters.payment === 'Free' && !test.free) return false;
      if (filters.payment === 'Paid' && test.free) return false;
      return true;
    });
  }, [filters]);

  const filteredUpcoming = useMemo(() => {
    return upcomingTests.filter(test => {
      if (filters.class !== 'All' && test.class !== filters.class) return false;
      if (filters.type !== 'All' && test.type !== filters.type) return false;
      if (filters.payment === 'Free' && !test.free) return false;
      if (filters.payment === 'Paid' && test.free) return false;
      return true;
    });
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getSubjectColor = (subject) => {
    const colors = {
      Biology: 'bg-green-100 text-green-800',
      Chemistry: 'bg-orange-100 text-orange-800',
      Physics: 'bg-blue-100 text-blue-800',
      All: 'bg-purple-100 text-purple-800'
    };
    return colors[subject] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">TAYYARI HUB TEST SERIES</h1>
        <p className="text-lg text-gray-600">Test Schedule & Filters</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select 
              value={filters.subject} 
              onChange={(e) => updateFilter('subject', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select 
              value={filters.class} 
              onChange={(e) => updateFilter('class', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {classes.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select 
              value={filters.type} 
              onChange={(e) => updateFilter('type', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {types.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment</label>
            <select 
              value={filters.payment} 
              onChange={(e) => updateFilter('payment', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {paymentOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="showAvailable" 
              checked={filters.showAvailable}
              onChange={(e) => updateFilter('showAvailable', e.target.checked)}
              className="mr-2 rounded focus:ring-blue-500"
            />
            <label htmlFor="showAvailable" className="text-sm font-medium text-gray-700">Show Available</label>
          </div>

          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="showUpcoming" 
              checked={filters.showUpcoming}
              onChange={(e) => updateFilter('showUpcoming', e.target.checked)}
              className="mr-2 rounded focus:ring-blue-500"
            />
            <label htmlFor="showUpcoming" className="text-sm font-medium text-gray-700">Show Upcoming</label>
          </div>
        </div>
      </div>

      {/* Available Tests */}
      {filters.showAvailable && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            OUR AVAILABLE TESTS ({filteredAvailable.length})
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">TEST NAME</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">NO. OF TESTS</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">NO. OF MCQS</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">SUBJECT</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">CLASS</th>
                  <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700">FREE/PAID</th>
                </tr>
              </thead>
              <tbody>
                {filteredAvailable.map((test, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="border border-gray-300 px-4 py-3 font-medium">{test.name}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{test.tests}</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">{test.mcqs} IN EACH</td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSubjectColor(test.subject)}`}>
                        {test.subject}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                        {test.class}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-3 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        test.free ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {test.free ? '1 Free' : 'Paid'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming Tests */}
      {filters.showUpcoming && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            OUR UPCOMING TESTS ({filteredUpcoming.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUpcoming.map((test, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-800 text-lg">{test.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    test.free ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {test.free ? 'FREE' : 'PAID'}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span className="font-medium">{test.date}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{test.mcqs} MCQs</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      test.type === 'Mock' ? 'bg-purple-100 text-purple-800' :
                      test.type === 'Half' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {test.type}
                    </span>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                      Class {test.class}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestSchedule;
