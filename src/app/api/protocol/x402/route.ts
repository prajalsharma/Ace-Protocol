import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { createPayment } from '@root/services/treasuryService';
import { executePaymentForWallet } from '@root/engine/paymentEngine';
import type { ScheduledPayment } from '@root/src/types';

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json() as {
    label: string;
    endpoint: string;
    amountUsd: number;
    recurrence?: ScheduledPayment['recurrence'];
    walletOverride?: string;
  };

  if (!body.label || !body.endpoint || !body.amountUsd) {
    return NextResponse.json({ error: 'label, endpoint, and amountUsd are required' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const payment: ScheduledPayment = {
    id: `pay-${Date.now()}`,
    vaultId: `vault-${session.wallet.slice(0, 8)}`,
    recipient: body.walletOverride ?? session.wallet,
    amountUsd: body.amountUsd,
    currency: 'USDC',
    status: 'scheduled',
    scheduledAt: now,
    label: body.label,
    recurrence: body.recurrence ?? 'once',
    nextDue: now,
    kind: 'x402',
    endpoint: body.endpoint,
    priority: 'high',
    retryCount: 0,
    maxSpendUsd: Math.max(75, body.amountUsd),
    idempotencyKey: `idem-${Date.now()}`,
  };

  createPayment(session.wallet, payment);
  try {
    return NextResponse.json(await executePaymentForWallet(session.wallet, payment.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'x402 execution failed' }, { status: 400 });
  }
}
