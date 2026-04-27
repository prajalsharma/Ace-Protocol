// ============================================================
// ACE Protocol — Yield Adapter
//
// Simulates yield accrual based on invested balance + time.
// Formula: yield = principal × rate × time (no hardcoding)
// Production: replace with real Hylo/LST protocol calls.
// ============================================================

export interface YieldAccrual {
  principal: number;          // USD
  elapsedDays: number;
  annualRatePct: number;
  accruedUsd: number;
  projectedMonthlyUsd: number;
  projectedAnnualUsd: number;
}

/**
 * Calculate yield accrual deterministically.
 * All values derive from inputs — no hardcoded profit.
 */
export function calculateYieldAccrual(
  principalUsd: number,
  elapsedDays: number,
  annualRatePct: number,
): YieldAccrual {
  const rate = annualRatePct / 100;
  const accruedUsd = principalUsd * rate * (elapsedDays / 365);
  const projectedMonthlyUsd = principalUsd * rate * (30 / 365);
  const projectedAnnualUsd = principalUsd * rate;

  return {
    principal: principalUsd,
    elapsedDays,
    annualRatePct,
    accruedUsd,
    projectedMonthlyUsd,
    projectedAnnualUsd,
  };
}

/**
 * Generate daily yield chart data for N days.
 * Deterministic from seed (principal + APY).
 */
export function generateYieldHistory(
  principalUsd: number,
  annualRatePct: number,
  days = 30,
): Array<{ day: string; daily: number; cumulative: number }> {
  const dailyRate = (annualRatePct / 100) / 365;
  let cumulative = 0;

  return Array.from({ length: days }, (_, i) => {
    // Slight variance based on stable seed (no random)
    const seed = Math.sin((i + 1) * 12.9898 + principalUsd * 78.233) * 43758.5453;
    const variance = (seed - Math.floor(seed)) * 0.3 + 0.85; // 0.85–1.15 multiplier

    const daily = parseFloat((principalUsd * dailyRate * variance).toFixed(2));
    cumulative = parseFloat((cumulative + daily).toFixed(2));

    return {
      day: `Day ${i + 1}`,
      daily,
      cumulative,
    };
  });
}

/**
 * Calculate APY weighted across multiple strategies.
 */
export function weightedApy(strategies: Array<{ allocatedAmount: number; apy: number }>): number {
  const total = strategies.reduce((s, st) => s + st.allocatedAmount, 0);
  if (total === 0) return 0;
  return strategies.reduce((s, st) => s + (st.allocatedAmount / total) * st.apy, 0);
}
