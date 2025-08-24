'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, Phone, Mail, AlertTriangle, CheckCircle, Eye, ArrowLeft, Globe } from 'lucide-react';

const PrivacyPolicy = () => {
  const [expandedSections, setExpandedSections] = useState({});

  const handleBackClick = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'https://tayyarihub.com';
    }
  };

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const sections = [
    {
      id: 'payment-policy',
      title: 'Payment & Refund Policy',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      content: (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2">✓ Refundable Fees</h4>
            <p className="text-green-700">All fees paid to Tayyari Hub are refundable as per our refund policy terms and conditions.</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Direct Payment Required</h4>
            <p className="text-blue-700">All payments must be made directly to our officially mentioned bank account only.</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Important Warning
            </h4>
            <p className="text-red-700">Any payment made to third-party accounts or individuals will not be the responsibility of Tayyari Hub. We will not be liable for such transactions.</p>
          </div>
        </div>
      )
    },
    {
      id: 'demo-tests',
      title: 'Demo Tests & Enrollment',
      icon: <Eye className="w-5 h-5 text-blue-600" />,
      content: (
        <div className="space-y-3">
          <p className="text-gray-700">We provide free demo tests to help you evaluate our platform before making any commitment.</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-800 mb-2">Recommendation</h4>
            <p className="text-yellow-700">We strongly recommend trying our demo tests first before enrolling in Tayyari Hub Premium or any paid plans.</p>
          </div>
        </div>
      )
    },
    {
      id: 'communication',
      title: 'Official Communication',
      icon: <Phone className="w-5 h-5 text-purple-600" />,
      content: (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 mb-3">Official Customer Care</h4>
            <div className="flex items-center gap-2 text-purple-700 font-mono text-lg">
              <Phone className="w-5 h-5" />
              <span>+923237507673</span>
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Fraud Alert
            </h4>
            <p className="text-red-700">Any communication from numbers other than +923237507673 should be considered fake and potentially fraudulent. Do not share personal or payment information with unauthorized contacts.</p>
          </div>
        </div>
      )
    },
    {
      id: 'data-collection',
      title: 'Data Collection & Usage',
      icon: <Shield className="w-5 h-5 text-indigo-600" />,
      content: (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <h4 className="font-semibold text-indigo-800 mb-2">Data Storage Purpose</h4>
            <p className="text-indigo-700">We store your data solely for identification purposes, including:</p>
            <ul className="list-disc list-inside mt-2 text-indigo-700 space-y-1">
              <li>Test results management</li>
              <li>Premium plan enrollment tracking</li>
              <li>Account verification</li>
            </ul>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2">Flexible Information Policy</h4>
            <p className="text-green-700">You may use any name or information you are comfortable with. We do not require you to provide accurate personal information if you prefer privacy.</p>
          </div>
        </div>
      )
    },
    {
      id: 'data-privacy',
      title: 'Data Privacy & Third Parties',
      icon: <Shield className="w-5 h-5 text-emerald-600" />,
      content: (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h4 className="font-semibold text-emerald-800 mb-2">No Data Selling</h4>
            <p className="text-emerald-700">We do not sell, rent, or share your personal information with any third-party applications or services.</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">Marketing Communications</h4>
            <p className="text-blue-700 mb-2">We may send you promotional emails related to Tayyari Hub services and updates.</p>
            <p className="text-blue-600 text-sm">You can easily unsubscribe from marketing emails using the unsubscribe button included in each email.</p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      {/* Back Button */}
      <button
        onClick={handleBackClick}
        className="mb-6 flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="font-medium">Back</span>
      </button>

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <div className="flex items-center justify-center gap-2 mb-2">
          <h2 className="text-xl text-blue-600 font-semibold">Tayyari Hub</h2>
          <span className="text-gray-400">|</span>
          <a 
            href="https://tayyarihub.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors duration-200"
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm">tayyarihub.com</span>
          </a>
        </div>
        <p className="text-gray-600">Your privacy and security are our top priorities</p>
        <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto mt-4 rounded-full"></div>
      </div>

      {/* Last Updated */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
        <p className="text-sm text-gray-600">
          <strong>Last Updated:</strong> 1st August 2025
        </p>
      </div>

      {/* Introduction */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8">
        <p className="text-gray-700 leading-relaxed">
          Welcome to Tayyari Hub! This Privacy Policy explains how we collect, use, and protect your information when you use our educational platform and services. We are committed to maintaining the privacy and security of your personal data.
        </p>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                {section.icon}
                <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
              </div>
              {expandedSections[section.id] ? (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
            </button>
            
            {expandedSections[section.id] && (
              <div className="px-6 py-4 bg-white border-t border-gray-100">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact Information */}
      <div className="mt-8 bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          Questions About This Policy?
        </h3>
        <p className="text-gray-700 mb-3">
          If you have any questions or concerns about this Privacy Policy, please contact us:
        </p>
        <div className="flex items-center gap-2 text-blue-600 font-semibold">
          <Phone className="w-4 h-4" />
          <span>Customer Care: +923237507673</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Remember: This is our only official contact number. Any other number claiming to represent Tayyari Hub should be considered fraudulent.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-500 border-t border-gray-200 pt-6">
        <p>© 2024 Tayyari Hub. All rights reserved.</p>
        <p className="mt-1">This Privacy Policy is effective immediately and applies to all users of our platform.</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
