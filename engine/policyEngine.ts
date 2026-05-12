import type { CashflowInsight, ScheduledPayment, Vault } from '@root/src/types';

export interface PolicyConstraints {
  minReserveRatio: number;
  x402SpendCapUsd: number;
  optionalExecutionReserveFloor: number;
  highExecutionCostUsd: number;
  requireManualApprovalAboveUsd: number;
}

export interface PolicyDecision {
  id: string;
  action: 'block_optional_execution' | 'increase_reserve' | 'delay_payment' | 'allow_x402' | 'manual_approval' | 'allocate_to_yield' | 'noop';
  reason: string;
  requiresManualApproval: boolean;
  estimatedImpactUsd: number;
}

export const DEFAULT_POLICY_CONSTRAINTS: PolicyConstraints = {
  minReserveRatio: 15,
  x402SpendCapUsd: 250,
  optionalExecutionReserveFloor: 12,
  highExecutionCostUsd: 1.25,
  requireManualApprovalAboveUsd: 500,
};

export function getReserveRatio(vault: Vault) {
  return vault.totalDeposited > 0 ? (vault.reserveBalance / vault.totalDeposited) * 100 : 0;
}

export function evaluatePolicy(
  vault: Vault,
  payments: ScheduledPayment[],
  constraints: PolicyConstraints = DEFAULT_POLICY_CONSTRAINTS,
  currentFeeUsd = 0.12,
): PolicyDecision[] {
  const now = Math.floor(Date.now() / 1000);
  const reserveRatio = getReserveRatio(vault);
  const due24h = payments.filter((payment) => payment.status === 'scheduled' && payment.nextDue <= now + 24 * 60 * 60);
  const recurringX402 = payments.filter((payment) => payment.kind === 'x402' && payment.status === 'scheduled');
  const optionalExecutionBlocked = reserveRatio < constraints.optionalExecutionReserveFloor;
  const decisions: PolicyDecision[] = [];

  if (optionalExecutionBlocked) {
    decisions.push({
      id: `policy-block-${now}`,
      action: 'block_optional_execution',
      reason: 'Reserve ratio is below the optional execution floor. Only critical payments should proceed.',
      requiresManualApproval: false,
      estimatedImpactUsd: 0,
    });
  }

  if (due24h.length > 0 && reserveRatio < constraints.minReserveRatio + 5) {
    decisions.push({
      id: `policy-reserve-${now}`,
      action: 'increase_reserve',
      reason: 'Payments are due within 24 hours, so reserve allocation should increase before surplus deployment.',
      requiresManualApproval: false,
      estimatedImpactUsd: due24h.reduce((sum, payment) => sum + payment.amountUsd, 0),
    });
  }

  if (currentFeeUsd > constraints.highExecutionCostUsd) {
    decisions.push({
      id: `policy-delay-${now}`,
      action: 'delay_payment',
      reason: 'Execution cost is elevated. Low-priority payments should be delayed or batched.',
      requiresManualApproval: false,
      estimatedImpactUsd: currentFeeUsd,
    });
  }

  if (recurringX402.some((payment) => payment.amountUsd > constraints.x402SpendCapUsd)) {
    decisions.push({
      id: `policy-x402-${now}`,
      action: 'manual_approval',
      reason: 'At least one recurring x402 payment exceeds the automatic spend cap.',
      requiresManualApproval: true,
      estimatedImpactUsd: Math.max(...recurringX402.map((payment) => payment.amountUsd)),
    });
  } else if (recurringX402.length > 0) {
    decisions.push({
      id: `policy-x402-allow-${now}`,
      action: 'allow_x402',
      reason: 'Recurring x402 flows are within spend caps and endpoint policy constraints.',
      requiresManualApproval: false,
      estimatedImpactUsd: recurringX402.reduce((sum, payment) => sum + payment.amountUsd, 0),
    });
  }

  const reserveRequirement = Math.max(
    vault.totalDeposited * (constraints.minReserveRatio / 100),
    due24h.reduce((sum, payment) => sum + payment.amountUsd, 0),
  );
  const idleCapital = Math.max(0, vault.liquidBalance - reserveRequirement * 0.25);
  if (idleCapital > 100) {
    decisions.push({
      id: `policy-yield-${now}`,
      action: 'allocate_to_yield',
      reason: 'Idle capital sits above reserve requirement and can be deployed to yield safely.',
      requiresManualApproval: idleCapital > constraints.requireManualApprovalAboveUsd,
      estimatedImpactUsd: idleCapital,
    });
  }

  if (decisions.length === 0) {
    decisions.push({
      id: `policy-noop-${now}`,
      action: 'noop',
      reason: 'Treasury is balanced. No policy action is required right now.',
      requiresManualApproval: false,
      estimatedImpactUsd: 0,
    });
  }

  return decisions;
}

export function decisionsToInsights(decisions: PolicyDecision[]): CashflowInsight[] {
  return decisions
    .filter((decision) => decision.action !== 'noop')
    .map((decision, index) => ({
      id: decision.id,
      type: decision.requiresManualApproval ? 'alert' : 'recommendation',
      title: decision.action.replace(/_/g, ' '),
      description: decision.reason,
      confidence: decision.requiresManualApproval ? 0.96 : 0.84,
      impact: decision.estimatedImpactUsd > 500 ? 'high' : decision.estimatedImpactUsd > 150 ? 'medium' : 'low',
      action: {
        label: decision.requiresManualApproval ? 'Review policy' : 'Review execution',
        type: decision.action === 'allocate_to_yield' ? 'adjust_allocation' : 'review',
      },
      createdAt: Math.floor(Date.now() / 1000) - index * 60,
    }));
}
