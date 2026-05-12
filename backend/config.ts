import path from 'path';
import fs from 'fs';

// On Vercel (and other serverless runtimes), process.cwd() points to a
// read-only filesystem. Use /tmp instead, which is always writable.
// The ACE_DB_PATH env var overrides everything.
function resolveDbPath(): string {
  if (process.env.ACE_DB_PATH) return process.env.ACE_DB_PATH;
  // Detect read-only CWD (Vercel Lambda environment)
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    return path.join(process.cwd(), 'backend', 'ace.sqlite');
  } catch {
    return '/tmp/ace.sqlite';
  }
}

export const backendConfig = {
  port: Number(process.env.ACE_BACKEND_PORT ?? 4011),
  host: process.env.ACE_BACKEND_HOST ?? '0.0.0.0',
  dbPath: resolveDbPath(),
  sessionTtlSeconds: Number(process.env.ACE_SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7),
  nonceTtlSeconds: Number(process.env.ACE_NONCE_TTL_SECONDS ?? 60 * 10),
  defaultSolPriceUsd: Number(process.env.ACE_DEFAULT_SOL_PRICE_USD ?? 148),
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC ?? 'https://api.devnet.solana.com',
  x402Allowlist: (process.env.ACE_X402_ALLOWLIST ?? 'api.openai.com,api.anthropic.com,api.helius.xyz')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
};
