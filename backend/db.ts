import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { backendConfig } from './config';

let instance: Database.Database | null = null;

export function getDb() {
  if (instance) return instance;

  fs.mkdirSync(path.dirname(backendConfig.dbPath), { recursive: true });
  instance = new Database(backendConfig.dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');

  instance.exec(`
    CREATE TABLE IF NOT EXISTS auth_challenges (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      nonce TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_profiles (
      wallet TEXT PRIMARY KEY,
      total_deposited_usd REAL NOT NULL,
      yield_balance_usd REAL NOT NULL,
      reserve_balance_usd REAL NOT NULL,
      liquid_balance_usd REAL NOT NULL,
      payments_balance_usd REAL NOT NULL,
      allocation_json TEXT NOT NULL,
      apy REAL NOT NULL,
      risk_level TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_rebalanced_at INTEGER NOT NULL,
      last_yield_accrual_at INTEGER NOT NULL,
      monthly_spend_usd REAL NOT NULL DEFAULT 500,
      automate_payments INTEGER NOT NULL DEFAULT 1,
      operation_mode TEXT NOT NULL DEFAULT 'safe',
      ai_payment_cap_usd REAL NOT NULL DEFAULT 500
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      vault_id TEXT NOT NULL,
      recipient TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      executed_at INTEGER,
      label TEXT NOT NULL,
      recurrence TEXT NOT NULL,
      next_due INTEGER NOT NULL,
      failure_reason TEXT,
      kind TEXT NOT NULL,
      endpoint TEXT,
      priority TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_spend_usd REAL,
      idempotency_key TEXT NOT NULL,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      vault_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      status TEXT NOT NULL,
      tx_hash TEXT,
      timestamp INTEGER NOT NULL,
      description TEXT NOT NULL,
      execution_cost REAL,
      slippage REAL
    );

    CREATE TABLE IF NOT EXISTS x402_settlements (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      wallet TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      amount_usd REAL NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      authorization_token TEXT,
      receipt TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dismissed_insights (
      wallet TEXT NOT NULL,
      insight_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (wallet, insight_id)
    );

    -- ── Treasury Intelligence Layer ─────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS mainnet_transactions (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      signature TEXT NOT NULL UNIQUE,
      block_time INTEGER NOT NULL,
      slot INTEGER,
      type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'unknown',
      amount_sol REAL,
      amount_usd REAL,
      token_symbol TEXT,
      token_amount REAL,
      counterparty TEXT,
      counterparty_label TEXT,
      is_filtered_noise INTEGER NOT NULL DEFAULT 0,
      is_meaningful INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      raw_json TEXT,
      ingested_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_mt_wallet ON mainnet_transactions(wallet);
    CREATE INDEX IF NOT EXISTS idx_mt_wallet_time ON mainnet_transactions(wallet, block_time DESC);
    CREATE INDEX IF NOT EXISTS idx_mt_wallet_cat ON mainnet_transactions(wallet, category);

    CREATE TABLE IF NOT EXISTS counterparties (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      address TEXT NOT NULL,
      label TEXT,
      category TEXT NOT NULL DEFAULT 'unknown',
      total_sent_usd REAL NOT NULL DEFAULT 0,
      total_received_usd REAL NOT NULL DEFAULT 0,
      transaction_count INTEGER NOT NULL DEFAULT 0,
      first_seen INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      UNIQUE(wallet, address)
    );

    CREATE TABLE IF NOT EXISTS recurring_patterns (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      counterparty_address TEXT,
      category TEXT NOT NULL,
      label TEXT,
      avg_amount_usd REAL NOT NULL,
      frequency_days REAL NOT NULL,
      last_occurrence INTEGER NOT NULL,
      next_predicted INTEGER,
      confidence REAL NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      is_confirmed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_treasury_insights (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0,
      supporting_tx_ids TEXT,
      model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
      generated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_ati_wallet ON ai_treasury_insights(wallet);

    CREATE TABLE IF NOT EXISTS user_tags (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      target_address TEXT,
      tx_signature TEXT,
      tag TEXT NOT NULL,
      label TEXT,
      note TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(wallet, tx_signature)
    );

    CREATE TABLE IF NOT EXISTS treasury_predictions (
      id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL,
      period_label TEXT NOT NULL,
      predicted_spend_usd REAL NOT NULL,
      predicted_categories TEXT,
      confidence REAL NOT NULL DEFAULT 0,
      runway_days REAL,
      reserve_recommendation_usd REAL,
      generated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tp_wallet ON treasury_predictions(wallet);
  `);

  // Migrate: add columns if they don't exist yet (idempotent)
  const profileCols = instance.prepare(`PRAGMA table_info(wallet_profiles)`).all() as Array<{ name: string }>;
  const colNames = new Set(profileCols.map((c) => c.name));
  if (!colNames.has('operation_mode')) {
    instance.exec(`ALTER TABLE wallet_profiles ADD COLUMN operation_mode TEXT NOT NULL DEFAULT 'safe'`);
  }
  if (!colNames.has('ai_payment_cap_usd')) {
    instance.exec(`ALTER TABLE wallet_profiles ADD COLUMN ai_payment_cap_usd REAL NOT NULL DEFAULT 500`);
  }

  // Migrate mainnet_transactions: add is_outgoing if missing
  const mtCols = instance.prepare(`PRAGMA table_info(mainnet_transactions)`).all() as Array<{ name: string }>;
  const mtColNames = new Set(mtCols.map((c) => c.name));
  if (!mtColNames.has('is_outgoing')) {
    instance.exec(`ALTER TABLE mainnet_transactions ADD COLUMN is_outgoing INTEGER NOT NULL DEFAULT 0`);
  }

  return instance;
}
