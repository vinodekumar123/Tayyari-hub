          import Link from 'next/link'; // Make sure this is at the top of the file

const PricingSection = () => {
  return (
    <section id="pricing" className="bg-gray-50 py-20 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-gray-600 mb-12">
          Whether you're just starting or want full access — we’ve got a plan for you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Plan */}
          <div className="bg-white rounded-2xl shadow p-8 text-left border border-gray-200">
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">Free Plan</h3>
            <p className="text-gray-500 mb-6">Get started with basic access to 10 quizzes.</p>
            <ul className="space-y-3 text-sm text-gray-700 mb-6">
              <li>✅ Access to 10 quizzes</li>
              <li>✅ Practice MDCAT, LAT, ECAT basics</li>
              <li>❌ No custom quizzes</li>
              <li>❌ Limited subjects</li>
            </ul>
            <div className="text-3xl font-bold text-blue-600 mb-4">Free</div>
            <a
              href="#"
              className="block text-center px-6 py-3 bg-blue-100 text-blue-700 font-medium rounded-xl hover:bg-blue-200 transition"
            >
              Get Started
            </a>
          </div>

          {/* Paid Plan */}
          <div className="bg-blue-600 text-white rounded-2xl shadow-lg p-8 text-left">
            <h3 className="text-2xl font-semibold mb-2">Premium Plan</h3>
            <p className="text-blue-100 mb-6">Unlock unlimited access, all subjects & custom quizzes.</p>
            <ul className="space-y-3 text-sm mb-6">
              <li>✅ Unlimited quizzes</li>
              <li>✅ All subjects included</li>
              <li>✅ Create custom quizzes</li>
              <li>✅ Full progress tracking</li>
            </ul>
            <div className="text-3xl font-bold mb-4">PKR 2000</div>
<Link
  href="/pricing"
  className="block text-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-100 transition"
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
