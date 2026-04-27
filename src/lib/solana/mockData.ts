// ============================================================
// ACE Protocol — Mock Data (Simulation Mode)
// Production: Replace with on-chain reads via Anchor + RPC
// ============================================================

import type {
  Vault,
  ScheduledPayment,
  TransactionRecord,
  YieldStrategy,
  CashflowInsight,
  DashboardSummary,
  SpendingPrediction,
  ExecutionQualityMetric,
} from '@/types';

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

export const MOCK_VAULT: Vault = {
  id: 'vault-001',
  owner: 'AcEr7xVw3Pu9mBqLkT2oNjFhGdKsRiYe5CnXz8WvUfP',
  status: 'active',
  totalDeposited: 12_450.00,
  yieldBalance: 7_470.00,
  reserveBalance: 2_490.00,
  liquidBalance: 1_870.50,
  paymentsBalance: 619.50,
  allocation: { yield: 60, reserve: 20, liquid: 15, payments: 5 },
  apy: 8.4,
  createdAt: NOW - 45 * DAY,
  lastRebalancedAt: NOW - 6 * 3600,
  riskLevel: 'balanced',
};

export const MOCK_STRATEGIES: YieldStrategy[] = [
  {
    id: 'strat-hylo',
    name: 'Horizon Yield',
    protocol: 'Hylo-compatible',
    apy: 10.2,
    tvl: 48_200_000,
    riskScore: 4,
    isActive: true,
    allocatedAmount: 4_482,
    description: 'Stablecoin yield via delta-neutral positions with auto-compounding.',
  },
  {
    id: 'strat-sol-staking',
    name: 'Harbor Stake',
    protocol: 'Native Liquid Staking',
    apy: 7.1,
    tvl: 290_000_000,
    riskScore: 2,
    isActive: true,
    allocatedAmount: 2_988,
    description: 'SOL liquid staking with instant unstake liquidity pool.',
  },
  {
    id: 'strat-treasury',
    name: 'Treasury Reserve',
    protocol: 'On-chain T-Bill Proxy',
    apy: 5.2,
    tvl: 12_000_000,
    riskScore: 1,
    isActive: false,
    allocatedAmount: 0,
    description: 'Conservative yield from short-duration tokenized treasury exposure.',
  },
];

export const MOCK_PAYMENTS: ScheduledPayment[] = [
  {
    id: 'pay-001',
    vaultId: 'vault-001',
    recipient: '9xBtjDmQnv4LkwPa7c6eZhFyRoSuNiWgK3bT8mHdCjX',
    amountUsd: 149.99,
    currency: 'USDC',
    status: 'scheduled',
    scheduledAt: NOW + 3 * DAY,
    label: 'Crew Server Bill',
    recurrence: 'monthly',
    nextDue: NOW + 3 * DAY,
  },
  {
    id: 'pay-002',
    vaultId: 'vault-001',
    recipient: 'DkMpLwvXj5YtBnCfRqZoGhNiEsAuT7yV2cWxO9mPbKe',
    amountUsd: 299.00,
    currency: 'USDC',
    status: 'scheduled',
    scheduledAt: NOW + 7 * DAY,
    label: 'Voyage License Renewal',
    recurrence: 'monthly',
    nextDue: NOW + 7 * DAY,
  },
  {
    id: 'pay-003',
    vaultId: 'vault-001',
    recipient: 'FnVpKqBsYgTm3xLdZoWrAcNhEiJuC8oP6wQtRbMyHkG',
    amountUsd: 49.00,
    currency: 'USDC',
    status: 'completed',
    scheduledAt: NOW - 2 * DAY,
    executedAt: NOW - 2 * DAY + 120,
    label: 'Harbor Hosting',
    recurrence: 'monthly',
    nextDue: NOW + 28 * DAY,
  },
];

