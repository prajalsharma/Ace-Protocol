// ============================================================
// ACE Protocol — Session Service
//
// Auth flow (Sign-In With Solana, SIWS):
//   1. Client connects an external wallet via Para (connection only — Para's
//      own verification/session machinery is bypassed).
//   2. Client GETs a sign-in challenge from /api/auth/nonce?wallet=… — a
//      message plus an HMAC-signed, time-stamped nonce (stateless).
//   3. The wallet signs the message; client POSTs { wallet, nonce, iat,
//      nonceSig, signature } to /api/auth/session.
//   4. Server re-derives the nonce HMAC (proves we issued it), checks freshness,
//      verifies the ed25519 signature against the wallet's public key, and
//      issues a short-lived session JWT signed with JWT_SECRET.
//   5. Protected routes verify the session JWT locally (no external calls).
//
// Fully stateless — works on serverless (Vercel) with no nonce store.
// ============================================================

import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { backendConfig } from '@root/backend/config';
import type { WalletSession } from '@root/src/types';

// ─── Session JWT helpers (pure Node.js crypto, HS256) ────────────────────────

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
  // Prefer an explicit JWT_SECRET. Fall back to an HMAC of the Para API key so
  // the server never throws just because JWT_SECRET wasn't explicitly set.
  const explicit = process.env.JWT_SECRET ?? process.env.ACE_JWT_SECRET ?? '';
  if (explicit) return explicit;

  const paraKey = process.env.PARA_API_KEY ?? process.env.NEXT_PUBLIC_PARA_API_KEY ?? '';
  if (paraKey) {
    return crypto.createHmac('sha256', paraKey).update('ace-jwt-secret-v1').digest('hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET (or PARA_API_KEY) environment variable is not set.');
  }
  return 'ace-dev-secret-not-for-production';
}

function isValidSolanaAddress(wallet: string): boolean {
  if (!wallet || wallet.startsWith('0x') || wallet.length < 32 || wallet.length > 44) return false;
  try {
    return bs58.decode(wallet).length === 32;
  } catch {
    return false;
  }
}

function issueSessionJwt(wallet: string): WalletSession {
  const expiresAt = nowSec() + backendConfig.sessionTtlSeconds;
  const token = signJwt(
    { purpose: 'ace-session', sub: wallet, iat: nowSec(), exp: expiresAt, iss: 'ace-protocol' },
    getJwtSecret(),
  );
  return { wallet, token, expiresAt };
}

// ─── Sign-In With Solana (SIWS) ───────────────────────────────────────────────

const APP_URI =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  'https://ace-protocol.vercel.app';

export interface SignInChallenge {
  message: string;
  nonce: string;
  iat: number;
  nonceSig: string;
}

function buildSignInMessage(wallet: string, nonce: string, iat: number): string {
  return [
    'Sign this message to verify your wallet ownership.',
    '',
    `URI: ${APP_URI}`,
    `Chain ID: mainnet-beta`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(iat * 1000).toISOString()}`,
    `Wallet: ${wallet}`,
  ].join('\n');
}

function nonceSignature(wallet: string, nonce: string, iat: number): string {
  return crypto
    .createHmac('sha256', getJwtSecret())
    .update(`${wallet}.${nonce}.${iat}`)
    .digest('hex');
}

/**
 * Issues a stateless sign-in challenge for a wallet. The nonce is HMAC-signed
 * with the server secret so we can later confirm we issued it without storage.
 */
export function issueSignInChallenge(wallet: string): SignInChallenge {
  if (!isValidSolanaAddress(wallet)) {
    throw new Error('A valid Solana wallet address is required.');
  }
  const iat = nowSec();
  const nonce = crypto.randomBytes(16).toString('hex');
  return {
    message: buildSignInMessage(wallet, nonce, iat),
    nonce,
    iat,
    nonceSig: nonceSignature(wallet, nonce, iat),
  };
}

/**
 * Verifies a signed sign-in challenge and issues a session JWT.
 * Confirms: (a) we issued the nonce, (b) it's fresh, (c) the ed25519 signature
 * over the reconstructed message is valid for the wallet's public key.
 */
export function createSessionFromSignature(params: {
  wallet: string;
  nonce: string;
  iat: number;
  nonceSig: string;
  signature: string;
}): WalletSession {
  const { wallet, nonce, iat, nonceSig, signature } = params;

  if (!isValidSolanaAddress(wallet)) {
    throw new Error('A valid Solana wallet address is required. Connect with Phantom or Solflare.');
  }

  // 1. Confirm the nonce was issued by this server (untampered).
  const expectedSig = nonceSignature(wallet, nonce, iat);
  if (
    expectedSig.length !== nonceSig.length ||
    !crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(nonceSig))
  ) {
    throw new Error('Invalid or tampered sign-in challenge. Please reconnect.');
  }

  // 2. Freshness — reject stale challenges (replay window).
  if (!Number.isFinite(iat) || nowSec() - iat > backendConfig.nonceTtlSeconds) {
    throw new Error('Sign-in challenge expired. Please try again.');
  }

  // 3. Verify the ed25519 signature over the exact message we would have issued.
  const message = buildSignInMessage(wallet, nonce, iat);
  const messageBytes = new TextEncoder().encode(message);
  let verified = false;
  try {
    verified = nacl.sign.detached.verify(
      messageBytes,
      bs58.decode(signature),
      bs58.decode(wallet),
    );
  } catch {
    verified = false;
  }
  if (!verified) {
    throw new Error('Signature verification failed. Please reconnect your wallet.');
  }

  return issueSessionJwt(wallet);
}

// ─── Session validation ───────────────────────────────────────────────────────

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
