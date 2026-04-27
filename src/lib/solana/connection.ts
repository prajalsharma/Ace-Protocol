// ============================================================
// ACE Protocol — Solana Connection Singleton
// ============================================================

import { Connection, clusterApiUrl } from '@solana/web3.js';

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl('devnet');

export const connection = new Connection(RPC, 'confirmed');

export const USDC_DEVNET_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