export const MOCK_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'tx-001',
    vaultId: 'vault-001',
    type: 'deposit',
    amountUsd: 5000,
    status: 'confirmed',
    txHash: '4xK8BmPvLqNdRwZo9tYhGcFeJuSiA7nT3bMxC2vQpDk',
    timestamp: NOW - 20 * DAY,
    description: 'Initial deposit',
  },
  {
    id: 'tx-002',
    vaultId: 'vault-001',
    type: 'deposit',
    amountUsd: 5000,
    status: 'confirmed',
    txHash: '7wR3FpNkBqXtLmPo5vZhYcGdHeJuCiS9nA4bMkDrT8x',
    timestamp: NOW - 10 * DAY,
    description: 'Top-up deposit',
  },
  {
    id: 'tx-003',
    vaultId: 'vault-001',
    type: 'deposit',
    amountUsd: 2450,
    status: 'confirmed',
    txHash: '9dL5QmVwBnKxPzTt3rYoGfChSeJuAiN7pM2bHkXrD4g',
    timestamp: NOW - 5 * DAY,
    description: 'Deposit',
  },
  {
    id: 'tx-004',
    vaultId: 'vault-001',
    type: 'yield_harvest',
    amountUsd: 87.40,
    status: 'confirmed',
    txHash: 'Ac2EpBmFkNqTxLdWo5vZhYhGrFuSeJuCiP9nR8bMkDs',
    timestamp: NOW - 3 * DAY,
    description: 'Weekly yield harvest — Horizon Yield',
  },
  {
    id: 'tx-005',
    vaultId: 'vault-001',
    type: 'payout',
    amountUsd: 49.00,
    status: 'confirmed',
    txHash: 'Bz8WpKmVnRqLxFtYo3sZoGcHeJuSiA5nC7bMkDwTr9p',
    timestamp: NOW - 2 * DAY,
    description: 'Auto-payout: Harbor Hosting',
    executionCost: 0.000025,
    slippage: 3,
  },
  {
    id: 'tx-006',
    vaultId: 'vault-001',
    type: 'rebalance',
    amountUsd: 3_200,
    status: 'confirmed',
    txHash: 'Cx7TnLmBkPqFvRoWz2dYhGsHuJeCiA6nD8bNkEwSt4q',
    timestamp: NOW - 6 * 3600,
    description: 'Auto-rebalance: Yield allocation adjusted to 60%',
    executionCost: 0.000045,
    slippage: 8,
  },
];

export const MOCK_INSIGHTS: CashflowInsight[] = [
  {
    id: 'ins-001',
    type: 'recommendation',
    title: 'Yield window open',
    description:
      'Horizon Yield APY is 2.1% above 30-day average. Increasing yield allocation by 5% could earn ~$18 extra this month.',
    confidence: 0.82,
    impact: 'medium',
    action: { label: 'Adjust allocation', type: 'adjust_allocation' },
    createdAt: NOW - 3600,
  },
  {
    id: 'ins-002',
    type: 'prediction',
    title: 'High payment pressure in 7 days',
    description:
      'Two scheduled payments totaling $449 are due within a week. Reserve balance is sufficient, but liquidity buffer is thin.',
    confidence: 0.95,
    impact: 'high',
    action: { label: 'Review reserve', type: 'rebalance' },
    createdAt: NOW - 7200,
  },
  {
    id: 'ins-003',
    type: 'alert',
    title: 'Execution cost elevated',
    description:
      'Network fees are 3× above baseline. Batching pending rebalance with the upcoming harvest could save ~$0.40 in fees.',
    confidence: 0.78,
    impact: 'low',
    action: { label: 'Batch actions', type: 'rebalance' },
    createdAt: NOW - 1800,
  },
];

export const MOCK_SUMMARY: DashboardSummary = {
  safeToSpend: 1_870.50,
  reserved: 2_490.00,
  earningYield: 7_470.00,
  nextPaymentAmount: 149.99,
  nextPaymentDate: NOW + 3 * DAY,
  totalEarnedYield: 312.80,
  protocolFeePaid: 1.56,
  executionQuality: {
    avgSlippage: 5.2,
    avgExecutionTime: 1.4,
    successRate: 98.7,
    savedVsBaseline: 0.89,
  },
};

export const MOCK_SPENDING_PREDICTIONS: SpendingPrediction[] = [
  { period: 'Jan', predicted: 480, actual: 520, confidence: 0.85 },
  { period: 'Feb', predicted: 510, actual: 490, confidence: 0.88 },
  { period: 'Mar', predicted: 495, actual: 505, confidence: 0.91 },
  { period: 'Apr', predicted: 530, actual: 498, confidence: 0.87 },
  { period: 'May', predicted: 550, confidence: 0.79 },
  { period: 'Jun', predicted: 570, confidence: 0.71 },
];

export const MOCK_YIELD_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  cumulative: parseFloat((i * 10.4 + seededVariance(i) * 8).toFixed(2)),
  daily: parseFloat((8.8 + seededVariance(i) * 3).toFixed(2)),
}));

function seededVariance(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) - 0.5;
}
