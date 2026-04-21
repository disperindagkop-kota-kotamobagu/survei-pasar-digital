/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // In Next.js 16, experimental.serverComponentsExternalPackages moved to top level
  serverExternalPackages: ['@supabase/supabase-js'],
  // Turbopack is default in Next 16. If using custom webpack, we need to handle it.
  // Since our webpack extension was empty/standard, we can just allow Turbopack.
  // Or explicitly set an empty turbopack config to silence the error.
  turbopack: {},
};

module.exports = nextConfig;
