/**
 * Helius Mainnet Transaction Ingestion Service
 *
 * Fetches real mainnet transaction history via Helius Enhanced Transactions API,
 * normalizes the data, filters noise, and stores meaningful treasury activity.
 */

import crypto from 'crypto';
import { getDb } from '@root/backend/db';
import type { MainnetTransaction, TxCategory } from '@root/src/types';

const HELIUS_BASE = 'https://api.helius.xyz';

// ── Noise thresholds ─────────────────────────────────────────────────────────
const MIN_SOL_AMOUNT = 0.001;          // ignore SOL transfers below this
const MIN_USD_AMOUNT = 1.0;             // ignore USD-value transfers below this
const MIN_TOKEN_AMOUNT_USDC = 1.0;     // ignore stablecoin transfers below this

// ── Known program labels ──────────────────────────────────────────────────────
const KNOWN_PROGRAMS: Record<string, string> = {
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter Swap',
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca Whirlpool',
  '9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP': 'Orca v2',
  'RVKd61ztZW9GUwhRbbLoYVRE5Xf1B2tVscKqwZqXgEr': 'Raydium',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium AMM',
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': 'Serum DEX',
  'DjVE6JNiYqPL2QXyCUUh8rNjHrbz9hXHNYt99MQ59qw1': 'Orca Token Swap',
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'SPL Token',
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bJL': 'Associated Token',
  'mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68': 'Marinade Finance',
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': 'Marinade Staking',
  'Stake11111111111111111111111111111111111111': 'Staking Program',
  'SysvarRent111111111111111111111111111111111': 'Rent Sysvar',
  'SysvarC1ock11111111111111111111111111111111': 'Clock Sysvar',
};

// ── Helius API Types ──────────────────────────────────────────────────────────

interface HeliusTokenTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  mint?: string;
  tokenAmount?: number;
  tokenStandard?: string;
}

interface HeliusNativeTransfer {
  fromUserAccount?: string;
  toUserAccount?: string;
  amount?: number; // lamports
}

interface HeliusEnhancedTx {
  signature: string;
  timestamp: number;
  slot: number;
  type: string;
  source: string;
  description?: string;
  fee: number;
  feePayer: string;
  nativeTransfers?: HeliusNativeTransfer[];
  tokenTransfers?: HeliusTokenTransfer[];
  accountData?: Array<{ account: string; nativeBalanceChange: number }>;
  events?: {
    swap?: {
      nativeInput?: { amount: number };
      nativeOutput?: { amount: number };
      tokenInputs?: Array<{ mint: string; tokenAmount: number; userAccount: string }>;
      tokenOutputs?: Array<{ mint: string; tokenAmount: number; userAccount: string }>;
    };
  };
}

// ── Stablecoin mint addresses ────────────────────────────────────────────────
const STABLECOIN_MINTS: Record<string, string> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX': 'USDH',
  'USDSwr9ApdHk57E8Ab6RtcB3tHmMnSxfNB16RmpVqVp': 'USDS',
};

// ── Known token prices (USD) — rough estimates for analysis, not trading ─────
// Updated periodically; used only when live price unavailable
const KNOWN_TOKEN_PRICES_USD: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.0,   // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0,   // USDT
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX': 1.0,   // USDH
  'USDSwr9ApdHk57E8Ab6RtcB3tHmMnSxfNB16RmpVqVp': 1.0,   // USDS
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': 2.5,   // JTO (approx)
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 0.45,  // JUP
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 230.0, // mSOL
  'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 230.0, // bSOL
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 230.0,// jitoSOL
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 230.0,// stSOL
  'So11111111111111111111111111111111111111112': 150.0,   // wSOL (wrapped SOL)
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 0.0001, // BONK
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 0.05, // WIF
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 0.5,  // PYTH
  'hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux': 5.0,   // HNT
  'mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6': 0.01,  // MOBILE
  'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns': 0.01,  // IOT
  'TNSRxcUxoT9xBG3de7A4QJ1Zd9pCKCfhxBBFHJg8cG': 0.3,   // TNSR
  'W1tokoumi6sGe1tcKL1hFY1yqmXiRWzJYiGH2N9GBPN': 0.5,  // W
};

