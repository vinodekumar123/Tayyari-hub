'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

export default function DashboardShowcase() {
  const screenshots = [
    {
      src: '/screenshots/dashboard-overview.png',
      alt: 'Student dashboard overview',
    },
    {
      src: '/screenshots/dashboard-quiz.png',
      alt: 'Live quiz interface',
    },
  ];

  return (
    <section className="relative w-full py-16 sm:py-24 bg-gray-50 overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none" />

      <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            See Your Dashboard in Action
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600">
            A glimpse of the intuitive experience you get instantly after onboarding.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {screenshots.map((shot, idx) => (
            <motion.div
              key={shot.src}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: idx * 0.2 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-shadow bg-white"
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={1000}
                height={600}
                className="w-full h-auto object-cover"
                priority={idx === 0}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
