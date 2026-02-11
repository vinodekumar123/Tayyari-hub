/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove ignoreBuildErrors to ensure build stability and better code quality
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Increase Server Actions Body Limit for PDF Uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '300mb',
    },
  },

  // Enable Image Optimization with Remote Patterns
  images: {
    unoptimized: false, // Enable optimization
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/v0/b/**',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google Auth profile pics
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
      }
    ],
  },

  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ]
  },

  // Exclude firebase-admin from client bundle (server-side only)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle firebase-admin on client side
      config.resolve.alias = {
        ...config.resolve.alias,
        'firebase-admin': false,
      };
    }
    return config;
  },
};

const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Exclude Vercel Analytics and other internal paths from SW
  buildExcludes: [/middleware-manifest\.json$/, /_vercel/],
  // Exclude external APIs from service worker caching
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/_vercel'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https:\/\/ipapi\.co\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^https:\/\/api\.ipify\.org\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\/api\/geo/,
      handler: 'NetworkOnly', // Don't cache the Geo API
    }
  ],
});

module.exports = withPWA(nextConfig);
