import type { NextConfig } from "next";
import path from "path";

// Para's react-sdk statically references its Cosmos wallet connector (which in
// turn needs the optional `graz` peer dep). ACE only uses Para's Solana
// connector, so we neutralise the entire Cosmos stack: aliasing
// `@getpara/cosmos-wallet-connectors` to an empty module makes Para's dynamic
// loader receive no `allWallets` and cleanly disable Cosmos. `graz` is aliased
// too as a safety net. Without this the Cosmos connector loads with malformed
// (graz-less) wallet factories and crashes at runtime even for Solana-only use.
const emptyStubAbs = path.resolve(__dirname, "stubs/empty.cjs");

const nextConfig: NextConfig = {
  // Allow native Node.js modules used in API routes (better-sqlite3, tweetnacl, bs58, etc.)
  serverExternalPackages: ['better-sqlite3', 'tweetnacl', 'bs58'],
  // Allow the Daytona/Bud preview proxy to load Next.js dev resources (fonts, HMR, stack frames).
  allowedDevOrigins: ['*.proxy.daytona.works'],
  turbopack: {
    // Turbopack wants project-root-relative paths here (absolute paths are
    // misread as server-relative imports).
    resolveAlias: {
      graz: "./stubs/empty.cjs",
      "@getpara/cosmos-wallet-connectors": "./stubs/empty.cjs",
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      graz: emptyStubAbs,
      "@getpara/cosmos-wallet-connectors": emptyStubAbs,
    };
    return config;
  },
};

export default nextConfig;