// ── Categories that represent real spend (outgoing payments, fees, etc.) ─────
// Swaps, staking, and yield farming are capital movements, NOT spend.
// Incoming transfers are NOT spend regardless of category.
export const SPEND_CATEGORIES = new Set([
  'payroll',
  'subscription',
  'saas',
  'infrastructure',
  'contractor',
  'treasury_transfer',
  'exchange_deposit',
  'recurring_bill',
  'protocol_operation',
  'ai_infrastructure',
  'stablecoin_transfer',
  'sol_transfer',
  'unknown', // include unknowns so we don't under-report; exclude only explicit non-spend
]);

// These are capital movements / trading — do NOT count as spend
export const NON_SPEND_CATEGORIES = new Set([
  'swap',
  'yield_farming',
  'nft',
]);

// ── Category classifiers ──────────────────────────────────────────────────────

function classifyByType(type: string, source: string): TxCategory {
  const t = type.toLowerCase();
  const s = source.toLowerCase();

  if (t.includes('swap') || s.includes('jupiter') || s.includes('raydium') || s.includes('orca')) return 'swap';
  if (t.includes('stake') || t.includes('delegation')) return 'yield_farming';
  if (t.includes('nft') || t.includes('mint') || t.includes('burn')) return 'nft';
  if (s.includes('marinade')) return 'yield_farming';
  return 'unknown';
}

function classifyByCounterparty(address: string): TxCategory {
  // Known exchange hot wallets (heuristic)
  const exchangePatterns = [
    '5tzFkiKscXHK5ZXCGbXZxdw7gBjFzbcbFKuNkaNR6tBF', // Binance-like
    'AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2', // FTX-like
  ];
  if (exchangePatterns.some(p => address.startsWith(p.slice(0, 8)))) return 'exchange_deposit';
  return 'unknown';
}

// ── Main ingestion ────────────────────────────────────────────────────────────

// ── Fetch helper with retry on 429 ───────────────────────────────────────────

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url);
    if (res.status !== 429) return res;
    if (attempt === maxRetries) return res; // return the 429 to surface the error
    await new Promise(r => setTimeout(r, delay));
    delay *= 2; // exponential backoff: 1s → 2s → 4s
  }
  // unreachable but satisfies TS
  return fetch(url);
}

