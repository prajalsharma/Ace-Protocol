import crypto from 'crypto';
import { estimateCurrentFee, routeExecution } from '@root/engine/executionRouter';
import { DEFAULT_POLICY_CONSTRAINTS, evaluatePolicy, getReserveRatio } from '@root/engine/policyEngine';
import { settleX402Payment } from '@root/adapters/x402Adapter';
import {
  getPaymentsForWallet,
  getProtocolState,
  patchPayment,
  patchVault,
  recordTransaction,
  recordX402Settlement,
} from '@root/services/treasuryService';

export async function executePaymentForWallet(wallet: string, paymentId: string) {
  const state = await getProtocolState(wallet);
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) throw new Error('Payment not found.');

  const reserveRatio = getReserveRatio(state.vault);
  const policyDecisions = evaluatePolicy(state.vault, state.payments);
  const manualApprovalRequired = policyDecisions.some((decision) => decision.requiresManualApproval)
    && payment.amountUsd > DEFAULT_POLICY_CONSTRAINTS.requireManualApprovalAboveUsd;

  if (manualApprovalRequired) {
    throw new Error('Payment requires manual approval under current policy.');
  }

  const { feeLamports } = estimateCurrentFee();
  const urgencyHours = Math.max(0, (payment.nextDue - Math.floor(Date.now() / 1000)) / 3600);
  const execution = routeExecution({
    amountUsd: payment.amountUsd,
    urgencyHours,
    networkFeeLamports: feeLamports,
    baselineFeeLamports: 5000,
    hasPendingBatchable: getPaymentsForWallet(wallet).filter((item) => item.status === 'scheduled').length > 1,
    reserveRatio,
    priority: payment.priority ?? 'normal',
  });

  if (execution.decision === 'delay' || execution.decision === 'rebalance_first') {
    patchPayment(wallet, payment.id, {
      status: 'queued',
      retryCount: (payment.retryCount ?? 0) + 1,
      nextDue: payment.nextDue + execution.recommendedDelayMinutes * 60,
      failureReason: execution.reason,
    });
    return {
      ok: false,
      status: 'queued',
      reason: execution.reason,
      execution,
    };
  }

  if (payment.amountUsd > state.vault.reserveBalance + state.vault.liquidBalance) {
    patchPayment(wallet, payment.id, {
      status: 'failed',
      retryCount: (payment.retryCount ?? 0) + 1,
      failureReason: 'Insufficient reserve and liquid capital.',
    });
    throw new Error('Insufficient funds for payment execution.');
  }

  let nextReserve = state.vault.reserveBalance;
  let nextLiquid = state.vault.liquidBalance;
  let remaining = payment.amountUsd;

  if (nextReserve >= remaining) {
    nextReserve -= remaining;
    remaining = 0;
  } else {
    remaining -= nextReserve;
    nextReserve = 0;
    nextLiquid = Math.max(0, nextLiquid - remaining);
  }

  const completedAt = Math.floor(Date.now() / 1000);
  const txHash = `ace_${crypto.randomUUID().replace(/-/g, '')}`;

  if (payment.kind === 'x402') {
    const x402 = settleX402Payment({
      wallet,
      payment,
      reserveRatio,
      spendCapUsd: payment.maxSpendUsd ?? DEFAULT_POLICY_CONSTRAINTS.x402SpendCapUsd,
    });
    recordX402Settlement(x402.record);
    if (!x402.ok) {
      patchPayment(wallet, payment.id, {
        status: 'failed',
        retryCount: (payment.retryCount ?? 0) + 1,
        failureReason: x402.record.reason,
      });
      throw new Error(x402.record.reason);
    }
  }

  patchPayment(wallet, payment.id, {
    status: 'completed',
    executedAt: completedAt,
    failureReason: undefined,
  });

  patchVault(wallet, {
    totalDeposited: Number((state.vault.totalDeposited - payment.amountUsd).toFixed(2)),
    reserveBalance: Number(nextReserve.toFixed(2)),
    liquidBalance: Number(nextLiquid.toFixed(2)),
  });

  recordTransaction(wallet, {
    id: `tx-${completedAt}-${payment.id}`,
    vaultId: state.vault.id,
    type: payment.kind === 'x402' ? 'fee' : 'payout',
    amountUsd: payment.amountUsd,
    status: 'confirmed',
    txHash,
    timestamp: completedAt,
    description: payment.kind === 'x402' ? `x402 settlement: ${payment.label}` : `Payout: ${payment.label}`,
    executionCost: feeLamports / 1_000_000_000,
  });

  return {
    ok: true,
    status: 'completed',
    reason: execution.reason,
    execution,
    txHash,
  };
}
