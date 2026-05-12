import crypto from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import { getDb } from '@root/backend/db';
import { backendConfig } from '@root/backend/config';
import { accrueDeterministicYield, getDefaultYieldStrategies } from '@root/adapters/yieldAdapter';
import { decisionsToInsights, evaluatePolicy, getReserveRatio } from '@root/engine/policyEngine';
import type {
  CashflowInsight,
  DashboardSummary,
  OperationMode,
  PaymentPriority,
  ProtocolStateResponse,
  ScheduledPayment,
  TransactionRecord,
  Vault,
  VaultAllocation,
  X402SettlementRecord,
} from '@root/src/types';

const DEFAULT_ALLOCATION: VaultAllocation = {
  yield: 60,
  reserve: 20,
  liquid: 15,
  payments: 5,
};

const DEFAULT_RISK = 'balanced';
const DEFAULT_APY = 8.4;

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

async function readChainUsd(wallet: string) {
  try {
    const connection = new Connection(backendConfig.rpcUrl, 'confirmed');
    const lamports = await connection.getBalance(new PublicKey(wallet));
    return (lamports / 1_000_000_000) * backendConfig.defaultSolPriceUsd;
  } catch {
    return 0;
  }
}

type WalletProfileRow = {
  wallet: string;
  total_deposited_usd: number;
  yield_balance_usd: number;
  reserve_balance_usd: number;
  liquid_balance_usd: number;
  payments_balance_usd: number;
  allocation_json: string;
  apy: number;
  risk_level: Vault['riskLevel'];
  created_at: number;
  updated_at: number;
  last_rebalanced_at: number;
  last_yield_accrual_at: number;
  monthly_spend_usd: number;
  automate_payments: number;
  operation_mode: OperationMode;
  ai_payment_cap_usd: number;
};

function rowToVault(row: WalletProfileRow): Vault {
  return {
    id: `vault-${row.wallet.slice(0, 8)}`,
    owner: row.wallet,
    status: 'active',
    totalDeposited: row.total_deposited_usd,
    yieldBalance: row.yield_balance_usd,
    reserveBalance: row.reserve_balance_usd,
    liquidBalance: row.liquid_balance_usd,
    paymentsBalance: row.payments_balance_usd,
    allocation: JSON.parse(row.allocation_json) as VaultAllocation,
    apy: row.apy,
    createdAt: row.created_at,
    lastRebalancedAt: row.last_rebalanced_at,
    riskLevel: row.risk_level,
    operationMode: (row.operation_mode as OperationMode) ?? 'safe',
    aiPaymentCapUsd: row.ai_payment_cap_usd ?? 500,
  };
}

function serializeMetadata(value: ScheduledPayment['metadata']) {
  return value ? JSON.stringify(value) : null;
}

function deserializePayment(row: Record<string, unknown>): ScheduledPayment {
  return {
    id: String(row.id),
    vaultId: String(row.vault_id),
    recipient: String(row.recipient),
    amountUsd: Number(row.amount_usd),
    currency: row.currency as ScheduledPayment['currency'],
    status: row.status as ScheduledPayment['status'],
    scheduledAt: Number(row.scheduled_at),
    executedAt: row.executed_at ? Number(row.executed_at) : undefined,
    label: String(row.label),
    recurrence: row.recurrence as ScheduledPayment['recurrence'],
    nextDue: Number(row.next_due),
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    kind: row.kind as ScheduledPayment['kind'],
    endpoint: row.endpoint ? String(row.endpoint) : undefined,
    priority: row.priority as PaymentPriority,
    retryCount: Number(row.retry_count ?? 0),
    maxSpendUsd: row.max_spend_usd ? Number(row.max_spend_usd) : undefined,
    idempotencyKey: String(row.idempotency_key),
    metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) as Record<string, string> : undefined,
  };
}

