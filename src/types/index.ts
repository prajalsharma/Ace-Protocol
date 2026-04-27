// ============================================================
// ACE Protocol — Core Type Definitions
// ============================================================

export type VaultStatus = 'active' | 'paused' | 'emergency';
export type AllocationTarget = 'yield' | 'reserve' | 'liquid' | 'payments';
export type PaymentStatus = 'scheduled' | 'executing' | 'completed' | 'failed';
export type TxStatus = 'pending' | 'confirmed' | 'failed';
export type RiskLevel = 'conservative' | 'balanced' | 'aggressive';

// --- Vault -----------------------------------------------------------

export interface VaultAllocation {
  yield: number;      // % in yield strategies
  reserve: number;    // % in liquidity reserve
  liquid: number;     // % immediately spendable
  payments: number;   // % locked for upcoming payments
}

export interface Vault {
  id: string;
  owner: string;             // wallet pubkey
  status: VaultStatus;
  totalDeposited: number;    // USD value
  yieldBalance: number;
  reserveBalance: number;
  liquidBalance: number;
  paymentsBalance: number;
  allocation: VaultAllocation;
  apy: number;               // weighted average APY %
  createdAt: number;         // unix timestamp
  lastRebalancedAt: number;
  riskLevel: RiskLevel;
}

// --- Strategy --------------------------------------------------------

export interface YieldStrategy {
  id: string;
  name: string;
  protocol: string;
  apy: number;
  tvl: number;
  riskScore: number;         // 1–10
  isActive: boolean;
  allocatedAmount: number;
  description: string;
}

// --- Payments --------------------------------------------------------

export interface ScheduledPayment {
  id: string;
  vaultId: string;
  recipient: string;
  amountUsd: number;
  currency: 'USDC' | 'USDT' | 'SOL';
  status: PaymentStatus;
  scheduledAt: number;
  executedAt?: number;
  label: string;
  recurrence: 'once' | 'daily' | 'weekly' | 'monthly';
  nextDue: number;
  failureReason?: string;
}

// --- Transactions ----------------------------------------------------

export interface TransactionRecord {
  id: string;
  vaultId: string;
  type: 'deposit' | 'withdraw' | 'rebalance' | 'payout' | 'yield_harvest' | 'fee';
  amountUsd: number;
  status: TxStatus;
  txHash?: string;
  timestamp: number;
  description: string;
  executionCost?: number;    // lamports
  slippage?: number;         // bps
}

// --- AI Policy -------------------------------------------------------

export interface CashflowInsight {
  id: string;
  type: 'recommendation' | 'alert' | 'prediction';
  title: string;
  description: string;
  confidence: number;        // 0–1
  impact: 'high' | 'medium' | 'low';
  action?: {
    label: string;
    type: 'rebalance' | 'schedule_payment' | 'adjust_allocation' | 'review';
  };
  createdAt: number;
}

export interface SpendingPrediction {
  period: string;
  predicted: number;
  actual?: number;
  confidence: number;
}

// --- Execution -------------------------------------------------------

export interface ExecutionRoute {
  id: string;
  label: string;
  estimatedCost: number;     // USD
  estimatedSlippage: number; // bps
  estimatedTime: number;     // seconds
  provider: 'jito' | 'standard' | 'raiku' | 'fallback';
  isRecommended: boolean;
}

export interface ExecutionQualityMetric {
  avgSlippage: number;
  avgExecutionTime: number;
  successRate: number;
  savedVsBaseline: number;
}

// --- Protocol Config -------------------------------------------------

export interface ProtocolConfig {
  treasuryAddress: string;
  yieldFeeBps: number;       // e.g. 50 = 0.5%
  payoutFeeBps: number;
  pauseAuthority: string;
  strategyWhitelist: string[];
  isPaused: boolean;
  version: string;
}

// --- Onboarding ------------------------------------------------------

export interface OnboardingGoal {
  monthlySpend: number;
  savingsTarget: number;
  riskTolerance: RiskLevel;
  automatePayments: boolean;
  primaryCurrency: 'USDC' | 'USDT' | 'SOL';
}

// --- Dashboard state -------------------------------------------------

export interface DashboardSummary {
  safeToSpend: number;
  reserved: number;
  earningYield: number;
  nextPaymentAmount: number;
  nextPaymentDate: number;
  totalEarnedYield: number;
  protocolFeePaid: number;
  executionQuality: ExecutionQualityMetric;
}