export async function ingestMainnetTransactions(
  wallet: string,
  apiKey: string,
  limit = 100,
  /** If provided, fetch transactions until we reach this unix timestamp (older than cutoff stops) */
  sinceTimestamp?: number,
  /** Max pages to fetch — lower this for public/unauthenticated callers to avoid rate limits */
  maxPages = 5,
): Promise<{ ingested: number; meaningful: number; filtered: number }> {
  if (!apiKey) throw new Error('HELIUS_API_KEY not configured');

  const db = getDb();

  let ingested = 0;
  let meaningful = 0;
  let filtered = 0;

  // Batch upsert prepared statement (reused across pages)
  const upsertTx = db.prepare(`
    INSERT OR REPLACE INTO mainnet_transactions
      (id, wallet, signature, block_time, slot, type, category, amount_sol, amount_usd,
       token_symbol, token_amount, counterparty, counterparty_label,
       is_filtered_noise, is_meaningful, is_outgoing, description, raw_json, ingested_at)
    VALUES
      (@id, @wallet, @signature, @blockTime, @slot, @type, @category, @amountSol, @amountUsd,
       @tokenSymbol, @tokenAmount, @counterparty, @counterpartyLabel,
       @isFilteredNoise, @isMeaningful, @isOutgoing, @description, @rawJson, @ingestedAt)
  `);

  const upsertMany = db.transaction((txList: ReturnType<typeof normalizeTx>[]) => {
    for (const t of txList) {
      upsertTx.run(t);
    }
  });

  // Paginate through Helius API using before= cursor
  let beforeCursor: string | undefined;
  const PAGE_SIZE = 100; // Helius max per page
  let keepFetching = true;
  let pagesFetched = 0;

  while (keepFetching && pagesFetched < maxPages) {
    // Note: do NOT pass &type=ALL — Helius returns [] for TRANSFER txs when that filter is used
    let url = `${HELIUS_BASE}/v0/addresses/${wallet}/transactions?api-key=${apiKey}&limit=${PAGE_SIZE}`;
    if (beforeCursor) url += `&before=${beforeCursor}`;

    const res = await fetchWithRetry(url);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        throw new Error('Helius rate limit reached. Please wait a moment and try again.');
      }
      throw new Error(`Helius API error ${res.status}: ${text.slice(0, 200)}`);
    }

    // Small delay between pages to stay within free-tier rate limits
    if (pagesFetched > 0) {
      await new Promise(r => setTimeout(r, 300));
    }

    const rawTxs: HeliusEnhancedTx[] = await res.json() as HeliusEnhancedTx[];
    pagesFetched++;

    if (rawTxs.length === 0) {
      keepFetching = false;
      break;
    }

    // Check if oldest tx on this page is older than the cutoff
    const oldestTxOnPage = rawTxs[rawTxs.length - 1];
    if (sinceTimestamp && oldestTxOnPage.timestamp < sinceTimestamp) {
      // Filter out txs older than the cutoff before persisting
      const filtered_page = rawTxs.filter(tx => tx.timestamp >= sinceTimestamp!);
      if (filtered_page.length > 0) {
        const normalized = filtered_page.map(raw => normalizeTx(raw, wallet));
        upsertMany(normalized);
        for (const n of normalized) {
          ingested++;
          if (n.isFilteredNoise) filtered++;
          else meaningful++;
        }
      }
      keepFetching = false;
      break;
    }

    const normalized = rawTxs.map(raw => normalizeTx(raw, wallet));
    upsertMany(normalized);

    for (const n of normalized) {
      ingested++;
      if (n.isFilteredNoise as number) filtered++;
      else meaningful++;
    }

    // Set cursor for next page (last signature fetched)
    beforeCursor = rawTxs[rawTxs.length - 1].signature;

    // If we got fewer than PAGE_SIZE, we've reached the end
    if (rawTxs.length < PAGE_SIZE) {
      keepFetching = false;
    }
  }

  // Update counterparty aggregates
  rebuildCounterparties(wallet);

  return { ingested, meaningful, filtered };
}

