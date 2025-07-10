/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true, // ✅ This tells Vercel to skip type checking during build
  },
  images: { 
    unoptimized: true 
  },
  optimizeFonts: false,
};

module.exports = nextConfig;
