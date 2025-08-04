'use client';

import Link from 'next/link';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

const PricingSection = () => {
  return (
    <section id="pricing" className="bg-gradient-to-br from-gray-50 to-white py-20 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-lg text-gray-600 mb-14 max-w-2xl mx-auto">
          Whether you're just starting or ready to unlock everything — choose a plan that suits your journey.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition duration-300">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Free Plan</h3>
            <p className="text-gray-500 mb-6">Basic access to quizzes — perfect for beginners.</p>

            <ul className="space-y-4 text-left text-sm text-gray-700 mb-6">
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500" />
                Access to Few quizzes
              </li>
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-green-500" />
                Practice MDCAT, LAT, ECAT basics
              </li>
              <li className="flex items-center gap-2">
                <FaTimesCircle className="text-red-400" />
                No custom quizzes
              </li>
              <li className="flex items-center gap-2">
                <FaTimesCircle className="text-red-400" />
                Limited subjects
              </li>
            </ul>

            <div className="text-3xl font-bold text-blue-600 mb-4">Free</div>

            <Link
              href="/auth/register"
              className="block text-center w-full px-6 py-3 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 transition"
            >
              Get Started
            </Link>
          </div>

          {/* Premium Plan */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-3xl p-8 shadow-2xl border-2 border-blue-500 relative overflow-hidden hover:scale-[1.01] transition-transform duration-300">
            <div className="absolute top-4 right-4 bg-white text-blue-700 text-xs px-3 py-1 rounded-full font-semibold shadow">
              Most Popular
            </div>

            <h3 className="text-2xl font-bold mb-2">Premium Plan</h3>
            <p className="text-blue-100 mb-6">Unlock full potential with unlimited access and custom tools.</p>

            <ul className="space-y-4 text-left text-sm text-white/90 mb-6">
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-white" />
                Unlimited quizzes
              </li>
            
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-white" />
                Create custom quizzes
              </li>
              <li className="flex items-center gap-2">
                <FaCheckCircle className="text-white" />
                Track your progress
              </li>
            </ul>

            <div className="text-3xl font-bold mb-4">PKR 1500</div>

            <Link
              href="/pricing"
              className="block text-center w-full px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-100 transition"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
