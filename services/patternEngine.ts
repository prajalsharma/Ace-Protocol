/**
 * Treasury Pattern Engine
 *
 * Detects recurring transaction patterns, clusters counterparties,
 * and categorizes spending. Runs entirely locally (no AI required)
 * using statistical analysis over normalized mainnet transactions.
 *
 * Marked as "Processed locally on-device" for QVAC differentiation.
 */

import crypto from 'crypto';
import { getDb } from '@root/backend/db';
import { getStoredTransactions, getSpendByCategory } from './heliusService';
import type { MainnetTransaction, RecurringPattern, TxCategory, UserTag } from '@root/src/types';

const SEC_IN_DAY = 86400;

// ── Category display labels ──────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<TxCategory | string, string> = {
  payroll: 'Payroll',
  subscription: 'Subscription',
  saas: 'SaaS',
  infrastructure: 'Infrastructure',
  contractor: 'Contractor Payment',
  trading: 'Trading',
  treasury_transfer: 'Treasury Transfer',
  exchange_deposit: 'Exchange Deposit',
  yield_farming: 'Yield / Staking',
  recurring_bill: 'Recurring Bill',
  protocol_operation: 'Protocol Operation',
  ai_infrastructure: 'AI Infrastructure',
  stablecoin_transfer: 'Stablecoin Transfer',
  sol_transfer: 'SOL Transfer',
  nft: 'NFT Activity',
  swap: 'Token Swap',
  unknown: 'Unclassified',
};

// ── Recurring pattern detection ──────────────────────────────────────────────

interface TxGroup {
  counterparty: string;
  transactions: MainnetTransaction[];
  avgAmountUsd: number;
  frequencyDays: number;
  confidence: number;
  category: TxCategory;
}

export function detectRecurringPatterns(wallet: string, sinceTimestamp?: number): RecurringPattern[] {
  const txs = getStoredTransactions(wallet, 500, sinceTimestamp);
  if (txs.length === 0) return [];

  const db = getDb();

  // Group by counterparty
  const byCounterparty = new Map<string, MainnetTransaction[]>();
  for (const tx of txs) {
    if (!tx.counterparty) continue;
    const arr = byCounterparty.get(tx.counterparty) ?? [];
    arr.push(tx);
    byCounterparty.set(tx.counterparty, arr);
  }

  const patterns: RecurringPattern[] = [];
  const now = Math.floor(Date.now() / 1000);

  for (const [cp, cpTxs] of byCounterparty.entries()) {
    if (cpTxs.length < 2) continue;

    // Sort by time ascending
    const sorted = [...cpTxs].sort((a, b) => a.blockTime - b.blockTime);

    // Calculate inter-arrival times
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i].blockTime - sorted[i - 1].blockTime) / SEC_IN_DAY);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, v) => sum + Math.pow(v - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgInterval;

    // Confidence based on sample size and consistency
    const sampleScore = Math.min(1, sorted.length / 5); // saturates at 5+ occurrences
    const consistencyScore = Math.max(0, 1 - coefficientOfVariation); // 1 = perfect regularity
    const confidence = sampleScore * 0.4 + consistencyScore * 0.6;

    if (confidence < 0.25 || sorted.length < 2) continue;

    const amounts = sorted.map(t => t.amountUsd ?? 0).filter(v => v > 0);
    const avgAmount = amounts.length > 0
      ? amounts.reduce((a, b) => a + b, 0) / amounts.length
      : 0;

    const lastTx = sorted[sorted.length - 1];
    const nextPredicted = lastTx.blockTime + Math.round(avgInterval * SEC_IN_DAY);

    const id = crypto.createHash('sha256').update(`pattern:${wallet}:${cp}`).digest('hex').slice(0, 24);

    // Look up any user tag for this counterparty
    const userTagRow = db.prepare(
      `SELECT tag, label FROM user_tags WHERE wallet = ? AND target_address = ? LIMIT 1`
    ).get(wallet, cp) as { tag: TxCategory; label?: string } | undefined;

    const category: TxCategory = userTagRow?.tag as TxCategory ?? inferCategoryFromPattern(avgAmount, avgInterval, cpTxs[0]);

    const pattern: RecurringPattern = {
      id,
      wallet,
      counterpartyAddress: cp,
      category,
      label: userTagRow?.label ?? lastTx.counterpartyLabel ?? undefined,
      avgAmountUsd: avgAmount,
      frequencyDays: avgInterval,
      lastOccurrence: lastTx.blockTime,
      nextPredicted,
      confidence,
      sampleCount: sorted.length,
      isConfirmed: Boolean(userTagRow),
      createdAt: now,
      updatedAt: now,
    };

    patterns.push(pattern);

    // Persist pattern
    db.prepare(`
      INSERT OR REPLACE INTO recurring_patterns
        (id, wallet, counterparty_address, category, label, avg_amount_usd,
         frequency_days, last_occurrence, next_predicted, confidence, sample_count,
         is_confirmed, created_at, updated_at)
      VALUES
        (@id, @wallet, @counterpartyAddress, @category, @label, @avgAmountUsd,
         @frequencyDays, @lastOccurrence, @nextPredicted, @confidence, @sampleCount,
         @isConfirmed, @createdAt, @updatedAt)
    `).run({
      id: pattern.id,
      wallet: pattern.wallet,
      counterpartyAddress: pattern.counterpartyAddress ?? null,
      category: pattern.category,
      label: pattern.label ?? null,
      avgAmountUsd: pattern.avgAmountUsd,
      frequencyDays: pattern.frequencyDays,
      lastOccurrence: pattern.lastOccurrence,
      nextPredicted: pattern.nextPredicted ?? null,
      confidence: pattern.confidence,
      sampleCount: pattern.sampleCount,
      isConfirmed: pattern.isConfirmed ? 1 : 0,
      createdAt: pattern.createdAt,
      updatedAt: pattern.updatedAt,
    });
  }

  return patterns.sort((a, b) => b.confidence - a.confidence);
}

