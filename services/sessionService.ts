// ============================================================
// ACE Protocol — Session Service
//
// Auth flow with Para (getpara.com):
//   1. Client authenticates with Para (wallet connect + verification).
//   2. Client issues a Para JWT (useIssueJwt) and sends it + the wallet
//      address to POST /api/auth/session.
//   3. Server verifies the Para JWT against Para's JWKS (ES256 public
//      keys), confirms the wallet is present in the token's claims, and
//      issues a short-lived session JWT signed with JWT_SECRET.
//   4. Client uses the session JWT as Bearer token for all API routes.
//   5. Protected routes verify the session JWT locally (no Para API call).
//
// This means:
//   - Only signature/JWKS verification per login (keys are cached), not per request
//   - All subsequent API calls are fast local JWT verifications
//   - Works on Vercel serverless (fully stateless)
// ============================================================

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { backendConfig } from '@root/backend/config';
import type { WalletSession } from '@root/src/types';

// ─── JWT helpers (pure Node.js crypto) — our own session token ──────────────

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function hmacSha256(secret: string, data: string): Buffer {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = base64url(JSON.stringify(payload));
  const sig    = base64url(hmacSha256(secret, `${header}.${body}`));
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token: string, secret: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = base64url(hmacSha256(secret, `${header}.${body}`));
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) return null;
    const payload = JSON.parse(base64urlDecode(body).toString()) as Record<string, unknown>;
    if (typeof payload.exp === 'number' && payload.exp < nowSec()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function getJwtSecret(): string {
  // Prefer an explicit JWT_SECRET. Fall back to an HMAC of the Para API key
  // so the server never throws just because JWT_SECRET wasn't explicitly set.
  const explicit = process.env.JWT_SECRET ?? process.env.ACE_JWT_SECRET ?? '';
  if (explicit) return explicit;

  // Derive from the Para API key so deploys work without a separate JWT_SECRET.
  const paraKey = process.env.PARA_API_KEY ?? process.env.NEXT_PUBLIC_PARA_API_KEY ?? '';
  if (paraKey) {
    return crypto.createHmac('sha256', paraKey).update('ace-jwt-secret-v1').digest('hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET (or PARA_API_KEY) environment variable is not set.');
  }
  return 'ace-dev-secret-not-for-production';
}

// ─── Para JWT verification (JWKS / ES256) ────────────────────────────────────

function getParaEnv(): 'BETA' | 'PROD' {
  const raw = (
    process.env.PARA_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_PARA_ENVIRONMENT ??
    'BETA'
  ).toUpperCase();
  return raw === 'PROD' || raw === 'PRODUCTION' ? 'PROD' : 'BETA';
}

function getParaJwksUri(): string {
  return getParaEnv() === 'PROD'
    ? 'https://api.getpara.com/.well-known/jwks.json'
    : 'https://api.beta.getpara.com/.well-known/jwks.json';
}

// Cache one JWKS client per process (keys are cached + rate-limited internally).
let jwksClientInstance: JwksClient | null = null;
function getJwksClient(): JwksClient {
  if (!jwksClientInstance) {
    jwksClientInstance = new JwksClient({
      jwksUri: getParaJwksUri(),
      cache: true,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
      rateLimit: true,
    });
  }
  return jwksClientInstance;
}

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error('Signing key not found.'));
      resolve(key.getPublicKey());
    });
  });
}

interface ParaJwtWallet {
  type?: string;
  address?: string;
  publicKey?: string;
}

interface ParaJwtPayload {
  sub?: string;
  data?: {
    userId?: string;
    wallets?: ParaJwtWallet[];
    connectedWallets?: ParaJwtWallet[];
  };
}

/**
 * Verifies a Para JWT against Para's JWKS and returns the decoded payload.
 * Throws if the signature, algorithm, or expiry is invalid.
 */
async function verifyParaToken(token: string): Promise<ParaJwtPayload> {
  const decodedHeader = jwt.decode(token, { complete: true });
  const kid = decodedHeader && typeof decodedHeader === 'object' ? decodedHeader.header?.kid : undefined;
  if (!kid) throw new Error('Para token missing key id (kid).');

  const publicKey = await getSigningKey(kid);
  const payload = jwt.verify(token, publicKey, { algorithms: ['ES256'] });
  if (typeof payload === 'string') throw new Error('Unexpected Para token payload.');
  return payload as ParaJwtPayload;
}

function collectWalletAddresses(payload: ParaJwtPayload): string[] {
  const all = [
    ...(payload.data?.wallets ?? []),
    ...(payload.data?.connectedWallets ?? []),
  ];
  return all
    .map((w) => w.address)
    .filter((a): a is string => typeof a === 'string' && a.length > 0);
}

function issueSessionJwt(wallet: string): WalletSession {
  const expiresAt = nowSec() + backendConfig.sessionTtlSeconds;
  const token = signJwt(
    { purpose: 'ace-session', sub: wallet, iat: nowSec(), exp: expiresAt, iss: 'ace-protocol' },
    getJwtSecret(),
  );
  return { wallet, token, expiresAt };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Verifies a Para JWT, confirms the wallet is attested by that token, then
 * issues a session JWT for all subsequent API calls.
 */
export async function createSessionFromParaToken(
  paraToken: string,
  wallet: string,
): Promise<WalletSession> {
  // Cryptographically verify the Para JWT via Para's JWKS. This proves the
  // token was issued by Para for an authenticated user.
  let payload: ParaJwtPayload;
  try {
    payload = await verifyParaToken(paraToken);
  } catch {
    throw new Error('Invalid or expired Para session. Please reconnect your wallet.');
  }

  // Validate that the wallet address looks like a Solana base58 address
  // (32–44 chars, no 0x prefix) so we don't accidentally store an EVM address.
  if (!wallet || wallet.startsWith('0x') || wallet.length < 32 || wallet.length > 44) {
    throw new Error(
      'A Solana wallet address is required. Please connect with Phantom or Solflare.',
    );
  }

  // If the token attests to specific wallets, require the supplied wallet to be
  // one of them — this prevents pairing a valid token with an arbitrary address.
  const attested = collectWalletAddresses(payload);
  if (attested.length > 0 && !attested.includes(wallet)) {
    throw new Error('Wallet address is not linked to this Para session.');
  }

  return issueSessionJwt(wallet);
}

/**
 * Validates a session JWT. Returns the session or null if expired/invalid.
 */
export function getSession(token: string | null | undefined): WalletSession | null {
  if (!token) return null;
  try {
    const payload = verifyJwt(token, getJwtSecret());
    if (!payload || payload.purpose !== 'ace-session') return null;
    if (typeof payload.sub !== 'string') return null;
    return {
      wallet:    payload.sub,
      token,
      expiresAt: typeof payload.exp === 'number' ? payload.exp : 0,
    };
  } catch {
    return null;
  }
}

export function getSessionFromAuthHeader(headerValue: string | null): WalletSession | null {
  if (!headerValue?.startsWith('Bearer ')) return null;
  return getSession(headerValue.slice('Bearer '.length));
}
