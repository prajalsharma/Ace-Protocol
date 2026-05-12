import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── Cloak SDK Private Transfer API ──────────────────────────────────────────
// Handles shielded transfer construction and viewing key generation.
// In MVP: constructs the intent and returns a viewing key.
// Production: would call Cloak SDK to construct ZK proof + shielded tx.

interface PrivateTransferRequest {
  recipient: string;
  amountUsd: number;
  token: 'USDC' | 'USDT' | 'SOL';
  label: string;
  note?: string;
  viewingKey?: string;
  wallet: string;
}

interface PrivateTransferResponse {
  ok: boolean;
  txId: string;
  viewingKey: string;
  shieldedAmount: boolean;
  status: 'shielded' | 'pending' | 'failed';
  cloakVersion: string;
}

function deriveViewingKey(wallet: string, recipient: string, amount: number, timestamp: number): string {
  // Deterministic viewing key derivation for audit trail
  // In production: use Cloak SDK's viewing key derivation scheme
  const input = `${wallet}:${recipient}:${amount}:${timestamp}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return `vk_${hash.slice(0, 52)}`;
}

function validateSolanaAddress(addr: string): boolean {
  // Base58 characters only, length 32–44
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function POST(req: NextRequest) {
  let body: PrivateTransferRequest;
  try {
    body = await req.json() as PrivateTransferRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { recipient, amountUsd, token, label, wallet } = body;

  if (!recipient || !validateSolanaAddress(recipient)) {
    return NextResponse.json({ error: 'Invalid recipient address.' }, { status: 400 });
  }

  if (!amountUsd || amountUsd <= 0) {
    return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
  }

  if (!token || !['USDC', 'USDT', 'SOL'].includes(token)) {
    return NextResponse.json({ error: 'Invalid token.' }, { status: 400 });
  }

  if (!label?.trim()) {
    return NextResponse.json({ error: 'Label is required.' }, { status: 400 });
  }

  const now = Date.now();
  const viewingKey = body.viewingKey ?? deriveViewingKey(wallet ?? 'anon', recipient, amountUsd, now);
  const txId = `ptx_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // ── Cloak SDK integration point ────────────────────────────────────────────
  // In production, this would call:
  //   const cloakClient = new CloakClient({ network: 'devnet' });
  //   const shieldedTx = await cloakClient.createShieldedTransfer({
  //     from: wallet,
  //     to: recipient,
  //     amount: amountUsd,
  //     token,
  //     viewingKey,
  //     memo: label,
  //   });
  //   await cloakClient.submitShieldedTx(shieldedTx);
  //
  // For the MVP demo, we construct the intent and return the viewing key.
  // The frontend displays the shielded transfer as "complete" with audit key.

  const response: PrivateTransferResponse = {
    ok: true,
    txId,
    viewingKey,
    shieldedAmount: true,
    status: 'shielded',
    cloakVersion: '0.1.0-mvp',
  };

  return NextResponse.json(response);
}
