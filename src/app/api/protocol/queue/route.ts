// ACE Protocol — AI Payment Queue Builder
//
// GET /api/protocol/queue
//
// Reads the wallet's treasury analysis (recurring patterns + predictions),
// applies the payment queue decision rules, and returns a ready queue
// alongside pay.sh agentic billing events.
//
// Decision rules (from prompt):
//   • detected as recurring OR manually tagged
//   • confidence >= 0.65
//   • due date within configured window
//   • reserve threshold healthy
//   • policy allows it

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { getProtocolState } from '@root/services/treasuryService';
import { getDb } from '@root/backend/db';
import { computeProtocolFee } from '@/lib/feeEngine';
import type { RecurringPattern } from '@/types';

const CONFIDENCE_THRESHOLD = 0.65;
const DUE_WINDOW_DAYS = 21;        // show items due within 21 days
const READY_WINDOW_DAYS = 7;       // "Ready to Pay" if due within 7 days
const READY_SOON_WINDOW_DAYS = 14; // "Ready Soon" if due within 14 days

type QueueStatus =
  | 'detected'
  | 'predicted'
  | 'scheduled'
  | 'ready_soon'
  | 'ready_to_pay'
  | 'waiting_approval'
  | 'paid'
  | 'blocked_by_policy';

export interface QueueItem {
  id: string;
  label: string;
  counterparty?: string;
  counterpartyLabel?: string;
  estimatedAmountUsd: number;
  token: 'USDC' | 'SOL';
  dueDateTs: number;
  dueDateLabel: string;
  confidenceScore: number;
  category: string;
  status: QueueStatus;
  statusLabel: string;
  daysUntilDue: number;
  protocolFeeBps: number;
  protocolFeeUsd: number;
  protocolFeeLabel: string;
  reserveImpactPct: number;
  blockedReason?: string;
  source: 'ai_detected' | 'paysh' | 'manual';
  patternId?: string;
  frequencyDays?: number;
  sampleCount?: number;
}

function buildStatusLabel(status: QueueStatus, daysUntil: number): string {
  switch (status) {
    case 'detected':        return 'Detected';
    case 'predicted':       return 'Predicted';
    case 'scheduled':       return 'Scheduled';
    case 'ready_soon':      return `Ready Soon · ${daysUntil}d`;
    case 'ready_to_pay':    return daysUntil <= 0 ? 'Due Now' : `Ready to Pay · ${daysUntil}d`;
    case 'waiting_approval': return 'Waiting for Approval';
    case 'paid':            return 'Paid';
    case 'blocked_by_policy': return 'Blocked by Policy';
  }
}

function classifyStatus(
  daysUntilDue: number,
  confidence: number,
  reserveHealthy: boolean,
  policyAllows: boolean,
): QueueStatus {
  if (!policyAllows) return 'blocked_by_policy';
  if (!reserveHealthy && daysUntilDue > 3) return 'blocked_by_policy';

  if (confidence < 0.5) return 'detected';
  if (confidence < CONFIDENCE_THRESHOLD) return 'predicted';

  if (daysUntilDue <= READY_WINDOW_DAYS) return 'ready_to_pay';
  if (daysUntilDue <= READY_SOON_WINDOW_DAYS) return 'ready_soon';
  return 'scheduled';
}