function inferCategoryFromPattern(
  avgAmountUsd: number,
  frequencyDays: number,
  sampleTx: MainnetTransaction,
): TxCategory {
  // Use existing category if already classified
  if (sampleTx.category && sampleTx.category !== 'unknown') return sampleTx.category;

  // Payroll-like: large, monthly/biweekly
  if (avgAmountUsd > 1000 && (Math.abs(frequencyDays - 30) < 5 || Math.abs(frequencyDays - 14) < 3)) {
    return 'payroll';
  }
  // Infrastructure/API: medium, monthly
  if (avgAmountUsd >= 50 && avgAmountUsd <= 500 && Math.abs(frequencyDays - 30) < 7) {
    return 'infrastructure';
  }
  // Subscription: small, monthly/weekly
  if (avgAmountUsd < 50 && (Math.abs(frequencyDays - 30) < 5 || Math.abs(frequencyDays - 7) < 2)) {
    return 'subscription';
  }
  // Treasury transfer: large, infrequent
  if (avgAmountUsd > 2000 && frequencyDays > 14) {
    return 'treasury_transfer';
  }

  return 'unknown';
}

// ── Spend aggregation ────────────────────────────────────────────────────────

export function aggregateSpendByCategory(wallet: string, sinceTimestamp?: number): Record<string, number> {
  return getSpendByCategory(wallet, sinceTimestamp);
}

export function getMonthlyBurnUsd(wallet: string, sinceTimestamp?: number): number {
  const db = getDb();
  // Normalize to a per-30-day rate; only count real outgoing spend (not swaps/staking/incoming)
  const thirtyDaysAgo = sinceTimestamp ?? Math.floor(Date.now() / 1000) - 30 * SEC_IN_DAY;

  const row = db.prepare(`
    SELECT SUM(amount_usd) as total
    FROM mainnet_transactions
    WHERE wallet = ?
      AND block_time >= ?
      AND is_filtered_noise = 0
      AND is_outgoing = 1
      AND amount_usd IS NOT NULL
      AND category NOT IN ('swap', 'yield_farming', 'nft')
  `).get(wallet, thirtyDaysAgo) as { total: number | null };

  const totalSpend = row?.total ?? 0;

  if (sinceTimestamp) {
    // Normalize to monthly equivalent based on the actual time span
    const now = Math.floor(Date.now() / 1000);
    const spanDays = Math.max(1, (now - sinceTimestamp) / SEC_IN_DAY);
    return (totalSpend / spanDays) * 30; // monthly equivalent
  }

  return totalSpend;
}

