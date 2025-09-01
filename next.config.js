/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Export static pages cleanly (we only rely on client-side fetch for Sheets)
  output: 'standalone',
  images: { unoptimized: true }
};

module.exports = nextConfig;