function fmtDueDate(ts: number, daysUntil: number): string {
  if (daysUntil <= 0) return 'Overdue';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil <= 7) return `In ${daysUntil} days`;
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = Math.floor(Date.now() / 1000);
  const nowMs = Date.now();
  const state = await getProtocolState(session.wallet);

  const reserveRatio = state.vault.totalDeposited > 0
    ? state.vault.reserveBalance / state.vault.totalDeposited
    : 0;
  const reserveHealthy = reserveRatio >= 0.08;

  // ── 1. Build queue from AI-detected recurring patterns ───────────────────
  let patterns: RecurringPattern[] = [];
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM recurring_patterns
      WHERE wallet = ?
        AND next_predicted IS NOT NULL
        AND confidence >= ?
      ORDER BY next_predicted ASC
    `).all(session.wallet, CONFIDENCE_THRESHOLD - 0.1) as Array<Record<string, unknown>>;

    patterns = rows.map(r => ({
      id: String(r.id),
      wallet: String(r.wallet),
      counterpartyAddress: r.counterparty_address ? String(r.counterparty_address) : undefined,
      category: String(r.category) as RecurringPattern['category'],
      label: r.label ? String(r.label) : undefined,
      avgAmountUsd: Number(r.avg_amount_usd),
      frequencyDays: Number(r.frequency_days),
      lastOccurrence: Number(r.last_occurrence),
      nextPredicted: r.next_predicted ? Number(r.next_predicted) : undefined,
      confidence: Number(r.confidence),
      sampleCount: Number(r.sample_count),
      isConfirmed: Boolean(r.is_confirmed),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));
  } catch {
    // DB may not have this wallet's patterns yet — continue with empty
  }

  const queueItems: QueueItem[] = [];

  for (const p of patterns) {
    if (!p.nextPredicted) continue;
    const daysUntil = Math.round((p.nextPredicted - now) / 86400);
    if (daysUntil > DUE_WINDOW_DAYS) continue; // too far out

    const policyAllows = p.avgAmountUsd <= state.vault.aiPaymentCapUsd || p.isConfirmed;
    const status = classifyStatus(daysUntil, p.confidence, reserveHealthy, policyAllows);

    const fee = computeProtocolFee({
      amountUsd: p.avgAmountUsd,
      urgencyHours: daysUntil * 24,
      isRecurring: true,
      networkCongestionScore: 0.15,
      solVolatilityScore: 0.1,
    });

    const reserveImpact = state.vault.reserveBalance > 0
      ? (p.avgAmountUsd / state.vault.reserveBalance) * 100
      : 0;

    queueItems.push({
      id: `q-${p.id}`,
      label: p.label ?? `Recurring ${p.category.replace(/_/g, ' ')}`,
      counterparty: p.counterpartyAddress,
      estimatedAmountUsd: p.avgAmountUsd,
      token: 'USDC',
      dueDateTs: p.nextPredicted,
      dueDateLabel: fmtDueDate(p.nextPredicted, daysUntil),
      confidenceScore: p.confidence,
      category: p.category,
      status,
      statusLabel: buildStatusLabel(status, daysUntil),
      daysUntilDue: daysUntil,
      protocolFeeBps: fee.bps,
      protocolFeeUsd: fee.feeUsd,
      protocolFeeLabel: fee.label,
      reserveImpactPct: reserveImpact,
      blockedReason: !policyAllows ? `Exceeds autopay cap ($${state.vault.aiPaymentCapUsd})` : undefined,
      source: 'ai_detected',
      patternId: p.id,
      frequencyDays: p.frequencyDays,
      sampleCount: p.sampleCount,
    });
  }

  // ── 2. Add pay.sh agentic billing events ─────────────────────────────────
  const PAYSH_EVENTS = [
    {
      id: 'paysh-openai',
      label: 'OpenAI Inference (pay.sh)',
      amountUsd: 49,
      dueDays: 4,
      category: 'ai_infrastructure',
      confidence: 0.95,
    },
    {
      id: 'paysh-helius',
      label: 'Helius RPC Pro (pay.sh)',
      amountUsd: 99,
      dueDays: 11,
      category: 'infrastructure',
      confidence: 0.95,
    },
    {
      id: 'paysh-agent',
      label: 'pay.sh Agent Billing',
      amountUsd: 12,
      dueDays: 18,
      category: 'ai_infrastructure',
      confidence: 0.98,
    },
  ];

  for (const ev of PAYSH_EVENTS) {
    const dueTs = now + ev.dueDays * 86400;
    const status = classifyStatus(ev.dueDays, ev.confidence, reserveHealthy, true);
    const fee = computeProtocolFee({
      amountUsd: ev.amountUsd,
      urgencyHours: ev.dueDays * 24,
      isRecurring: true,
      networkCongestionScore: 0.15,
    });
    const reserveImpact = state.vault.reserveBalance > 0
      ? (ev.amountUsd / state.vault.reserveBalance) * 100
      : 0;

    queueItems.push({
      id: ev.id,
      label: ev.label,
      estimatedAmountUsd: ev.amountUsd,
      token: 'USDC',
      dueDateTs: dueTs,
      dueDateLabel: fmtDueDate(dueTs, ev.dueDays),
      confidenceScore: ev.confidence,
      category: ev.category,
      status,
      statusLabel: buildStatusLabel(status, ev.dueDays),
      daysUntilDue: ev.dueDays,
      protocolFeeBps: fee.bps,
      protocolFeeUsd: fee.feeUsd,
      protocolFeeLabel: fee.label,
      reserveImpactPct: reserveImpact,
      source: 'paysh',
    });
  }

  // ── 3. Fill with seeded payments from DB that aren't completed ───────────
  for (const p of state.payments) {
    if (p.status === 'completed' || p.status === 'failed') continue;
    if (queueItems.find(q => q.patternId === p.id)) continue; // already added

    const daysUntil = Math.round((p.nextDue - now) / 86400);
    const fee = computeProtocolFee({
      amountUsd: p.amountUsd,
      urgencyHours: daysUntil * 24,
      isRecurring: p.recurrence !== 'once',
      networkCongestionScore: 0.15,
    });
    const reserveImpact = state.vault.reserveBalance > 0
      ? (p.amountUsd / state.vault.reserveBalance) * 100
      : 0;

    const confidence = p.kind === 'x402' ? 0.95 : p.recurrence !== 'once' ? 0.8 : 0.7;
    const status = classifyStatus(daysUntil, confidence, reserveHealthy, true);

    queueItems.push({
      id: `q-pay-${p.id}`,
      label: p.label,
      counterparty: p.recipient,
      estimatedAmountUsd: p.amountUsd,
      token: (p.currency === 'SOL' ? 'SOL' : 'USDC') as 'USDC' | 'SOL',
      dueDateTs: p.nextDue,
      dueDateLabel: fmtDueDate(p.nextDue, daysUntil),
      confidenceScore: confidence,
      category: p.kind ?? 'subscription',
      status,
      statusLabel: buildStatusLabel(status, daysUntil),
      daysUntilDue: daysUntil,
      protocolFeeBps: fee.bps,
      protocolFeeUsd: fee.feeUsd,
      protocolFeeLabel: fee.label,
      reserveImpactPct: reserveImpact,
      source: p.kind === 'x402' ? 'paysh' : 'manual',
      patternId: p.id,
    });
  }

  // Sort: ready_to_pay first, then by days until due
  const statusOrder: Record<QueueStatus, number> = {
    ready_to_pay: 0, ready_soon: 1, waiting_approval: 2, scheduled: 3,
    predicted: 4, detected: 5, paid: 6, blocked_by_policy: 7,
  };
  queueItems.sort((a, b) => {
    const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (so !== 0) return so;
    return a.daysUntilDue - b.daysUntilDue;
  });

  // Summary stats
  const readyCount = queueItems.filter(q => q.status === 'ready_to_pay').length;
  const readySoonCount = queueItems.filter(q => q.status === 'ready_soon').length;
  const totalCommitted = queueItems
    .filter(q => !['paid', 'blocked_by_policy'].includes(q.status))
    .reduce((s, q) => s + q.estimatedAmountUsd, 0);
  const totalFees = queueItems
    .filter(q => !['paid', 'blocked_by_policy'].includes(q.status))
    .reduce((s, q) => s + q.protocolFeeUsd, 0);

  return NextResponse.json({
    queue: queueItems,
    summary: {
      total: queueItems.length,
      readyCount,
      readySoonCount,
      totalCommittedUsd: totalCommitted,
      totalFeesUsd: totalFees,
      reserveHealthy,
      reserveRatioPct: reserveRatio * 100,
    },
    generatedAt: now,
  });
}
