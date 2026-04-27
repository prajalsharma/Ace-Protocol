// ============================================================
// ACE Protocol — Execution Router
//
// Deterministic logic to decide HOW and WHEN to execute
// a transaction. Inspired by Jito/Raiku but self-contained.
// No fake AI — outputs follow directly from inputs.
// ============================================================

export type ExecutionDecision = 'execute_now' | 'delay' | 'batch';

export interface ExecutionInput {
  amountUsd: number;
  urgencyHours: number;    // how many hours until due (0 = immediate)
  networkFeeLamports: number;
  baselineFeeLamports: number; // 30-day average fee
  hasPendingBatchable: boolean; // are there other pending actions to batch with?
}

export interface ExecutionResult {
  decision: ExecutionDecision;
  reason: string;
  estimatedSavingUsd: number;
  recommendedDelayMinutes: number;
  priorityFeeLamports: number;
}

const LAMPORTS_PER_SOL = 1_000_000_000;
const SOL_PRICE_USD = 148;

function lamportsToUsd(lamports: number): number {
  return (lamports / LAMPORTS_PER_SOL) * SOL_PRICE_USD;
}

/**
 * Route a transaction execution decision.
 * All logic is deterministic and explainable.
 */
export function routeExecution(input: ExecutionInput): ExecutionResult {
  const {
    amountUsd,
    urgencyHours,
    networkFeeLamports,
    baselineFeeLamports,
    hasPendingBatchable,
  } = input;

  const feeUsd = lamportsToUsd(networkFeeLamports);
  const baselineFeeUsd = lamportsToUsd(baselineFeeLamports);
  const feeRatio = networkFeeLamports / Math.max(baselineFeeLamports, 1);
  const feePctOfAmount = amountUsd > 0 ? (feeUsd / amountUsd) * 100 : 0;

  // Rule 1: Immediate deadline — always execute now
  if (urgencyHours <= 0) {
    return {
      decision: 'execute_now',
      reason: 'Payment is due immediately. Executing regardless of fee conditions.',
      estimatedSavingUsd: 0,
      recommendedDelayMinutes: 0,
      priorityFeeLamports: networkFeeLamports,
    };
  }

  // Rule 2: Very soon but batchable — batch to save fees
  if (urgencyHours <= 2 && hasPendingBatchable) {
    const saving = feeUsd * 0.4; // 40% saving from batching
    return {
      decision: 'batch',
      reason: `Due in ${urgencyHours}h. Batching with pending actions saves ~$${saving.toFixed(4)} in fees.`,
      estimatedSavingUsd: saving,
      recommendedDelayMinutes: 15,
      priorityFeeLamports: Math.round(networkFeeLamports * 0.6),
    };
  }

  // Rule 3: Fee spike detected and not urgent — delay
  if (feeRatio > 2.5 && urgencyHours > 6) {
    const delaySaving = feeUsd - baselineFeeUsd;
    const delayMinutes = Math.min(urgencyHours * 60 * 0.3, 240); // wait up to 30% of available time
    return {
      decision: 'delay',
      reason: `Network fees are ${feeRatio.toFixed(1)}× baseline. Delaying ${Math.round(delayMinutes)}min expected to save ~$${delaySaving.toFixed(4)}.`,
      estimatedSavingUsd: delaySaving,
      recommendedDelayMinutes: Math.round(delayMinutes),
      priorityFeeLamports: baselineFeeLamports,
    };
  }

  // Rule 4: Fee is high relative to payment value — delay if time allows
  if (feePctOfAmount > 0.5 && urgencyHours > 12) {
    return {
      decision: 'delay',
      reason: `Execution cost ($${feeUsd.toFixed(4)}) is ${feePctOfAmount.toFixed(2)}% of payment. Delaying to reduce cost impact.`,
      estimatedSavingUsd: feeUsd * 0.3,
      recommendedDelayMinutes: 60,
      priorityFeeLamports: Math.round(networkFeeLamports * 0.8),
    };
  }

  // Rule 5: Batchable with non-urgent peers
  if (hasPendingBatchable && urgencyHours > 4) {
    const saving = feeUsd * 0.35;
    return {
      decision: 'batch',
      reason: `Other pending actions available to batch. Combined execution saves ~$${saving.toFixed(4)}.`,
      estimatedSavingUsd: saving,
      recommendedDelayMinutes: 30,
      priorityFeeLamports: Math.round(networkFeeLamports * 0.65),
    };
  }

  // Default: execute now
  return {
    decision: 'execute_now',
    reason: `Conditions are favorable. Fee is $${feeUsd.toFixed(4)} (${feePctOfAmount.toFixed(2)}% of payment).`,
    estimatedSavingUsd: 0,
    recommendedDelayMinutes: 0,
    priorityFeeLamports: networkFeeLamports,
  };
}

/**
 * Derive realistic network fee from current slot and time of day.
 * In production: fetch from RPC getRecentPrioritizationFees.
 */
export function estimateCurrentFee(baseFee = 5000): { feeLamports: number; isSpike: boolean } {
  const hour = new Date().getHours();
  // Simulate higher fees during peak hours (UTC 13-20)
  const peakMultiplier = hour >= 13 && hour <= 20 ? 2.8 : 1.0;
  // Simulate random congestion spikes
  const randomSeed = Math.sin(Date.now() / 60000) * 0.5 + 0.5;
  const congestionMultiplier = randomSeed > 0.8 ? 3.5 : 1.0;

  const feeLamports = Math.round(baseFee * peakMultiplier * congestionMultiplier);
  const isSpike = feeLamports > baseFee * 2;

  return { feeLamports, isSpike };
}