function seedPayments(wallet: string, vaultId: string, now: number) {
  const db = getDb();
  const items: ScheduledPayment[] = [
    {
      id: `pay-${wallet.slice(0, 6)}-treasury`,
      vaultId,
      recipient: '9xBtjDmQnv4LkwPa7c6eZhFyRoSuNiWgK3bT8mHdCjX',
      amountUsd: 149.99,
      currency: 'USDC',
      status: 'scheduled',
      scheduledAt: now,
      label: 'Treasury infrastructure bill',
      recurrence: 'monthly',
      nextDue: now + 3 * 86400,
      kind: 'bill',
      priority: 'normal',
      retryCount: 0,
      idempotencyKey: crypto.randomUUID(),
    },
    {
      id: `pay-${wallet.slice(0, 6)}-x402`,
      vaultId,
      recipient: wallet,
      amountUsd: 39,
      currency: 'USDC',
      status: 'scheduled',
      scheduledAt: now,
      label: 'Agent inference workflow',
      recurrence: 'monthly',
      nextDue: now + 5 * 86400,
      kind: 'x402',
      endpoint: 'https://api.openai.com/v1/responses',
      priority: 'normal',
      retryCount: 0,
      maxSpendUsd: 75,
      idempotencyKey: crypto.randomUUID(),
      metadata: { workflow: 'inference', lane: 'agent-runtime' },
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO payments (
      id, wallet, vault_id, recipient, amount_usd, currency, status, scheduled_at, executed_at, label,
      recurrence, next_due, failure_reason, kind, endpoint, priority, retry_count, max_spend_usd,
      idempotency_key, metadata_json, created_at, updated_at
    ) VALUES (
      @id, @wallet, @vaultId, @recipient, @amountUsd, @currency, @status, @scheduledAt, @executedAt, @label,
      @recurrence, @nextDue, @failureReason, @kind, @endpoint, @priority, @retryCount, @maxSpendUsd,
      @idempotencyKey, @metadataJson, @createdAt, @updatedAt
    )
  `);

  for (const item of items) {
    stmt.run({
      ...item,
      wallet,
      metadataJson: serializeMetadata(item.metadata),
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function ensureWalletProfile(wallet: string) {
  const db = getDb();
  const existing = db.prepare(`SELECT * FROM wallet_profiles WHERE wallet = ?`).get(wallet) as WalletProfileRow | undefined;
  if (existing) return existing;

  const now = nowSec();
  // Seed from actual on-chain SOL balance so the profile reflects real funds.
  // User can add demo funds explicitly via the vault deposit UI.
  const chainUsd = await readChainUsd(wallet);
  const total = Number(Math.max(chainUsd, 0).toFixed(2));
  const reserve = Number((total * (DEFAULT_ALLOCATION.reserve / 100)).toFixed(2));
  const yieldBalance = Number((total * (DEFAULT_ALLOCATION.yield / 100)).toFixed(2));
  const paymentsBalance = Number((total * (DEFAULT_ALLOCATION.payments / 100)).toFixed(2));
  const liquid = Number(Math.max(0, total - reserve - yieldBalance - paymentsBalance).toFixed(2));

  db.prepare(`
    INSERT INTO wallet_profiles (
      wallet, total_deposited_usd, yield_balance_usd, reserve_balance_usd, liquid_balance_usd, payments_balance_usd,
      allocation_json, apy, risk_level, created_at, updated_at, last_rebalanced_at, last_yield_accrual_at,
      monthly_spend_usd, automate_payments, operation_mode, ai_payment_cap_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    wallet, total, yieldBalance, reserve, liquid, paymentsBalance,
    JSON.stringify(DEFAULT_ALLOCATION), DEFAULT_APY, DEFAULT_RISK,
    now, now, now, now, 500, 1, 'safe', 500,
  );

  const vaultId = `vault-${wallet.slice(0, 8)}`;
  seedPayments(wallet, vaultId, now);
  return db.prepare(`SELECT * FROM wallet_profiles WHERE wallet = ?`).get(wallet) as WalletProfileRow;
}

function accrueYieldOnProfile(row: WalletProfileRow) {
  const db = getDb();
  const now = nowSec();
  const elapsed = Math.max(0, now - row.last_yield_accrual_at);
  if (elapsed < 3600) return row;

  const projection = accrueDeterministicYield(row.yield_balance_usd, row.apy, elapsed);
  const nextYield = Number((row.yield_balance_usd + projection.accruedUsd).toFixed(2));
  const nextTotal = Number((row.total_deposited_usd + projection.accruedUsd).toFixed(2));

  db.prepare(`
    UPDATE wallet_profiles
    SET yield_balance_usd = ?, total_deposited_usd = ?, last_yield_accrual_at = ?, updated_at = ?
    WHERE wallet = ?
  `).run(nextYield, nextTotal, now, now, row.wallet);

  return db.prepare(`SELECT * FROM wallet_profiles WHERE wallet = ?`).get(row.wallet) as WalletProfileRow;
}

export function getPaymentsForWallet(wallet: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM payments WHERE wallet = ? ORDER BY next_due ASC`).all(wallet).map((row) => deserializePayment(row as Record<string, unknown>));
}

export function getTransactionsForWallet(wallet: string) {
  const db = getDb();
  return db.prepare(`
    SELECT id, vault_id, type, amount_usd, status, tx_hash, timestamp, description, execution_cost, slippage
    FROM transactions
    WHERE wallet = ?
    ORDER BY timestamp DESC
  `).all(wallet).map((row) => ({
    id: String((row as Record<string, unknown>).id),
    vaultId: String((row as Record<string, unknown>).vault_id),
    type: (row as Record<string, unknown>).type as TransactionRecord['type'],
    amountUsd: Number((row as Record<string, unknown>).amount_usd),
    status: (row as Record<string, unknown>).status as TransactionRecord['status'],
    txHash: (row as Record<string, unknown>).tx_hash ? String((row as Record<string, unknown>).tx_hash) : undefined,
    timestamp: Number((row as Record<string, unknown>).timestamp),
    description: String((row as Record<string, unknown>).description),
    executionCost: (row as Record<string, unknown>).execution_cost ? Number((row as Record<string, unknown>).execution_cost) : undefined,
    slippage: (row as Record<string, unknown>).slippage ? Number((row as Record<string, unknown>).slippage) : undefined,
  }));
}

export function getX402ForWallet(wallet: string) {
  const db = getDb();
  return db.prepare(`
    SELECT id, payment_id as paymentId, wallet, endpoint, amount_usd as amountUsd, status, reason, idempotency_key as idempotencyKey,
           authorization_token as authorizationToken, receipt, created_at as createdAt
    FROM x402_settlements
    WHERE wallet = ?
    ORDER BY created_at DESC
  `).all(wallet) as X402SettlementRecord[];
}

export function getEmptyProtocolState(wallet: string): ProtocolStateResponse {
  const emptyVault: Vault = {
    id: `vault-${wallet.slice(0, 8)}`,
    owner: wallet,
    status: 'active',
    totalDeposited: 0,
    yieldBalance: 0,
    reserveBalance: 0,
    liquidBalance: 0,
    paymentsBalance: 0,
    allocation: { yield: 60, reserve: 20, liquid: 15, payments: 5 },
    apy: 0,
    createdAt: Math.floor(Date.now() / 1000),
    lastRebalancedAt: Math.floor(Date.now() / 1000),
    riskLevel: 'balanced',
    operationMode: 'safe',
    aiPaymentCapUsd: 500,
  };
  return {
    wallet,
    vault: emptyVault,
    payments: [],
    transactions: [],
    strategies: [],
    insights: [],
    summary: {
      safeToSpend: 0,
      reserved: 0,
      earningYield: 0,
      nextPaymentAmount: 0,
      nextPaymentDate: 0,
      totalEarnedYield: 0,
      protocolFeePaid: 0,
      executionQuality: { avgSlippage: 0, avgExecutionTime: 0, successRate: 0, savedVsBaseline: 0 },
    },
    x402Payments: [],
    isWalletConnected: true,
    isSimulationMode: false,
  };
}

// rpcUrl is accepted but currently not used directly here — the route layer
// selects the appropriate RPC. This signature keeps the route type-safe.
export async function getProtocolState(wallet: string, _rpcUrl?: string): Promise<ProtocolStateResponse> {
  const profile = accrueYieldOnProfile(await ensureWalletProfile(wallet));
  const vault = rowToVault(profile);
  const payments = getPaymentsForWallet(wallet);
  const transactions = getTransactionsForWallet(wallet);
  const x402Payments = getX402ForWallet(wallet);
  const insights = getInsightsForWallet(wallet, vault, payments);
  const strategies = getDefaultYieldStrategies(vault);
  const summary = buildSummary(vault, payments, transactions);

  return {
    wallet,
    vault,
    payments,
    transactions,
    strategies,
    insights,
    summary,
    x402Payments,
    isWalletConnected: true,
    isSimulationMode: false,
  };
}

function buildSummary(vault: Vault, payments: ScheduledPayment[], transactions: TransactionRecord[]): DashboardSummary {
  const scheduled = payments.filter((payment) => payment.status === 'scheduled');
  const nextPayment = scheduled[0];
  const totalYieldEarned = transactions
    .filter((tx) => tx.type === 'yield_harvest')
    .reduce((sum, tx) => sum + tx.amountUsd, 0);
  const protocolFeePaid = transactions
    .filter((tx) => tx.type === 'fee')
    .reduce((sum, tx) => sum + tx.amountUsd, 0);

  return {
    safeToSpend: vault.liquidBalance,
    reserved: vault.reserveBalance,
    earningYield: vault.yieldBalance,
    nextPaymentAmount: nextPayment?.amountUsd ?? 0,
    nextPaymentDate: nextPayment?.nextDue ?? 0,
    totalEarnedYield: totalYieldEarned,
    protocolFeePaid,
    executionQuality: {
      avgSlippage: 4.6,
      avgExecutionTime: 1.2,
      successRate: 98.9,
      savedVsBaseline: 0.92,
    },
  };
}

export function getInsightsForWallet(wallet: string, vault: Vault, payments: ScheduledPayment[]): CashflowInsight[] {
  const db = getDb();
  const dismissed = new Set(
    (db.prepare(`SELECT insight_id FROM dismissed_insights WHERE wallet = ?`).all(wallet) as Array<{ insight_id: string }>)
      .map((row) => row.insight_id),
  );
  return decisionsToInsights(evaluatePolicy(vault, payments))
    .filter((insight) => !dismissed.has(insight.id));
}

export function dismissInsight(wallet: string, insightId: string) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO dismissed_insights (wallet, insight_id, created_at)
    VALUES (?, ?, ?)
  `).run(wallet, insightId, nowSec());
}

export function patchVault(wallet: string, patch: Partial<Vault>) {
  const db = getDb();
  const current = db.prepare(`SELECT * FROM wallet_profiles WHERE wallet = ?`).get(wallet) as WalletProfileRow | undefined;
  if (!current) throw new Error('Wallet profile not found.');

  const next = {
    total: patch.totalDeposited ?? current.total_deposited_usd,
    yield: patch.yieldBalance ?? current.yield_balance_usd,
    reserve: patch.reserveBalance ?? current.reserve_balance_usd,
    liquid: patch.liquidBalance ?? current.liquid_balance_usd,
    payments: patch.paymentsBalance ?? current.payments_balance_usd,
    allocation: patch.allocation ?? JSON.parse(current.allocation_json),
    apy: patch.apy ?? current.apy,
    risk: patch.riskLevel ?? current.risk_level,
    operationMode: patch.operationMode ?? current.operation_mode ?? 'safe',
    aiPaymentCapUsd: patch.aiPaymentCapUsd ?? current.ai_payment_cap_usd ?? 500,
  };

  db.prepare(`
    UPDATE wallet_profiles
    SET total_deposited_usd = ?, yield_balance_usd = ?, reserve_balance_usd = ?, liquid_balance_usd = ?,
        payments_balance_usd = ?, allocation_json = ?, apy = ?, risk_level = ?, updated_at = ?, last_rebalanced_at = ?,
        operation_mode = ?, ai_payment_cap_usd = ?
    WHERE wallet = ?
  `).run(
    next.total, next.yield, next.reserve, next.liquid,
    next.payments, JSON.stringify(next.allocation), next.apy, next.risk, nowSec(), nowSec(),
    next.operationMode, next.aiPaymentCapUsd, wallet,
  );

  return rowToVault(db.prepare(`SELECT * FROM wallet_profiles WHERE wallet = ?`).get(wallet) as WalletProfileRow);
}

export function createPayment(wallet: string, payment: ScheduledPayment) {
  const db = getDb();
  const now = nowSec();
  db.prepare(`
    INSERT INTO payments (
      id, wallet, vault_id, recipient, amount_usd, currency, status, scheduled_at, executed_at, label,
      recurrence, next_due, failure_reason, kind, endpoint, priority, retry_count, max_spend_usd,
      idempotency_key, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payment.id, wallet, payment.vaultId, payment.recipient, payment.amountUsd, payment.currency, payment.status,
    payment.scheduledAt, payment.executedAt ?? null, payment.label, payment.recurrence, payment.nextDue,
    payment.failureReason ?? null, payment.kind ?? 'subscription', payment.endpoint ?? null, payment.priority ?? 'normal',
    payment.retryCount ?? 0, payment.maxSpendUsd ?? null, payment.idempotencyKey ?? crypto.randomUUID(),
    serializeMetadata(payment.metadata), now, now,
  );
  return payment;
}

export function patchPayment(wallet: string, paymentId: string, patch: Partial<ScheduledPayment>) {
  const db = getDb();
  const current = db.prepare(`SELECT * FROM payments WHERE wallet = ? AND id = ?`).get(wallet, paymentId) as Record<string, unknown> | undefined;
  if (!current) throw new Error('Payment not found.');
  const payment = { ...deserializePayment(current), ...patch };

  db.prepare(`
    UPDATE payments
    SET status = ?, executed_at = ?, next_due = ?, failure_reason = ?, retry_count = ?, endpoint = ?, priority = ?,
        max_spend_usd = ?, metadata_json = ?, updated_at = ?
    WHERE wallet = ? AND id = ?
  `).run(
    payment.status, payment.executedAt ?? null, payment.nextDue, payment.failureReason ?? null,
    payment.retryCount ?? 0, payment.endpoint ?? null, payment.priority ?? 'normal',
    payment.maxSpendUsd ?? null, serializeMetadata(payment.metadata), nowSec(), wallet, paymentId,
  );
  return payment;
}

export function recordTransaction(wallet: string, tx: TransactionRecord) {
  const db = getDb();
  db.prepare(`
    INSERT INTO transactions (
      id, wallet, vault_id, type, amount_usd, status, tx_hash, timestamp, description, execution_cost, slippage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tx.id, wallet, tx.vaultId, tx.type, tx.amountUsd, tx.status, tx.txHash ?? null,
    tx.timestamp, tx.description, tx.executionCost ?? null, tx.slippage ?? null,
  );
  return tx;
}

export function recordX402Settlement(record: X402SettlementRecord) {
  const db = getDb();
  db.prepare(`
    INSERT INTO x402_settlements (
      id, payment_id, wallet, endpoint, amount_usd, status, reason, idempotency_key, authorization_token, receipt, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id, record.paymentId, record.wallet, record.endpoint, record.amountUsd, record.status,
    record.reason, record.idempotencyKey, record.authorizationToken ?? null, record.receipt ?? null, record.createdAt,
  );
  return record;
}

export function getWalletReserveRatio(wallet: string) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM wallet_profiles WHERE wallet = ?`).get(wallet) as WalletProfileRow | undefined;
  if (!row) return 0;
  return getReserveRatio(rowToVault(row));
}
