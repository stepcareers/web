/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable when needed:
    // typedRoutes: true,
  },
  // Run env validation on every build to fail-fast on missing keys.
  webpack: (config) => config,
};

export default nextConfig;
