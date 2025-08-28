'use client';

import { FaWhatsapp } from 'react-icons/fa';

const groups = [
  {
    name: 'MDCAT Group 1',
    link: 'https://chat.whatsapp.com/Ll5ELlM2jSKEYpm7SA4iXN?mode=ac_t',
  },
  {
    name: 'MDCAT Group 2',
    link: 'https://chat.whatsapp.com/BxkM0COhAoV9YpsxdaMfzu?mode=ac_t',
  },
  {
    name: 'MDCAT Group 3',
    link: 'https://chat.whatsapp.com/CoU5mXmKb9EFSwmeY9UT0C?mode=ac_t',
  },
  {
    name: 'MDCAT Group 4',
    link: 'https://chat.whatsapp.com/EQ0fca2YBSE1lEkKXwP0wR?mode=ac_t',
  },
  {
    name: 'MDCAT Group 5',
    link: 'https://chat.whatsapp.com/L0tvdVnpMSd3zCZD94vtZr?mode=ac_t',
  },
];

export default function WhatsappInviteSection() {
  return (
    <section
      id="whatsapp"
      className="relative bg-gradient-to-br from-white to-green-50 py-20 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      <div className="absolute top-[-100px] left-[-80px] w-72 h-72 bg-green-200 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-[-100px] right-[-80px] w-72 h-72 bg-green-100 rounded-full blur-3xl opacity-20" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 shadow-md mb-6 mx-auto animate-bounce-slow">
          <FaWhatsapp className="text-4xl" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Join Our MDCAT WhatsApp Groups
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10">
          Get daily updates, expert guidance, peer discussions, and preparation tips — all in one place, directly on WhatsApp.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-6">
          {groups.map((group, index) => (
            <a
              key={index}
              href={group.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white/70 backdrop-blur-lg border border-green-100 p-5 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 text-green-600 rounded-full">
                    <FaWhatsapp className="text-xl" />
                  </div>
                  <span className="font-semibold text-gray-800 text-base">
                    {group.name}
                  </span>
                </div>
                <span className="text-green-600 font-semibold text-sm group-hover:underline">
                  Join
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
