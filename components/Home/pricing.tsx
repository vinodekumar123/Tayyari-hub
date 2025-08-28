'use client';
import Link from 'next/link';
import { FaCheckCircle, FaTimesCircle, FaStar, FaCrown, FaRocket } from 'react-icons/fa';

const PricingSection = () => {
  return (
    <section 
      id="pricing" 
      className="relative py-24 px-6 overflow-hidden"
      style={{ backgroundColor: 'rgb(37, 99, 235)' }}
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Floating Geometric Shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-16 left-1/4 w-4 h-4 bg-white/20 rotate-45 animate-float"></div>
        <div className="absolute top-32 right-1/3 w-6 h-6 bg-white/15 rounded-full animate-float-delayed"></div>
        <div className="absolute bottom-24 left-1/3 w-5 h-5 bg-white/25 rotate-12 animate-float"></div>
        <div className="absolute bottom-40 right-1/4 w-3 h-3 bg-white/30 rounded-full animate-pulse"></div>
      </div>

      <div className="max-w-7xl mx-auto text-center relative z-10">
        {/* Header with Enhanced Typography */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-6">
            <FaStar className="text-yellow-300 text-sm" />
            <span className="text-white/90 text-sm font-medium">Pricing Plans</span>
          </div>
          
          <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
            Choose Your
            <span className="block font-black" style={{
              background: 'linear-gradient(45deg, #fde047, #f472b6, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              WebkitTextStroke: '3px white',
              textShadow: '0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.5)',
              filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.5))'
            }}>
              Success Path
            </span>
          </h2>
          
          <p className="text-xl text-blue-100 mb-4 max-w-3xl mx-auto leading-relaxed">
            Transform your preparation journey with our comprehensive learning platform
          </p>
          
          <div className="flex items-center justify-center gap-2 text-blue-200">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm">Over 10,000+ students trust us</span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
          
          {/* Free Plan - Enhanced */}
          <div className="group relative h-full flex">
            {/* Card Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-white/20 to-blue-200/20 rounded-3xl blur-xl group-hover:blur-2xl transition duration-500 opacity-0 group-hover:opacity-100"></div>
            
            <div className="relative bg-white/95 backdrop-blur-xl border border-white/30 rounded-3xl p-10 shadow-2xl hover:shadow-3xl transition-all duration-500 group-hover:-translate-y-2 w-full flex flex-col">
              {/* Plan Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg">
                <FaRocket className="text-white text-2xl" />
              </div>

              <h3 className="text-3xl font-bold text-gray-900 mb-3">Free Starter</h3>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Perfect for exploring our platform and getting started with your preparation
              </p>

              {/* Features List */}
              <ul className="space-y-5 text-left mb-8 flex-grow">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaCheckCircle className="text-green-600 text-sm" />
                  </div>
                  <div>
                    <span className="text-gray-800 font-medium">Limited Quiz Access</span>
                    <p className="text-gray-500 text-sm">Access to basic quizzes and practice materials</p>
                  </div>
                </li>
                
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaCheckCircle className="text-green-600 text-sm" />
                  </div>
                  <div>
                    <span className="text-gray-800 font-medium">MDCAT, LAT, ECAT Basics</span>
                    <p className="text-gray-500 text-sm">Essential practice for major entrance exams</p>
                  </div>
                </li>
                
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaTimesCircle className="text-red-500 text-sm" />
                  </div>
                  <div>
                    <span className="text-gray-500">No Custom Quizzes</span>
                  </div>
                </li>
                
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaTimesCircle className="text-red-500 text-sm" />
                  </div>
                  <div>
                    <span className="text-gray-500">Limited Subjects</span>
                  </div>
                </li>
              </ul>

              {/* Pricing */}
              <div className="text-center mb-8">
                <div className="text-4xl font-black text-gray-900 mb-2">FREE</div>
                <div className="text-gray-500">Forever</div>
              </div>

              {/* CTA Button */}
              <Link
                href="/auth/register"
                className="group/btn relative block w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden mt-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                <span className="relative">Start Free Journey</span>
              </Link>
            </div>
          </div>

          {/* Premium Plan - Enhanced */}
          <div className="group relative h-full flex">
            {/* Premium Badge */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                <FaCrown className="text-xs" />
                Most Popular
              </div>
            </div>

            {/* Enhanced Glow Effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400/30 via-pink-400/30 to-purple-500/30 rounded-3xl blur-2xl group-hover:blur-3xl transition duration-500 animate-pulse"></div>
            
            <div className="relative bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white rounded-3xl p-10 shadow-3xl border border-white/20 backdrop-blur-xl hover:scale-[1.02] transition-all duration-500 overflow-hidden w-full flex flex-col">
              
              {/* Premium Background Pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full blur-3xl"></div>
              </div>

              {/* Plan Icon */}
              <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-2xl">
                <FaCrown className="text-white text-2xl" />
              </div>

              <h3 className="text-3xl font-bold mb-3">Premium Pro</h3>
              <p className="text-blue-100 mb-8 text-lg leading-relaxed">
                Complete access to all features, mock tests, and advanced preparation tools
              </p>

              {/* Features List */}
              <ul className="space-y-5 text-left mb-8 flex-grow">
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-green-400/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaCheckCircle className="text-green-400 text-sm" />
                  </div>
                  <div>
                    <span className="text-white font-medium">22+ Complete Mock Tests</span>
                    <p className="text-blue-200 text-sm">Full-length practice exams with detailed analysis</p>
                  </div>
                </li>
                
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-green-400/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaCheckCircle className="text-green-400 text-sm" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Custom Quiz Creator</span>
                    <p className="text-blue-200 text-sm">Build personalized quizzes for targeted practice</p>
                  </div>
                </li>
                
                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-green-400/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaCheckCircle className="text-green-400 text-sm" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Advanced Progress Tracking</span>
                    <p className="text-blue-200 text-sm">Detailed analytics and performance insights</p>
                  </div>
                </li>

                <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-green-400/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FaCheckCircle className="text-green-400 text-sm" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Priority Support</span>
                    <p className="text-blue-200 text-sm">Get help faster with dedicated support</p>
                  </div>
                </li>
              </ul>

              {/* Pricing with Discount */}
              <div className="text-center mb-8">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="text-2xl text-blue-300 line-through">PKR 2500</span>
                  <div className="bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold">40% OFF</div>
                </div>
                <div className="text-4xl font-black text-white mb-2">PKR 1,500</div>
                <div className="text-blue-200">One-time payment • Lifetime access</div>
              </div>

              {/* Enhanced CTA Button */}
              <Link
                href="/pricing"
                className="group/btn relative block w-full px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-gray-900 font-bold rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1 overflow-hidden mt-auto"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                <span className="relative flex items-center justify-center gap-2">
                  <FaRocket className="text-sm" />
                  Upgrade to Premium
                </span>
              </Link>

              {/* Trust Indicators */}
              <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t border-white/10">
                <div className="text-center">
                  <div className="text-yellow-400 font-bold text-lg">4.9★</div>
                  <div className="text-blue-200 text-xs">User Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-bold text-lg">10K+</div>
                  <div className="text-blue-200 text-xs">Students</div>
                </div>
                <div className="text-center">
                  <div className="text-purple-400 font-bold text-lg">95%</div>
                  <div className="text-blue-200 text-xs">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Trust Section */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-red-400 rounded-full border-2 border-white"></div>
              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full border-2 border-white"></div>
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full border-2 border-white"></div>
            </div>
            <span className="text-white text-sm font-medium">
              Join 10,000+ successful students
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-15px) scale(1.1); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 4s ease-in-out infinite;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .shadow-3xl {
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </section>
  );
};

export default PricingSection;
