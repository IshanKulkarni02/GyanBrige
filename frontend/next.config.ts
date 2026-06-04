import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25gb',
    },
  },
  // Allow large multipart bodies for Route Handlers (video upload)
  // Each chunk sent to /api/upload is 10 MB so this must be > chunk size
  api: {
    bodyParser: {
      sizeLimit: '25gb',
    },
    responseLimit: false,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