function normalizeTx(raw: HeliusEnhancedTx, wallet: string): Record<string, unknown> {
  const id = crypto.createHash('sha256').update(`${wallet}:${raw.signature}`).digest('hex').slice(0, 24);

  // Extract amounts
  let amountSol: number | undefined;
  let tokenSymbol: string | undefined;
  let tokenAmount: number | undefined;
  let counterparty: string | undefined;

  // Native SOL transfers
  if (raw.nativeTransfers && raw.nativeTransfers.length > 0) {
    for (const nt of raw.nativeTransfers) {
      if (nt.fromUserAccount === wallet || nt.toUserAccount === wallet) {
        const lamports = nt.amount ?? 0;
        const sol = lamports / 1_000_000_000;
        if (sol > (amountSol ?? 0)) {
          amountSol = sol;
          counterparty = nt.fromUserAccount === wallet ? nt.toUserAccount : nt.fromUserAccount;
        }
      }
    }
  }

  // Token transfers — capture all tokens, not just stablecoins
  let tokenMint: string | undefined;
  if (raw.tokenTransfers && raw.tokenTransfers.length > 0) {
    // Prefer stablecoins if present; otherwise take the largest non-dust transfer
    let bestUsd = 0;
    for (const tt of raw.tokenTransfers) {
      const mint = tt.mint ?? '';
      const amt = tt.tokenAmount ?? 0;
      if (amt <= 0) continue;

      // Determine if this wallet is involved (as sender, receiver, or referenced address)
      const walletInvolved =
        tt.fromUserAccount === wallet ||
        tt.toUserAccount === wallet ||
        // For mint/program accounts, every token transfer involving their mint is relevant
        mint === wallet;

      if (!walletInvolved) continue;

      const priceUsd = KNOWN_TOKEN_PRICES_USD[mint] ?? 0;
      const estimatedUsd = amt * priceUsd;

      // Pick the token transfer with highest USD value
      if (estimatedUsd > bestUsd || (bestUsd === 0 && amt > (tokenAmount ?? 0))) {
        bestUsd = estimatedUsd;
        tokenAmount = amt;
        tokenMint = mint;
        tokenSymbol = STABLECOIN_MINTS[mint] ?? (mint === wallet ? 'TOKEN' : mint.slice(0, 6).toUpperCase());
        // Counterparty: who is sending/receiving relative to the wallet
        if (tt.fromUserAccount === wallet) {
          counterparty = tt.toUserAccount;
        } else if (tt.toUserAccount === wallet) {
          counterparty = tt.fromUserAccount;
        } else {
          // Mint account scenario: use whichever non-wallet account appears
          counterparty = tt.toUserAccount ?? tt.fromUserAccount;
        }
      }
    }
  }

  // USD value — stablecoins 1:1, known tokens use price table, SOL at ~$150
  let amountUsd: number | undefined;
  if (tokenMint && tokenAmount) {
    const price = KNOWN_TOKEN_PRICES_USD[tokenMint];
    if (price !== undefined) {
      amountUsd = tokenAmount * price;
    } else {
      // Unknown token — leave amountUsd undefined so it shows as N/A but doesn't get marked noise
      amountUsd = undefined;
    }
  } else if (amountSol) {
    amountUsd = amountSol * 150; // default SOL price for classification
  }

  // Classify
  let category: TxCategory = classifyByType(raw.type ?? '', raw.source ?? '');
  if (category === 'unknown' && counterparty) {
    category = classifyByCounterparty(counterparty);
  }
  if (category === 'unknown') {
    if (tokenSymbol && ['USDC', 'USDT', 'USDH', 'USDS'].includes(tokenSymbol)) {
      category = 'stablecoin_transfer';
    } else if (amountSol) {
      category = 'sol_transfer';
    }
  }

  // Noise filter — keep anything with a real amount or unknown token price
  let isNoise = false;
  const isFee = (raw.type ?? '').toLowerCase().includes('fee');
  const tinyNativeSol = amountSol !== undefined && amountSol < MIN_SOL_AMOUNT && !tokenAmount;
  // Only mark USD-noise if we actually know the price; unknown tokens pass through
  const tinyUsd = amountUsd !== undefined && amountUsd < MIN_USD_AMOUNT;
  // If token exists but price is unknown, don't call it noise
  const hasUnknownPriceToken = tokenAmount !== undefined && tokenMint !== undefined && KNOWN_TOKEN_PRICES_USD[tokenMint] === undefined;
  const isRentOrSysvar = counterparty && Object.keys(KNOWN_PROGRAMS).some(
    p => counterparty!.startsWith(p.slice(0, 8)) && (KNOWN_PROGRAMS[p].includes('Sysvar') || KNOWN_PROGRAMS[p].includes('Rent'))
  );
  if (!hasUnknownPriceToken && (isFee || tinyNativeSol || tinyUsd || isRentOrSysvar)) {
    isNoise = true;
  }

  // Determine direction:
  // - Outgoing = wallet initiated the transfer (feePayer AND sending funds out)
  // - Swaps/staking: wallet is feePayer but funds go to a program, not a real spend
  // - Incoming = someone else sent funds to wallet
  const walletSentNative = raw.nativeTransfers?.some(nt => nt.fromUserAccount === wallet) ?? false;
  const walletSentToken  = raw.tokenTransfers?.some(tt => tt.fromUserAccount === wallet) ?? false;
  const walletReceived   = raw.nativeTransfers?.some(nt => nt.toUserAccount === wallet) ??
                           raw.tokenTransfers?.some(tt => tt.toUserAccount === wallet) ?? false;

  // A tx is outgoing if the wallet sent funds AND it's not purely a receive
  // Swaps are handled by category — they're outgoing in direction but not "spend"
  const isOutgoing = (walletSentNative || walletSentToken) && !walletReceived;

  // Build human description
  const isSender = walletSentNative || walletSentToken;
  let description = raw.description ?? '';
  if (!description) {
    if (tokenSymbol && tokenAmount) {
      const fmt = tokenAmount < 0.01 ? tokenAmount.toExponential(2) : tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 4 });
      description = `${isSender ? 'Sent' : 'Received'} ${fmt} ${tokenSymbol}`;
    } else if (amountSol) {
      description = `${isSender ? 'Sent' : 'Received'} ${amountSol.toFixed(4)} SOL`;
    } else {
      description = raw.type ?? 'Unknown transaction';
    }
  }

  const counterpartyLabel = counterparty
    ? (KNOWN_PROGRAMS[counterparty] ?? undefined)
    : undefined;

  return {
    id,
    wallet,
    signature: raw.signature,
    blockTime: raw.timestamp,
    slot: raw.slot ?? null,
    type: raw.type ?? 'UNKNOWN',
    category,
    amountSol: amountSol ?? null,
    amountUsd: amountUsd ?? null,
    tokenSymbol: tokenSymbol ?? null,
    tokenAmount: tokenAmount ?? null,
    counterparty: counterparty ?? null,
    counterpartyLabel: counterpartyLabel ?? null,
    isFilteredNoise: isNoise ? 1 : 0,
    isMeaningful: !isNoise ? 1 : 0,
    isOutgoing: isOutgoing ? 1 : 0,
    description,
    rawJson: JSON.stringify({ type: raw.type, source: raw.source, fee: raw.fee }),
    ingestedAt: Math.floor(Date.now() / 1000),
  };
}

