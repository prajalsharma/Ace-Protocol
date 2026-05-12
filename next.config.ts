import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow native Node.js modules used in API routes (better-sqlite3, tweetnacl, bs58, etc.)
  serverExternalPackages: ['better-sqlite3', 'tweetnacl', 'bs58'],
  // Allow the Daytona/Bud preview proxy to load Next.js dev resources (fonts, HMR, stack frames).
  allowedDevOrigins: ['*.proxy.daytona.works'],
  // Use webpack instead of Turbopack to avoid inotify watch limit issues
  turbopack: undefined,
};

export default nextConfig;
