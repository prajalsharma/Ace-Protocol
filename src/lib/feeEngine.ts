// ============================================================
// ACE Protocol — Dynamic Protocol Fee Engine
//
// Fee range: 25 bps (0.25%) → 200 bps (2.00%)
// Fee is computed from:
//   - Network congestion  (estimated from recent lamport fees)
//   - Market volatility   (SOL price movement proxy)
//   - Payment urgency     (days until due)
//   - Payment size        (larger = slightly lower bps)
//   - Payment type        (recurring autopilot carries a small premium)
// ============================================================

export interface FeeContext {
  amountUsd: number;
  urgencyHours?: number;           // hours until due; 0 = overdue
  isRecurring?: boolean;           // is an AI-detected recurring payment
  isAutopilot?: boolean;           // vault is in autopilot mode
  networkCongestionScore?: number; // 0–1, sampled from recent fee estimate
  solVolatilityScore?: number;     // 0–1, derived from price delta
}

export interface FeeResult {
  bps: number;             // 25–200
  pct: number;             // 0.25–2.00
  feeUsd: number;
  label: string;           // "Low · 0.25%" etc.
  reason: string;
  breakdown: {
    base: number;
    urgencySurcharge: number;
    congestionSurcharge: number;
    recurringDiscount: number;
    sizeTier: string;
  };
}

const MIN_BPS = 25;   // 0.25 %
const MAX_BPS = 200;  // 2.00 %
const BASE_BPS = 40;  // 0.40 % — calm-market baseline

/** Derive a live network congestion score from priority-fee lamports.
 *  Falls back to 0.15 (low congestion) when no data is available. */
export function scoreNetworkCongestion(priorityFeeLamports: number): number {
  // Typical range: 1 000 (calm) → 1 000 000 (very congested)
  const clamped = Math.min(Math.max(priorityFeeLamports, 1_000), 1_000_000);
  return Math.log10(clamped / 1_000) / 3; // 0 → 1
}

/** Estimate SOL volatility score from a recent % price move. */
export function scoreVolatility(priceChangePct: number): number {
  const abs = Math.abs(priceChangePct);
  if (abs < 1) return 0;
  if (abs < 3) return 0.15;
  if (abs < 7) return 0.35;
  if (abs < 15) return 0.65;
  return 1;
}

export function computeProtocolFee(ctx: FeeContext): FeeResult {
  const {
    amountUsd,
    urgencyHours = 72,
    isRecurring = false,
    isAutopilot = false,
    networkCongestionScore = 0.15,
    solVolatilityScore = 0.1,
  } = ctx;

  // ── Base ──────────────────────────────────────────────────────────────────
  let bps = BASE_BPS;
  const breakdown = {
    base: BASE_BPS,
    urgencySurcharge: 0,
    congestionSurcharge: 0,
    recurringDiscount: 0,
    sizeTier: 'standard',
  };

  // ── Urgency surcharge (+0 to +60 bps) ────────────────────────────────────
  if (urgencyHours <= 0) {
    breakdown.urgencySurcharge = 60; // overdue
  } else if (urgencyHours < 6) {
    breakdown.urgencySurcharge = 45;
  } else if (urgencyHours < 24) {
    breakdown.urgencySurcharge = 30;
  } else if (urgencyHours < 48) {
    breakdown.urgencySurcharge = 15;
  } else {
    breakdown.urgencySurcharge = 0;
  }

  // ── Network congestion (+0 to +50 bps) ───────────────────────────────────
  breakdown.congestionSurcharge = Math.round(networkCongestionScore * 50);

  // ── Volatility surcharge (+0 to +40 bps) ─────────────────────────────────
  const volatilitySurcharge = Math.round(solVolatilityScore * 40);

  // ── Size discount (larger payments pay lower bps) ─────────────────────────
  let sizeDiscount = 0;
  if (amountUsd >= 10_000) {
    sizeDiscount = 15;
    breakdown.sizeTier = 'large';
  } else if (amountUsd >= 1_000) {
    sizeDiscount = 8;
    breakdown.sizeTier = 'medium';
  } else {
    breakdown.sizeTier = 'standard';
  }

  // ── Recurring AI automation discount (−10 bps) ───────────────────────────
  if (isRecurring) {
    breakdown.recurringDiscount = 10;
  }

  // ── Autopilot management surcharge (+10 bps) ─────────────────────────────
  const autopilotSurcharge = isAutopilot ? 10 : 0;

  bps = BASE_BPS
    + breakdown.urgencySurcharge
    + breakdown.congestionSurcharge
    + volatilitySurcharge
    + autopilotSurcharge
    - breakdown.recurringDiscount
    - sizeDiscount;

  // Clamp to legal range
  bps = Math.min(MAX_BPS, Math.max(MIN_BPS, bps));

  const pct = bps / 100;
  const feeUsd = Number(((amountUsd * bps) / 10_000).toFixed(4));

  const label =
    bps <= 40 ? `Low · ${pct.toFixed(2)}%`
    : bps <= 80 ? `Standard · ${pct.toFixed(2)}%`
    : bps <= 130 ? `Elevated · ${pct.toFixed(2)}%`
    : `High · ${pct.toFixed(2)}%`;

  const reasons: string[] = [];
  if (breakdown.congestionSurcharge > 10) reasons.push('high network congestion');
  if (volatilitySurcharge > 10) reasons.push('SOL price volatility');
  if (breakdown.urgencySurcharge > 0) reasons.push('urgent execution window');
  if (isRecurring) reasons.push('recurring-payment discount applied');
  if (breakdown.sizeTier !== 'standard') reasons.push(`${breakdown.sizeTier}-payment size tier`);
  const reason = reasons.length > 0 ? reasons.join(', ') : 'standard market conditions';

  return { bps, pct, feeUsd, label, reason, breakdown };
}

/** Quick helper for UI: get a fee estimate with current network state. */
export function estimateQuickFee(amountUsd: number, urgencyHours = 72): FeeResult {
  // Use a moderate congestion / volatility score for display estimates
  return computeProtocolFee({
    amountUsd,
    urgencyHours,
    networkCongestionScore: 0.2,
    solVolatilityScore: 0.1,
  });
}
