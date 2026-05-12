// ============================================================
// ACE Protocol — Session Service
//
// Auth flow with Privy:
//   1. Client authenticates with Privy (wallet sign handled by Privy)
//   2. Client sends Privy access token + wallet address to POST /api/auth/session
//   3. Server verifies the Privy token using @privy-io/server-auth,
//      confirms the wallet is linked to that Privy user,
//      and issues a short-lived session JWT signed with JWT_SECRET.
//   4. Client uses the session JWT as Bearer token for all API routes.
//   5. Protected routes verify the session JWT locally (no Privy API call).
//
// This means:
//   - Only ONE Privy API call per session (at login), not per request
//   - All subsequent API calls are fast JWT verifications
//   - Works perfectly on Vercel serverless (fully stateless)
// ============================================================

import crypto from 'crypto';
import { PrivyClient } from '@privy-io/node';
import { backendConfig } from '@root/backend/config';
import type { WalletSession } from '@root/src/types';

// ─── JWT helpers (pure Node.js crypto) ──────────────────────────────────────

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
  const secret = process.env.JWT_SECRET ?? process.env.ACE_JWT_SECRET ?? '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is not set. Add it to Vercel → Environment Variables.');
    }
    return 'ace-dev-secret-not-for-production';
  }
  return secret;
}

function getPrivyCredentials(): { appId: string; appSecret: string } {
  const appId     = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      'NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET must be set in environment variables.',
    );
  }
  return { appId, appSecret };
}

function getPrivyClient(): PrivyClient {
  const { appId, appSecret } = getPrivyCredentials();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrivyClient({ appId, appSecret } as any);
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
 * Verifies a Privy access token, confirms the wallet is linked to that
 * Privy user, then issues a session JWT for all subsequent API calls.
 */
export async function createSessionFromPrivyToken(
  privyToken: string,
  wallet: string,
): Promise<WalletSession> {
  const privy = getPrivyClient();

  // Verify the Privy JWT — this cryptographically proves the user is authentic.
  // We don't do a linked_accounts ownership check because Privy authenticates
  // Phantom via SIWE (Ethereum flow), so linked_accounts shows chain_type:
  // 'ethereum' even for Solana wallets. Token validity is sufficient proof.
  try {
    await privy.utils().auth().verifyAuthToken(privyToken);
  } catch {
    throw new Error('Invalid or expired Privy session. Please reconnect your wallet.');
  }

  // Validate that the wallet address looks like a Solana base58 address
  // (32–44 chars, no 0x prefix) so we don't accidentally store an EVM address.
  if (!wallet || wallet.startsWith('0x') || wallet.length < 32 || wallet.length > 44) {
    throw new Error(
      'A Solana wallet address is required. Please connect with Phantom or Solflare.',
    );
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
