import type { NextConfig } from "next";
import path from "path";

// Para's react-sdk statically pulls in its Cosmos wallet connector, which
// imports the optional `graz` peer dependency. ACE only uses Para's Solana
// connector (no cosmosConnector config is ever passed), so the Cosmos path is
// never activated at runtime — but the bundler still needs `graz` to resolve.
// Alias it to an empty stub so the build succeeds without the Cosmos stack.
const grazStubAbs = path.resolve(__dirname, "stubs/graz.cjs");

const nextConfig: NextConfig = {
  // Allow native Node.js modules used in API routes (better-sqlite3, tweetnacl, bs58, etc.)
  serverExternalPackages: ['better-sqlite3', 'tweetnacl', 'bs58'],
  // Allow the Daytona/Bud preview proxy to load Next.js dev resources (fonts, HMR, stack frames).
  allowedDevOrigins: ['*.proxy.daytona.works'],
  turbopack: {
    // Turbopack wants a project-root-relative path here (absolute paths are
    // misread as server-relative imports).
    resolveAlias: {
      graz: "./stubs/graz.cjs",
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = { ...(config.resolve.alias ?? {}), graz: grazStubAbs };
    return config;
  },
};

export default nextConfig;