// ── Counterparty aggregation ─────────────────────────────────────────────────

function rebuildCounterparties(wallet: string) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const rows = db.prepare(`
    SELECT
      counterparty,
      category,
      SUM(CASE WHEN is_outgoing = 1 AND amount_usd IS NOT NULL THEN amount_usd ELSE 0 END) as total_sent,
      SUM(CASE WHEN is_outgoing = 0 AND amount_usd IS NOT NULL THEN amount_usd ELSE 0 END) as total_received,
      COUNT(*) as tx_count,
      MIN(block_time) as first_seen,
      MAX(block_time) as last_seen
    FROM mainnet_transactions
    WHERE wallet = ? AND counterparty IS NOT NULL AND is_filtered_noise = 0
    GROUP BY counterparty
  `).all(wallet) as Array<{
    counterparty: string;
    category: TxCategory;
    total_sent: number;
    total_received: number;
    tx_count: number;
    first_seen: number;
    last_seen: number;
  }>;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO counterparties
      (id, wallet, address, label, category, total_sent_usd, total_received_usd,
       transaction_count, first_seen, last_seen, is_recurring)
    VALUES
      (@id, @wallet, @address, @label, @category, @totalSent, @totalReceived,
       @txCount, @firstSeen, @lastSeen, @isRecurring)
  `);

  type CounterpartyRow = typeof rows[number];
  const upsertAll = db.transaction((rowList: CounterpartyRow[]) => {
    for (const r of rowList) {
      const id = crypto.createHash('sha256').update(`${wallet}:${r.counterparty}`).digest('hex').slice(0, 24);
      upsert.run({
        id,
        wallet,
        address: r.counterparty,
        label: KNOWN_PROGRAMS[r.counterparty] ?? null,
        category: r.category,
        totalSent: r.total_sent,
        totalReceived: r.total_received,
        txCount: r.tx_count,
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
        isRecurring: r.tx_count >= 3 ? 1 : 0,
      });
    }
  });

  upsertAll(rows);
}

// ── Fetch stored transactions ─────────────────────────────────────────────────

export function getStoredTransactions(wallet: string, limit = 200, sinceTimestamp?: number): MainnetTransaction[] {
  const db = getDb();
  if (sinceTimestamp) {
    const rows = db.prepare(`
      SELECT * FROM mainnet_transactions
      WHERE wallet = ? AND is_filtered_noise = 0 AND block_time >= ?
      ORDER BY block_time DESC
      LIMIT ?
    `).all(wallet, sinceTimestamp, limit) as Array<Record<string, unknown>>;
    return rows.map(rowToTx);
  }
  const rows = db.prepare(`
    SELECT * FROM mainnet_transactions
    WHERE wallet = ? AND is_filtered_noise = 0
    ORDER BY block_time DESC
    LIMIT ?
  `).all(wallet, limit) as Array<Record<string, unknown>>;

  return rows.map(rowToTx);
}

export function getAllStoredTransactions(wallet: string, limit = 500): MainnetTransaction[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM mainnet_transactions
    WHERE wallet = ?
    ORDER BY block_time DESC
    LIMIT ?
  `).all(wallet, limit) as Array<Record<string, unknown>>;
  return rows.map(rowToTx);
}

