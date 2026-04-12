/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for Docker standalone builds.
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  // Expose only NEXT_PUBLIC_ variables at build time.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7429',
  },
};

export default nextConfig;
