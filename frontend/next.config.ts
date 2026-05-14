import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '100gb',
    },
  },
  // Allow large file uploads
  api: {
    bodyParser: {
      sizeLimit: '100gb',
    },
    responseLimit: false,
  },
};

export default nextConfig;
