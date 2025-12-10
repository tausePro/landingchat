import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'tez.com.co',
      },
      {
        protocol: 'https',
        hostname: '**.gravatar.com',
      },
    ],
  },
};

export default nextConfig;
