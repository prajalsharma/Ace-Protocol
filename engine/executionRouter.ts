export type ExecutionDecision = 'execute_now' | 'delay' | 'batch' | 'rebalance_first';

export interface ExecutionInput {
  amountUsd: number;
  urgencyHours: number;
  networkFeeLamports: number;
  baselineFeeLamports: number;
  hasPendingBatchable: boolean;
  reserveRatio?: number;
  priority?: 'low' | 'normal' | 'high';
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

function lamportsToUsd(lamports: number) {
  return (lamports / LAMPORTS_PER_SOL) * SOL_PRICE_USD;
}

export function routeExecution(input: ExecutionInput): ExecutionResult {
  const feeUsd = lamportsToUsd(input.networkFeeLamports);
  const baselineFeeUsd = lamportsToUsd(input.baselineFeeLamports);
  const feeRatio = input.networkFeeLamports / Math.max(input.baselineFeeLamports, 1);
  const feePctOfAmount = input.amountUsd > 0 ? (feeUsd / input.amountUsd) * 100 : 0;
  const reserveRatio = input.reserveRatio ?? 100;
  const priority = input.priority ?? 'normal';

  if (reserveRatio < 12 && priority !== 'high') {
    return {
      decision: 'rebalance_first',
      reason: 'Reserve ratio is below safe threshold. Restore reserve before optional execution.',
      estimatedSavingUsd: 0,
      recommendedDelayMinutes: 20,
      priorityFeeLamports: Math.round(input.networkFeeLamports * 0.85),
    };
  }

  if (input.urgencyHours <= 0 || priority === 'high') {
    return {
      decision: 'execute_now',
      reason: 'Execution is urgent, so the router prioritizes settlement certainty over optimization.',
      estimatedSavingUsd: 0,
      recommendedDelayMinutes: 0,
      priorityFeeLamports: input.networkFeeLamports,
    };
  }

  if (input.hasPendingBatchable && input.urgencyHours <= 3) {
    return {
      decision: 'batch',
      reason: 'Nearby due items can be batched to lower execution drag without risking settlement.',
      estimatedSavingUsd: Number((feeUsd * 0.35).toFixed(4)),
      recommendedDelayMinutes: 15,
      priorityFeeLamports: Math.round(input.networkFeeLamports * 0.65),
    };
  }

  if (feeRatio > 2.4 && input.urgencyHours > 6) {
    return {
      decision: 'delay',
      reason: `Execution cost is ${feeRatio.toFixed(1)}x baseline. Delay preserves capital while timing slack exists.`,
      estimatedSavingUsd: Number((feeUsd - baselineFeeUsd).toFixed(4)),
      recommendedDelayMinutes: Math.min(Math.round(input.urgencyHours * 18), 240),
      priorityFeeLamports: input.baselineFeeLamports,
    };
  }

  if (feePctOfAmount > 0.5 && input.urgencyHours > 12) {
    return {
      decision: 'delay',
      reason: 'Fee burden is high relative to payment size. Delay until conditions improve.',
      estimatedSavingUsd: Number((feeUsd * 0.3).toFixed(4)),
      recommendedDelayMinutes: 60,
      priorityFeeLamports: Math.round(input.networkFeeLamports * 0.8),
    };
  }

  if (input.hasPendingBatchable && priority === 'low') {
    return {
      decision: 'batch',
      reason: 'Low-priority execution can wait for batching to reduce repeated settlement overhead.',
      estimatedSavingUsd: Number((feeUsd * 0.28).toFixed(4)),
      recommendedDelayMinutes: 30,
      priorityFeeLamports: Math.round(input.networkFeeLamports * 0.6),
    };
  }

  return {
    decision: 'execute_now',
    reason: `Execution conditions are acceptable. Estimated cost is $${feeUsd.toFixed(4)}.`,
    estimatedSavingUsd: 0,
    recommendedDelayMinutes: 0,
    priorityFeeLamports: input.networkFeeLamports,
  };
}

export function estimateCurrentFee(baseFee = 5000) {
  const hour = new Date().getUTCHours();
  const peakMultiplier = hour >= 13 && hour <= 20 ? 2.7 : 1;
  const congestionSeed = Math.sin(Date.now() / 60000) * 0.5 + 0.5;
  const congestionMultiplier = congestionSeed > 0.82 ? 3.2 : 1;
  const feeLamports = Math.round(baseFee * peakMultiplier * congestionMultiplier);
  return { feeLamports, isSpike: feeLamports > baseFee * 2 };
}
