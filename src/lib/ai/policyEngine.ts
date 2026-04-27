// ============================================================
// ACE Protocol — AI Policy Engine
//
// The AI layer operates WITHIN user-defined guardrails only.
// It NEVER directly moves funds. It generates insights,
// recommendations, and conditional triggers that require
// on-chain authorization to execute.
// ============================================================

import type { CashflowInsight, Vault, ScheduledPayment, SpendingPrediction } from '@/types';
import { MOCK_INSIGHTS, MOCK_SPENDING_PREDICTIONS } from '@/lib/solana/mockData';

export interface PolicyConstraints {
  maxRebalancePercent: number;      // max single-action allocation shift
  minReserveRatio: number;          // never drop reserve below this %
  maxYieldRatio: number;            // never put more than this % in yield
  executionCostCeilUsd: number;     // skip action if cost exceeds this
  requireManualApprovalAbove: number; // USD threshold requiring explicit confirmation
}

export const DEFAULT_CONSTRAINTS: PolicyConstraints = {
  maxRebalancePercent: 15,
  minReserveRatio: 15,
  maxYieldRatio: 80,
  executionCostCeilUsd: 2.0,
  requireManualApprovalAbove: 500,
};

export interface PolicyDecision {
  id: string;
  action: 'rebalance' | 'harvest' | 'schedule_payment' | 'pause' | 'noop';
  reason: string;
  params?: Record<string, unknown>;
  requiresManualApproval: boolean;
  estimatedImpactUsd: number;
  confidence: number;
  guardrailsChecked: string[];
}

/**
 * Analyze vault state and return recommended policy decisions.
 * All decisions are checked against PolicyConstraints before surfacing.
 *
 * Production: integrate with a real AI/ML model or LLM with structured output.
 * Current: deterministic heuristics for hackathon demo.
 */
export function analyzeCashflow(
  vault: Vault,
  payments: ScheduledPayment[],
  constraints: PolicyConstraints = DEFAULT_CONSTRAINTS,
): PolicyDecision[] {
  const decisions: PolicyDecision[] = [];
  const guardrailsLog: string[] = [];

  // --- Guard: Check reserve ratio --------------------------------
  const currentReserveRatio = (vault.reserveBalance / vault.totalDeposited) * 100;
  guardrailsLog.push(`reserve_ratio_check: ${currentReserveRatio.toFixed(1)}% >= ${constraints.minReserveRatio}%`);

  // --- Upcoming payment pressure ---------------------------------
  const now = Math.floor(Date.now() / 1000);
  const weekPayments = payments
    .filter(p => p.status === 'scheduled' && p.nextDue < now + 7 * 86400)
    .reduce((sum, p) => sum + p.amountUsd, 0);

  if (weekPayments > vault.liquidBalance * 0.9) {
    const shortfall = weekPayments - vault.liquidBalance * 0.9;
    const requiresManual = shortfall > constraints.requireManualApprovalAbove;

    decisions.push({
      id: `decision-liquid-${Date.now()}`,
      action: 'rebalance',
      reason: `Upcoming payments of $${weekPayments.toFixed(2)} may strain liquid balance. Moving $${shortfall.toFixed(2)} from reserve to liquid.`,
      params: { fromBucket: 'reserve', toBucket: 'liquid', amountUsd: shortfall },
      requiresManualApproval: requiresManual,
      estimatedImpactUsd: shortfall,
      confidence: 0.91,
      guardrailsChecked: [
        ...guardrailsLog,
        `min_reserve_after: ${((vault.reserveBalance - shortfall) / vault.totalDeposited * 100).toFixed(1)}% >= ${constraints.minReserveRatio}%`,
      ],
    });
  }

  // --- Yield opportunity -----------------------------------------
  const yieldRatio = (vault.yieldBalance / vault.totalDeposited) * 100;
  if (yieldRatio < 55 && currentReserveRatio > constraints.minReserveRatio + 5) {
    const excessReserve = vault.reserveBalance - (constraints.minReserveRatio / 100) * vault.totalDeposited;
    if (excessReserve > 100) {
      decisions.push({
        id: `decision-yield-${Date.now()}`,
        action: 'rebalance',
        reason: `Reserve is above minimum threshold. Moving $${excessReserve.toFixed(2)} into yield strategy could earn additional APY.`,
        params: { fromBucket: 'reserve', toBucket: 'yield', amountUsd: excessReserve },
        requiresManualApproval: false,
        estimatedImpactUsd: excessReserve * 0.084 / 12, // monthly yield estimate
        confidence: 0.77,
        guardrailsChecked: [...guardrailsLog, `max_yield_ratio: ${Math.min(yieldRatio + 5, constraints.maxYieldRatio)}% <= ${constraints.maxYieldRatio}%`],
      });
    }
  }

  return decisions;
}

/**
 * Generate human-readable cashflow insights.
 * Production: replace with LLM summarization (Claude API call with structured output).
 */
export async function generateInsights(
  _vault: Vault,
  _payments: ScheduledPayment[],
): Promise<CashflowInsight[]> {
  // Stub: return pre-defined mock insights
  // Production: POST to /api/ai/insights with vault state, return AI-generated text
  return MOCK_INSIGHTS;
}

/**
 * Predict upcoming spending over the next N months.
 * Production: time-series model on historical payment data.
 */
export async function predictSpending(
  _vaultId: string,
  _monthsAhead = 6,
): Promise<SpendingPrediction[]> {
  return MOCK_SPENDING_PREDICTIONS;
}

/**
 * Explain a policy decision in plain language.
 * Production: LLM with context window containing decision + vault state.
 */
export function explainDecision(decision: PolicyDecision): string {
  const lines = [
    `**Action:** ${decision.action.replace('_', ' ')}`,
    `**Reason:** ${decision.reason}`,
    `**Confidence:** ${(decision.confidence * 100).toFixed(0)}%`,
    `**Estimated impact:** $${decision.estimatedImpactUsd.toFixed(2)}`,
    decision.requiresManualApproval
      ? '**Note:** This action requires your explicit approval before execution.'
      : '**Note:** This action is within automated policy limits.',
  ];
  return lines.join('\n');
}
