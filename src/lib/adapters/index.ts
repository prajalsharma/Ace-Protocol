// ============================================================
// ACE Protocol — Integration Adapter Interfaces
//
// These interfaces define the contracts for plugging in
// external providers. No hardcoded dependencies in core.
// Swap implementations without touching protocol logic.
// ============================================================

import type { ExecutionRoute } from '@/types';

// ---------------------------------------------------------------
// Yield Source Adapter (Hylo-compatible)
// ---------------------------------------------------------------

export interface YieldSourceAdapter {
  /** Unique identifier for this provider */
  readonly id: string;
  readonly name: string;

  /** Returns current APY for the strategy */
  getApy(): Promise<number>;

  /** Deposit capital into yield strategy. Returns tx signature. */
  deposit(params: {
    walletAddress: string;
    amountLamports: bigint;
    slippageBps: number;
  }): Promise<{ txSig: string; sharesReceived: bigint }>;

  /** Withdraw capital from yield strategy. Returns tx signature. */
  withdraw(params: {
    walletAddress: string;
    sharesAmount: bigint;
  }): Promise<{ txSig: string; amountReceived: bigint }>;

  /** Returns current position value in base token lamports */
  getPositionValue(walletAddress: string): Promise<bigint>;

  /** Harvest pending yield. Returns amount harvested in base token lamports. */
  harvestYield(walletAddress: string): Promise<{ txSig: string; amountHarvested: bigint }>;
}

// ---------------------------------------------------------------
// Execution Optimizer Adapter (Jito/Raiku-compatible)
// ---------------------------------------------------------------

export interface ExecutionOptimizerAdapter {
  readonly id: string;
  readonly name: string;

  /** Get available execution routes for a swap or transfer */
  getRoutes(params: {
    inputMint: string;
    outputMint: string;
    amountIn: bigint;
    slippageBps: number;
  }): Promise<ExecutionRoute[]>;

  /**
   * Submit a bundle/transaction with optimized priority.
   * Returns tx signature or bundle ID.
   */
  submitTransaction(params: {
    serializedTx: Uint8Array;
    routeId: string;
    tipLamports?: bigint;
  }): Promise<{ txSig: string; landed: boolean; slot?: number }>;

  /** Estimate execution cost before committing */
  estimateCost(params: {
    serializedTx: Uint8Array;
  }): Promise<{ feeLamports: bigint; priorityFee: bigint; estimatedSlippage: number }>;
}

// ---------------------------------------------------------------
// Payment Rails Adapter (Sphere-compatible)
// ---------------------------------------------------------------

export interface PaymentRailsAdapter {
  readonly id: string;
  readonly name: string;

  /**
   * Initiate a payment to a recipient.
   * Can be on-chain wallet or off-ramp (fiat bank).
   */
  sendPayment(params: {
    fromVaultAddress: string;
    recipientAddress: string;
    amountUsd: number;
    currency: 'USDC' | 'USDT' | 'SOL';
    reference: string;          // idempotency key
    memo?: string;
  }): Promise<{ paymentId: string; txSig?: string; status: 'submitted' | 'pending' | 'failed' }>;

  /** Check status of a previously submitted payment */
  getPaymentStatus(paymentId: string): Promise<{
    status: 'submitted' | 'pending' | 'completed' | 'failed';
    failureReason?: string;
    completedAt?: number;
  }>;

  /** List supported off-ramp currencies and fees */
  getSupportedRails(): Promise<Array<{
    id: string;
    label: string;
    feeBps: number;
    estimatedSettlementSeconds: number;
  }>>;
}

// ---------------------------------------------------------------
// Price Oracle Adapter
// ---------------------------------------------------------------

export interface PriceOracleAdapter {
  readonly id: string;

  /** Returns price in USD, throws if feed is stale */
  getPrice(mint: string): Promise<{ priceUsd: number; confidence: number; slot: number }>;

  /** Returns true if price is fresh within staleness threshold (slots) */
  isFresh(slot: number, maxStalenessSlots?: number): boolean;
}

// ---------------------------------------------------------------
// Notification Adapter
// ---------------------------------------------------------------

export interface NotificationAdapter {
  readonly id: string;

  sendAlert(params: {
    userId: string;
    title: string;
    body: string;
    urgency: 'info' | 'warning' | 'critical';
  }): Promise<void>;
}

// ---------------------------------------------------------------
// Adapter Registry (DI container pattern)
// ---------------------------------------------------------------

export interface AdapterRegistry {
  yieldSource: YieldSourceAdapter;
  executionOptimizer: ExecutionOptimizerAdapter;
  paymentRails: PaymentRailsAdapter;
  priceOracle: PriceOracleAdapter;
  notification: NotificationAdapter;
}

// ---------------------------------------------------------------
// Stub implementations (dev / simulation mode)
// ---------------------------------------------------------------

export class StubYieldSourceAdapter implements YieldSourceAdapter {
  readonly id = 'stub-yield';
  readonly name = 'Stub Yield (Dev)';
  async getApy() { return 8.4; }
  async deposit() { return { txSig: 'stub-tx', sharesReceived: 1000000n }; }
  async withdraw() { return { txSig: 'stub-tx', amountReceived: 1000000n }; }
  async getPositionValue() { return 7_470_000_000n; }
  async harvestYield() { return { txSig: 'stub-tx', amountHarvested: 87_400_000n }; }
}

export class StubExecutionOptimizerAdapter implements ExecutionOptimizerAdapter {
  readonly id = 'stub-exec';
  readonly name = 'Stub Execution (Dev)';
  async getRoutes(): Promise<ExecutionRoute[]> {
    return [
      {
        id: 'route-jito',
        label: 'Priority Bundle',
        estimatedCost: 0.000045,
        estimatedSlippage: 5,
        estimatedTime: 1,
        provider: 'jito',
        isRecommended: true,
      },
      {
        id: 'route-standard',
        label: 'Standard',
        estimatedCost: 0.000005,
        estimatedSlippage: 12,
        estimatedTime: 8,
        provider: 'standard',
        isRecommended: false,
      },
    ];
  }
  async submitTransaction() { return { txSig: 'stub-tx', landed: true }; }
  async estimateCost() { return { feeLamports: 5000n, priorityFee: 40000n, estimatedSlippage: 5 }; }
}

export class StubPaymentRailsAdapter implements PaymentRailsAdapter {
  readonly id = 'stub-payments';
  readonly name = 'Stub Payments (Dev)';
  async sendPayment() { return { paymentId: 'pay-stub-001', status: 'submitted' as const }; }
  async getPaymentStatus() { return { status: 'completed' as const, completedAt: Date.now() / 1000 }; }
  async getSupportedRails() { return []; }
}

export class StubPriceOracleAdapter implements PriceOracleAdapter {
  readonly id = 'stub-oracle';
  async getPrice(mint: string) {
    const prices: Record<string, number> = {
      'USDC': 1.0,
      'SOL': 148.0,
      'USDT': 1.0,
    };
    return { priceUsd: prices[mint] ?? 1.0, confidence: 0.99, slot: 300_000_000 };
  }
  isFresh(slot: number, maxStale = 10) { return true; }
}

export const DEFAULT_ADAPTERS: AdapterRegistry = {
  yieldSource: new StubYieldSourceAdapter(),
  executionOptimizer: new StubExecutionOptimizerAdapter(),
  paymentRails: new StubPaymentRailsAdapter(),
  priceOracle: new StubPriceOracleAdapter(),
  notification: {
    id: 'stub-notify',
    async sendAlert() {},
  },
};
