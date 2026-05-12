/**
 * pay.sh Integration — Agentic Recurring API Billing
 *
 * Demonstrates machine-to-machine recurring payment capability for
 * AI infrastructure subscriptions (e.g. OpenAI inference billing).
 *
 * This is a lightweight example showing:
 * - Recurring billing pattern detection
 * - Reserve impact calculation
 * - Dashboard visualization data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { getDb } from '@root/backend/db';
import crypto from 'crypto';

export interface PayshBillingEvent {
  id: string;
  service: string;
  description: string;
  amountUsd: number;
  frequency: 'monthly' | 'weekly' | 'usage';
  nextBillingDate: number;
  reserveImpact: number;
  status: 'active' | 'pending' | 'paused';
  category: 'ai_infrastructure' | 'saas' | 'infrastructure';
  endpoint?: string;
}

// Example recurring AI/API billing subscriptions (pay.sh agentic billing)
const EXAMPLE_PAYSH_EVENTS: Omit<PayshBillingEvent, 'id' | 'reserveImpact' | 'nextBillingDate'>[] = [
  {
    service: 'OpenAI Inference',
    description: 'Recurring OpenAI inference billing via pay.sh — gpt-4.1-mini treasury analysis',
    amountUsd: 49.00,
    frequency: 'monthly',
    status: 'active',
    category: 'ai_infrastructure',
    endpoint: 'api.openai.com',
  },
  {
    service: 'Helius RPC Pro',
    description: 'Mainnet transaction indexing — enhanced transaction API',
    amountUsd: 99.00,
    frequency: 'monthly',
    status: 'active',
    category: 'infrastructure',
    endpoint: 'api.helius.xyz',
  },
  {
    service: 'pay.sh Agent Billing',
    description: 'Machine-to-machine agentic payment processing fee',
    amountUsd: 12.00,
    frequency: 'monthly',
    status: 'active',
    category: 'ai_infrastructure',
    endpoint: 'pay.sh',
  },
];

export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  const thirtyDays = 30 * 86400;

  // Get vault balance for reserve impact calculation
  let vaultBalance = 0;
  try {
    const db = getDb();
    const profile = db.prepare(
      'SELECT total_deposited_usd FROM wallet_profiles WHERE wallet = ?'
    ).get(session.wallet) as { total_deposited_usd: number } | undefined;
    vaultBalance = profile?.total_deposited_usd ?? 0;
  } catch {
    // Non-fatal
  }

  const totalMonthly = EXAMPLE_PAYSH_EVENTS.reduce((sum, e) => sum + e.amountUsd, 0);

  const events: PayshBillingEvent[] = EXAMPLE_PAYSH_EVENTS.map((e, i) => ({
    ...e,
    id: crypto.createHash('sha256').update(`paysh:${e.service}`).digest('hex').slice(0, 16),
    nextBillingDate: now + thirtyDays - i * 7 * 86400, // stagger for demo
    reserveImpact: vaultBalance > 0 ? (e.amountUsd / vaultBalance) * 100 : 0,
  }));

  return NextResponse.json({
    events,
    summary: {
      totalMonthlyUsd: totalMonthly,
      activeCount: events.filter(e => e.status === 'active').length,
      reserveImpactPercent: vaultBalance > 0 ? (totalMonthly / vaultBalance) * 100 : 0,
      poweredBy: 'pay.sh',
      note: 'Agentic recurring API billing — machine-to-machine payments for AI infrastructure',
    },
  });
}
