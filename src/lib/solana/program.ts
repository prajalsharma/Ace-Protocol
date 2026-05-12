// ============================================================
// ACE Protocol — On-Chain Program Constants & PDA Helpers
// Program ID: DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY (devnet)
// ============================================================

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const ACE_PROGRAM_ID = new PublicKey(
  'DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY',
);

// ── PDA derivation ───────────────────────────────────────────────────────────

export async function findProtocolConfigPDA(): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('protocol_config')],
    ACE_PROGRAM_ID,
  ) as unknown as [PublicKey, number];
}

export function findVaultPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    ACE_PROGRAM_ID,
  );
}

export function findPaymentPDA(
  vault: PublicKey,
  paymentId: number,
): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(BigInt(paymentId));
  return PublicKey.findProgramAddressSync(
    [Buffer.from('payment'), vault.toBuffer(), idBuf],
    ACE_PROGRAM_ID,
  );
}

// ── Raw account layout readers ────────────────────────────────────────────────
// Matches the on-chain structs in state.rs (little-endian, after 8-byte Anchor discriminator)

export interface OnChainVault {
  owner: PublicKey;
  status: number;        // 0=active 1=paused 2=closed
  yieldBalance: bigint;
  reserveBalance: bigint;
  liquidBalance: bigint;
  paymentsBalance: bigint;
  yieldAlloc: number;    // bps out of 10000
  reserveAlloc: number;
  liquidAlloc: number;
  paymentsAlloc: number;
  operationMode: number; // 0=safe 1=autopilot
  aiPaymentCap: bigint;  // lamports
  createdAt: bigint;
  lastRebalancedAt: bigint;
  bump: number;
}

export interface OnChainPayment {
  vault: PublicKey;
  owner: PublicKey;
  recipient: PublicKey;
  amount: bigint;
  status: number;        // 0=pending 1=scheduled 2=executed 3=cancelled
  kind: number;          // 0=scheduled 1=x402 2=manual
  priority: number;      // 0=low 1=medium 2=high
  dueAt: bigint;
  scheduledAt: bigint;
  executedAt: bigint;
  maxSpend: bigint;
  approved: boolean;
  bump: number;
}

// Read a vault PDA account and decode it
export async function fetchVaultAccount(
  connection: Connection,
  owner: PublicKey,
): Promise<OnChainVault | null> {
  try {
    const [vaultPda] = findVaultPDA(owner);
    const info = await connection.getAccountInfo(vaultPda);
    if (!info || info.data.length < 8) return null;

    // Skip 8-byte Anchor discriminator
    const buf = Buffer.from(info.data.subarray(8));
    let offset = 0;

    const vaultOwner = new PublicKey(buf.subarray(offset, offset + 32)); offset += 32;
    const status = buf.readUInt8(offset); offset += 1;
    const yieldBalance = buf.readBigUInt64LE(offset); offset += 8;
    const reserveBalance = buf.readBigUInt64LE(offset); offset += 8;
    const liquidBalance = buf.readBigUInt64LE(offset); offset += 8;
    const paymentsBalance = buf.readBigUInt64LE(offset); offset += 8;
    const yieldAlloc = buf.readUInt16LE(offset); offset += 2;
    const reserveAlloc = buf.readUInt16LE(offset); offset += 2;
    const liquidAlloc = buf.readUInt16LE(offset); offset += 2;
    const paymentsAlloc = buf.readUInt16LE(offset); offset += 2;
    const operationMode = buf.readUInt8(offset); offset += 1;
    const aiPaymentCap = buf.readBigUInt64LE(offset); offset += 8;
    const createdAt = buf.readBigInt64LE(offset); offset += 8;
    const lastRebalancedAt = buf.readBigInt64LE(offset); offset += 8;
    const bump = buf.readUInt8(offset);

    return {
      owner: vaultOwner,
      status,
      yieldBalance,
      reserveBalance,
      liquidBalance,
      paymentsBalance,
      yieldAlloc,
      reserveAlloc,
      liquidAlloc,
      paymentsAlloc,
      operationMode,
      aiPaymentCap,
      createdAt,
      lastRebalancedAt: lastRebalancedAt as unknown as bigint,
      bump,
    };
  } catch {
    return null;
  }
}

// Convert on-chain vault data to the app's Vault type
export function onChainVaultToAppVault(
  raw: OnChainVault,
  solPriceUsd: number,
): {
  totalUsd: number;
  yieldUsd: number;
  reserveUsd: number;
  liquidUsd: number;
  paymentsUsd: number;
  operationMode: 'safe' | 'autopilot';
  aiPaymentCapUsd: number;
  createdAt: number;
  lastRebalancedAt: number;
} {
  const lamportsToUsd = (lamps: bigint) =>
    (Number(lamps) / LAMPORTS_PER_SOL) * solPriceUsd;

  return {
    totalUsd:
      lamportsToUsd(raw.yieldBalance) +
      lamportsToUsd(raw.reserveBalance) +
      lamportsToUsd(raw.liquidBalance) +
      lamportsToUsd(raw.paymentsBalance),
    yieldUsd: lamportsToUsd(raw.yieldBalance),
    reserveUsd: lamportsToUsd(raw.reserveBalance),
    liquidUsd: lamportsToUsd(raw.liquidBalance),
    paymentsUsd: lamportsToUsd(raw.paymentsBalance),
    operationMode: raw.operationMode === 1 ? 'autopilot' : 'safe',
    aiPaymentCapUsd: lamportsToUsd(raw.aiPaymentCap),
    createdAt: Number(raw.createdAt),
    lastRebalancedAt: Number(raw.lastRebalancedAt),
  };
}
