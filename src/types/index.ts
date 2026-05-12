// ============================================================
// ACE Protocol — Core Type Definitions
// ============================================================

export type VaultStatus = 'active' | 'paused' | 'emergency';
export type AllocationTarget = 'yield' | 'reserve' | 'liquid' | 'payments';
export type PaymentStatus = 'pending' | 'queued' | 'scheduled' | 'executing' | 'completed' | 'failed' | 'retried';
export type TxStatus = 'pending' | 'confirmed' | 'failed';
export type RiskLevel = 'conservative' | 'balanced' | 'aggressive';
export type PaymentKind = 'treasury_payout' | 'subscription' | 'x402' | 'payroll' | 'bill';
export type PaymentPriority = 'low' | 'normal' | 'high';

// --- Vault -----------------------------------------------------------

export interface VaultAllocation {
  yield: number;      // % in yield strategies
  reserve: number;    // % in liquidity reserve
  liquid: number;     // % immediately spendable
  payments: number;   // % locked for upcoming payments
}

export type OperationMode = 'safe' | 'autopilot';

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
  operationMode: OperationMode;  // safe = manual approval, autopilot = AI executes within cap
  aiPaymentCapUsd: number;       // max USD the AI can spend per execution cycle
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
  kind?: PaymentKind;
  endpoint?: string;
  priority?: PaymentPriority;
  retryCount?: number;
  maxSpendUsd?: number;
  idempotencyKey?: string;
  metadata?: Record<string, string>;
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

export interface X402SettlementRecord {
  id: string;
  endpoint: string;
  wallet: string;
  amountUsd: number;
  status: 'authorized' | 'settled' | 'blocked' | 'retried' | 'failed';
  reason: string;
  paymentId: string;
  idempotencyKey: string;
  authorizationToken?: string;
  receipt?: string;
  createdAt: number;
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

export interface WalletSession {
  wallet: string;
  token: string;
  expiresAt: number;
}

export interface ProtocolStateResponse {
  wallet: string;
  vault: Vault;
  payments: ScheduledPayment[];
  transactions: TransactionRecord[];
  strategies: YieldStrategy[];
  insights: CashflowInsight[];
  summary: DashboardSummary;
  x402Payments: X402SettlementRecord[];
  isWalletConnected: boolean;
  isSimulationMode: boolean;
}

// ─── Treasury Intelligence Layer ───────────────────────────────────────────

export type TxCategory =
  | 'payroll'
  | 'subscription'
  | 'saas'
  | 'infrastructure'
  | 'contractor'
  | 'trading'
  | 'treasury_transfer'
  | 'exchange_deposit'
  | 'yield_farming'
  | 'recurring_bill'
  | 'protocol_operation'
  | 'ai_infrastructure'
  | 'stablecoin_transfer'
  | 'sol_transfer'
  | 'nft'
  | 'swap'
  | 'unknown';

export interface MainnetTransaction {
  id: string;
  wallet: string;
  signature: string;
  blockTime: number;
  slot?: number;
  type: string;
  category: TxCategory;
  amountSol?: number;
  amountUsd?: number;
  tokenSymbol?: string;
  tokenAmount?: number;
  counterparty?: string;
  counterpartyLabel?: string;
  isFilteredNoise: boolean;
  isMeaningful: boolean;
  isOutgoing: boolean;
  description?: string;
  ingestedAt: number;
}

export interface Counterparty {
  id: string;
  wallet: string;
  address: string;
  label?: string;
  category: TxCategory;
  totalSentUsd: number;
  totalReceivedUsd: number;
  transactionCount: number;
  firstSeen: number;
  lastSeen: number;
  isRecurring: boolean;
}

export interface RecurringPattern {
  id: string;
  wallet: string;
  counterpartyAddress?: string;
  category: TxCategory;
  label?: string;
  avgAmountUsd: number;
  frequencyDays: number;
  lastOccurrence: number;
  nextPredicted?: number;
  confidence: number;
  sampleCount: number;
  isConfirmed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AiTreasuryInsight {
  id: string;
  wallet: string;
  type: 'summary' | 'recurring' | 'reserve' | 'forecast' | 'risk' | 'idle_capital';
  title: string;
  body: string;
  confidence: number;
  supportingTxIds?: string[];
  model: string;
  generatedAt: number;
}

export interface UserTag {
  id: string;
  wallet: string;
  targetAddress?: string;
  txSignature?: string;
  tag: TxCategory | 'ignore' | 'internal';
  label?: string;
  note?: string;
  createdAt: number;
}

export interface TreasuryPrediction {
  id: string;
  wallet: string;
  periodLabel: string;
  predictedSpendUsd: number;
  predictedCategories?: Record<string, number>;
  confidence: number;
  runwayDays?: number;
  reserveRecommendationUsd?: number;
  generatedAt: number;
}

export interface TreasuryAnalysis {
  wallet: string;
  transactions: MainnetTransaction[];
  counterparties: Counterparty[];
  recurringPatterns: RecurringPattern[];
  insights: AiTreasuryInsight[];
  predictions: TreasuryPrediction[];
  spendByCategory: Record<string, number>;
  monthlyBurnUsd: number;
  runwayDays?: number;
  reserveHealthScore: number;
  lastAnalyzedAt: number;
  transactionCount: number;
  untaggedCount: number;
  processedLocally: boolean;
}

export interface TagRequest {
  txSignature?: string;
  targetAddress?: string;
  tag: UserTag['tag'];
  label?: string;
  note?: string;
}
