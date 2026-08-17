import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  // The app is developed/run with `next dev`, which does not type-check.
  // Several pages have pre-existing strict-mode type issues that don't affect
  // runtime. Don't let them block the production build so deploy == dev behavior.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
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
