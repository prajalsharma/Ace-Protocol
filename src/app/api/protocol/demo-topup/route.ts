// ============================================================
// ACE Protocol — Demo Top-Up
//
// Allows explicit simulation of a deposit for demo purposes.
// This is clearly labelled in the UI and in the transaction
// record — not hidden fake data. The on-chain program is real
// and verifiable; this simulates the deposit instruction
// client-side so demos work without a funded devnet wallet.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import {
  ensureWalletProfile,
  patchVault,
  recordTransaction,
  getProtocolState,
} from '@root/services/treasuryService';

const MAX_DEMO_TOPUP_USD = 100_000;

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { amountUsd?: number };
  const amount = Number(body.amountUsd ?? 0);

  if (!amount || amount <= 0 || amount > MAX_DEMO_TOPUP_USD) {
    return NextResponse.json(
      { error: `Amount must be between $1 and $${MAX_DEMO_TOPUP_USD.toLocaleString()}` },
      { status: 400 },
    );
  }

  const profile = await ensureWalletProfile(session.wallet);
  const current = {
    total: profile.total_deposited_usd,
    yield: profile.yield_balance_usd,
    reserve: profile.reserve_balance_usd,
    liquid: profile.liquid_balance_usd,
    payments: profile.payments_balance_usd,
  };

  const alloc = JSON.parse(profile.allocation_json) as {
    yield: number; reserve: number; liquid: number; payments: number;
  };

  const newTotal = current.total + amount;
  const newYield = Number((newTotal * (alloc.yield / 100)).toFixed(2));
  const newReserve = Number((newTotal * (alloc.reserve / 100)).toFixed(2));
  const newPayments = Number((newTotal * (alloc.payments / 100)).toFixed(2));
  const newLiquid = Number(Math.max(0, newTotal - newYield - newReserve - newPayments).toFixed(2));

  patchVault(session.wallet, {
    totalDeposited: newTotal,
    yieldBalance: newYield,
    reserveBalance: newReserve,
    liquidBalance: newLiquid,
    paymentsBalance: newPayments,
  });

  const now = Math.floor(Date.now() / 1000);
  recordTransaction(session.wallet, {
    id: `demo-${crypto.randomUUID().slice(0, 8)}`,
    vaultId: `vault-${session.wallet.slice(0, 8)}`,
    type: 'deposit',
    amountUsd: amount,
    status: 'confirmed',
    timestamp: now,
    description: `Demo deposit: $${amount.toFixed(2)} (simulated — no on-chain tx)`,
  });

  const state = await getProtocolState(session.wallet);
  return NextResponse.json({ ok: true, vault: state.vault });
}
