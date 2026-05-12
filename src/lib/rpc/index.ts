// ============================================================
// ACE Protocol — Network-Aware RPC Connection Layer
//
// Provides Connection instances for both mainnet and devnet,
// and a helper to select the right one based on the active network.
// ============================================================

import { Connection, clusterApiUrl } from '@solana/web3.js';
import type { SolanaNetwork } from '@/lib/store/useProtocolStore';

// ── RPC endpoint resolution ───────────────────────────────────────────────────

export const MAINNET_RPC_URL: string =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ||
      process.env.NEXT_PUBLIC_SOLANA_RPC)) ||
  clusterApiUrl('mainnet-beta');

export const DEVNET_RPC_URL: string =
  (typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC) ||
  clusterApiUrl('devnet');

// ── Singleton connections ─────────────────────────────────────────────────────
// We keep one connection per network so callers share websocket subscriptions
// and connection pool.

let _mainnetConnection: Connection | null = null;
let _devnetConnection: Connection | null = null;

export function getMainnetConnection(): Connection {
  if (!_mainnetConnection) {
    _mainnetConnection = new Connection(MAINNET_RPC_URL, 'confirmed');
  }
  return _mainnetConnection;
}

export function getDevnetConnection(): Connection {
  if (!_devnetConnection) {
    _devnetConnection = new Connection(DEVNET_RPC_URL, 'confirmed');
  }
  return _devnetConnection;
}

/**
 * Returns the Connection for the given network.
 * Use this everywhere instead of the old `connection` singleton from
 * `src/lib/solana/connection.ts` so that mainnet/devnet is respected.
 */
export function getConnection(network: SolanaNetwork): Connection {
  return network === 'mainnet' ? getMainnetConnection() : getDevnetConnection();
}

/**
 * Returns the RPC URL string for the given network.
 * Useful for constructing Helius API endpoints or passing to Anchor.
 */
export function getRpcUrl(network: SolanaNetwork): string {
  return network === 'mainnet' ? MAINNET_RPC_URL : DEVNET_RPC_URL;
}

/**
 * Returns the Solana Explorer base URL for the given network.
 * Mainnet has no cluster param; devnet uses ?cluster=devnet.
 */
export function getExplorerBase(network: SolanaNetwork): string {
  return network === 'mainnet'
    ? 'https://explorer.solana.com'
    : 'https://explorer.solana.com?cluster=devnet';
}

/**
 * Returns a Solana Explorer URL for an address on the given network.
 */
export function getExplorerAddressUrl(address: string, network: SolanaNetwork): string {
  const cluster = network === 'mainnet' ? '' : '?cluster=devnet';
  return `https://explorer.solana.com/address/${address}${cluster}`;
}

/**
 * Returns a Solana Explorer URL for a transaction signature on the given network.
 */
export function getExplorerTxUrl(signature: string, network: SolanaNetwork): string {
  const cluster = network === 'mainnet' ? '' : '?cluster=devnet';
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

// ── USDC mint addresses ───────────────────────────────────────────────────────

/** Mainnet USDC mint (Circle) */
export const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** Devnet USDC mint (commonly used test token) */
export const USDC_DEVNET_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

export function getUsdcMint(network: SolanaNetwork): string {
  return network === 'mainnet' ? USDC_MAINNET_MINT : USDC_DEVNET_MINT;
}
