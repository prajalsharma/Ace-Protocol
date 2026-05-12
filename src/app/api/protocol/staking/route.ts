// ACE Protocol — Staking Intelligence API
// GET  /api/protocol/staking         → live providers + recommendations
// POST /api/protocol/staking/intent  → record a stake intent (devnet marker)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { getProtocolState, patchVault, recordTransaction } from '@root/services/treasuryService';
import {
  getLiveProviders,
  buildStakeRecommendations,
  buildDevnetStakeMarkerDescription,
} from '@/lib/staking/stakingProviders';
import crypto from 'crypto';

const DEFAULT_SOL_PRICE = 148; // fallback; real price from sol-price route

export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [providers, state] = await Promise.all([
    getLiveProviders(),
    getProtocolState(session.wallet),
  ]);

  const solPriceRes = await fetch(
    new URL('/api/sol-price', req.nextUrl.origin).toString(),
  ).catch(() => null);
  const solPriceData = solPriceRes?.ok
    ? await solPriceRes.json() as { price?: number }
    : null;
  const solPrice = solPriceData?.price ?? DEFAULT_SOL_PRICE;

  const idleYield = state.vault.yieldBalance;
  const recommendations = buildStakeRecommendations(idleYield, solPrice, providers);

  return NextResponse.json({
    providers,
    recommendations,
    idleYieldUsd: idleYield,
    solPriceUsd: solPrice,
    lastUpdated: Math.floor(Date.now() / 1000),
  });
}

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json() as {
    provider: 'hylo' | 'jito';
    amountUsd: number;
    devnetTxSig?: string;
  };

  if (!body.provider || !body.amountUsd || body.amountUsd <= 0) {
    return NextResponse.json({ error: 'provider and amountUsd required' }, { status: 400 });
  }

  const state = await getProtocolState(session.wallet);
  if (body.amountUsd > state.vault.yieldBalance) {
    return NextResponse.json({ error: 'Insufficient yield balance for staking.' }, { status: 400 });
  }

  const solPrice = DEFAULT_SOL_PRICE;
  const now = Math.floor(Date.now() / 1000);
  const txId = `stake-${crypto.randomUUID().slice(0, 8)}`;

  // Deduct from yield balance (staked capital is now "in protocol")
  patchVault(session.wallet, {
    yieldBalance: Number((state.vault.yieldBalance - body.amountUsd).toFixed(2)),
    totalDeposited: Number((state.vault.totalDeposited - body.amountUsd).toFixed(2)),
  });

  recordTransaction(session.wallet, {
    id: txId,
    vaultId: state.vault.id,
    type: 'yield_harvest',
    amountUsd: body.amountUsd,
    status: 'confirmed',
    txHash: body.devnetTxSig ?? `devnet-stake-${txId}`,
    timestamp: now,
    description: buildDevnetStakeMarkerDescription(body.provider, body.amountUsd, solPrice),
    executionCost: 0.000005,
  });

  const newState = await getProtocolState(session.wallet);

  return NextResponse.json({
    ok: true,
    txId,
    provider: body.provider,
    amountUsd: body.amountUsd,
    description: buildDevnetStakeMarkerDescription(body.provider, body.amountUsd, solPrice),
    vault: newState.vault,
  });
}
