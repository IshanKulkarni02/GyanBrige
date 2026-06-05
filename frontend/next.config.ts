import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25gb',
    },
  },
  // Large bodies handled per-route via export const config = { api: { bodyParser: false } }
  // The `api` key at the top level is not supported in Next.js 13+ App Router —
  // body size is controlled per route via the runtime itself.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