function rowToTx(r: Record<string, unknown>): MainnetTransaction {
  return {
    id: r.id as string,
    wallet: r.wallet as string,
    signature: r.signature as string,
    blockTime: r.block_time as number,
    slot: r.slot as number | undefined,
    type: r.type as string,
    category: r.category as TxCategory,
    amountSol: r.amount_sol as number | undefined,
    amountUsd: r.amount_usd as number | undefined,
    tokenSymbol: r.token_symbol as string | undefined,
    tokenAmount: r.token_amount as number | undefined,
    counterparty: r.counterparty as string | undefined,
    counterpartyLabel: r.counterparty_label as string | undefined,
    isFilteredNoise: Boolean(r.is_filtered_noise),
    isMeaningful: Boolean(r.is_meaningful),
    isOutgoing: Boolean(r.is_outgoing),
    description: r.description as string | undefined,
    ingestedAt: r.ingested_at as number,
  };
}

export function getLastIngestedAt(wallet: string): number | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT MAX(ingested_at) as last FROM mainnet_transactions WHERE wallet = ?'
  ).get(wallet) as { last: number | null };
  return row?.last ?? null;
}

export function getSpendByCategory(wallet: string, sinceTimestamp?: number): Record<string, number> {
  const db = getDb();
  // Only count outgoing transactions in spend categories (exclude swaps, staking, incoming)
  const nonSpendList = `('swap','yield_farming','nft')`;
  if (sinceTimestamp) {
    const rows = db.prepare(`
      SELECT category, SUM(amount_usd) as total
      FROM mainnet_transactions
      WHERE wallet = ?
        AND is_filtered_noise = 0
        AND is_outgoing = 1
        AND amount_usd IS NOT NULL
        AND category NOT IN ${nonSpendList}
        AND block_time >= ?
      GROUP BY category
      ORDER BY total DESC
    `).all(wallet, sinceTimestamp) as Array<{ category: string; total: number }>;
    return Object.fromEntries(rows.map(r => [r.category, r.total ?? 0]));
  }
  const rows = db.prepare(`
    SELECT category, SUM(amount_usd) as total
    FROM mainnet_transactions
    WHERE wallet = ?
      AND is_filtered_noise = 0
      AND is_outgoing = 1
      AND amount_usd IS NOT NULL
      AND category NOT IN ${nonSpendList}
    GROUP BY category
    ORDER BY total DESC
  `).all(wallet) as Array<{ category: string; total: number }>;

  return Object.fromEntries(rows.map(r => [r.category, r.total ?? 0]));
}
