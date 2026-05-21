/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