// ── User tags ─────────────────────────────────────────────────────────────────

export function applyUserTag(wallet: string, tag: UserTag): void {
  const db = getDb();
  const id = tag.id ?? crypto.randomUUID().replace(/-/g, '').slice(0, 24);

  db.prepare(`
    INSERT OR REPLACE INTO user_tags
      (id, wallet, target_address, tx_signature, tag, label, note, created_at)
    VALUES
      (@id, @wallet, @targetAddress, @txSignature, @tag, @label, @note, @createdAt)
  `).run({
    id,
    wallet,
    targetAddress: tag.targetAddress ?? null,
    txSignature: tag.txSignature ?? null,
    tag: tag.tag,
    label: tag.label ?? null,
    note: tag.note ?? null,
    createdAt: tag.createdAt ?? Math.floor(Date.now() / 1000),
  });

  // If tagging a counterparty, retroactively update all their transactions
  if (tag.targetAddress) {
    db.prepare(`
      UPDATE mainnet_transactions
      SET category = ?
      WHERE wallet = ? AND counterparty = ?
    `).run(tag.tag, wallet, tag.targetAddress);
  }

  // If tagging a specific tx
  if (tag.txSignature) {
    db.prepare(`
      UPDATE mainnet_transactions
      SET category = ?
      WHERE wallet = ? AND signature = ?
    `).run(tag.tag, wallet, tag.txSignature);
  }
}

export function getUserTags(wallet: string): UserTag[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM user_tags WHERE wallet = ? ORDER BY created_at DESC
  `).all(wallet) as Array<Record<string, unknown>>;

  return rows.map(r => ({
    id: r.id as string,
    wallet: r.wallet as string,
    targetAddress: r.target_address as string | undefined,
    txSignature: r.tx_signature as string | undefined,
    tag: r.tag as UserTag['tag'],
    label: r.label as string | undefined,
    note: r.note as string | undefined,
    createdAt: r.created_at as number,
  }));
}

// ── Untagged recurring detection ─────────────────────────────────────────────

export function getUntaggedRecurring(wallet: string): RecurringPattern[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM recurring_patterns
    WHERE wallet = ? AND is_confirmed = 0 AND confidence >= 0.4
    ORDER BY confidence DESC
    LIMIT 10
  `).all(wallet) as Array<Record<string, unknown>>;

  return rows.map(rowToPattern);
}

export function getStoredPatterns(wallet: string): RecurringPattern[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM recurring_patterns
    WHERE wallet = ?
    ORDER BY confidence DESC
  `).all(wallet) as Array<Record<string, unknown>>;

  return rows.map(rowToPattern);
}

function rowToPattern(r: Record<string, unknown>): RecurringPattern {
  return {
    id: r.id as string,
    wallet: r.wallet as string,
    counterpartyAddress: r.counterparty_address as string | undefined,
    category: r.category as TxCategory,
    label: r.label as string | undefined,
    avgAmountUsd: r.avg_amount_usd as number,
    frequencyDays: r.frequency_days as number,
    lastOccurrence: r.last_occurrence as number,
    nextPredicted: r.next_predicted as number | undefined,
    confidence: r.confidence as number,
    sampleCount: r.sample_count as number,
    isConfirmed: Boolean(r.is_confirmed),
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  };
}

// ── Treasury runway calculation ───────────────────────────────────────────────

export function calculateRunway(
  liquidBalanceUsd: number,
  monthlyBurnUsd: number,
): number | undefined {
  if (monthlyBurnUsd <= 0) return undefined;
  return (liquidBalanceUsd / monthlyBurnUsd) * 30; // days
}
