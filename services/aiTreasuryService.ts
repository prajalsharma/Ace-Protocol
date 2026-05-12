/**
 * AI Treasury Intelligence Service
 *
 * Uses OpenAI gpt-4.1-mini (Responses API) to generate treasury insights,
 * spending summaries, reserve recommendations, and runway forecasts.
 *
 * Designed to never fabricate transaction data — only reasons over
 * provided normalized transaction summaries.
 */

import crypto from 'crypto';
import { getDb } from '@root/backend/db';
import {
  detectRecurringPatterns,
  aggregateSpendByCategory,
  getMonthlyBurnUsd,
  getStoredPatterns,
  calculateRunway,
  CATEGORY_LABELS,
} from './patternEngine';
import { getStoredTransactions, getLastIngestedAt } from './heliusService';
import type {
  AiTreasuryInsight,
  TreasuryAnalysis,
  TreasuryPrediction,
  MainnetTransaction,
  RecurringPattern,
} from '@root/src/types';

const OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';

// ── OpenAI Responses API call ─────────────────────────────────────────────────

async function callOpenAI(
  systemPrompt: string,
  userContent: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_output_tokens: 800,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as {
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  // Responses API returns output array
  const text = data.output?.[0]?.content?.[0]?.text ?? '';
  return text.trim();
}

// ── Build context summary for AI ─────────────────────────────────────────────

function buildTreasuryContext(
  wallet: string,
  transactions: MainnetTransaction[],
  patterns: RecurringPattern[],
  spendByCategory: Record<string, number>,
  monthlyBurn: number,
  vaultBalanceUsd: number,
  rangeLabel?: string,
): string {
  const recentTxSummary = transactions.slice(0, 20).map(tx =>
    `- ${new Date(tx.blockTime * 1000).toISOString().split('T')[0]} | ${CATEGORY_LABELS[tx.category] ?? tx.category} | ${
      tx.amountUsd ? `$${tx.amountUsd.toFixed(2)}` : tx.amountSol ? `${tx.amountSol.toFixed(4)} SOL` : 'N/A'
    } | ${tx.description ?? 'no description'}`
  ).join('\n');

  const categoryBreakdown = Object.entries(spendByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([cat, usd]) => `- ${CATEGORY_LABELS[cat] ?? cat}: $${usd.toFixed(2)}`)
    .join('\n');

  const recurringList = patterns.slice(0, 8).map(p =>
    `- ${p.label ?? p.counterpartyAddress?.slice(0, 8) ?? 'Unknown'}: avg $${p.avgAmountUsd.toFixed(2)} every ${p.frequencyDays.toFixed(1)} days (confidence ${(p.confidence * 100).toFixed(0)}%) — next predicted: ${
      p.nextPredicted ? new Date(p.nextPredicted * 1000).toISOString().split('T')[0] : 'unknown'
    }`
  ).join('\n');

  return `
WALLET: ${wallet.slice(0, 8)}...${wallet.slice(-4)}
VAULT BALANCE: $${vaultBalanceUsd.toFixed(2)} USD
ANALYSIS RANGE: ${rangeLabel ?? 'Last 30 days'}
MONTHLY BURN RATE (normalized): $${monthlyBurn.toFixed(2)} USD

SPENDING BY CATEGORY:
${categoryBreakdown || 'No categorized spend data yet.'}

RECURRING PATTERNS DETECTED:
${recurringList || 'No recurring patterns detected yet.'}

RECENT TRANSACTIONS (last 20 in range):
${recentTxSummary || 'No transactions available in selected range.'}
`.trim();
}

// ── Main insight generation ──────────────────────────────────────────────────

export async function generateTreasuryInsights(
  wallet: string,
  vaultBalanceUsd: number,
  apiKey: string,
  sinceTimestamp?: number,
  rangeLabel?: string,
): Promise<AiTreasuryInsight[]> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const transactions = getStoredTransactions(wallet, 200, sinceTimestamp);
  const patterns = getStoredPatterns(wallet);
  const spendByCategory = aggregateSpendByCategory(wallet, sinceTimestamp);
  const monthlyBurn = getMonthlyBurnUsd(wallet, sinceTimestamp);

  if (transactions.length === 0) {
    const rangeHint = rangeLabel && rangeLabel !== 'ALL' ? rangeLabel : '';
    return [{
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      wallet,
      type: 'summary',
      title: rangeHint ? `Limited activity in ${rangeHint} window` : 'No recent transaction history',
      body: rangeHint
        ? `Limited activity detected in the ${rangeHint} window. Expanding to a longer range (90D, 180D, or 1Y) may surface recurring patterns and improve forecasting accuracy.`
        : 'Connect your Mainnet wallet and run analysis to see AI-powered treasury insights.',
      confidence: 1.0,
      model: OPENAI_MODEL,
      generatedAt: now,
    }];
  }

  const context = buildTreasuryContext(wallet, transactions, patterns, spendByCategory, monthlyBurn, vaultBalanceUsd, rangeLabel);

  const systemPrompt = `You are ACE — an AI CFO and treasury intelligence system for Web3 organizations and crypto-native DAOs.

Your job is to analyze Solana mainnet treasury activity and generate precise, actionable insights.

RULES:
1. NEVER fabricate transaction details, counterparty names, or amounts not in the data.
2. If uncertain, say so explicitly. Do not guess.
3. Use plain language — no technical jargon unless necessary.
4. Always include a confidence score (0.0–1.0) at the end of your response as JSON.
5. Be concise — max 3 sentences per insight.
6. Frame insights as if advising a CFO.

RESPONSE FORMAT (JSON array):
[
  {
    "type": "summary|recurring|reserve|forecast|risk|idle_capital",
    "title": "Short headline (max 8 words)",
    "body": "Detailed insight (2-3 sentences max)",
    "confidence": 0.0-1.0
  }
]

Generate 3-5 high-value insights only. Do not generate filler insights.`;

  const userPrompt = `Analyze this treasury data and generate 3-5 actionable insights:\n\n${context}`;

  let rawResponse = '';
  try {
    rawResponse = await callOpenAI(systemPrompt, userPrompt, apiKey);
  } catch (err) {
    // Return a graceful degradation insight
    return [{
      id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
      wallet,
      type: 'summary',
      title: 'AI analysis unavailable',
      body: `Local pattern analysis found ${patterns.length} recurring patterns and $${monthlyBurn.toFixed(2)} monthly burn. Configure OPENAI_API_KEY for full AI insights.`,
      confidence: 0.9,
      model: 'local',
      generatedAt: now,
    }];
  }

  // Parse JSON from response (handle markdown code blocks)
  let parsed: Array<{ type: string; title: string; body: string; confidence: number }> = [];
  try {
    const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: treat as single insight
    parsed = [{
      type: 'summary',
      title: 'Treasury Analysis',
      body: rawResponse.slice(0, 400),
      confidence: 0.7,
    }];
  }

  const insights: AiTreasuryInsight[] = parsed.map(p => ({
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
    wallet,
    type: p.type as AiTreasuryInsight['type'],
    title: p.title,
    body: p.body,
    confidence: Math.min(1, Math.max(0, p.confidence ?? 0.7)),
    model: OPENAI_MODEL,
    generatedAt: now,
  }));

  // Persist insights
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO ai_treasury_insights
      (id, wallet, type, title, body, confidence, model, generated_at)
    VALUES
      (@id, @wallet, @type, @title, @body, @confidence, @model, @generatedAt)
  `);

  const upsertAll = db.transaction((items: typeof insights) => {
    for (const i of items) {
      upsert.run({
        id: i.id,
        wallet: i.wallet,
        type: i.type,
        title: i.title,
        body: i.body,
        confidence: i.confidence,
        model: i.model,
        generatedAt: i.generatedAt,
      });
    }
  });
  upsertAll(insights);

  return insights;
}

// ── Forecast generation ──────────────────────────────────────────────────────

export function generateForecast(
  wallet: string,
  vaultBalanceUsd: number,
  monthlyBurn: number,
): TreasuryPrediction {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const patterns = getStoredPatterns(wallet);
  const spendByCategory = aggregateSpendByCategory(wallet);

  // Build predicted spend over next 30 days from patterns
  const nextMonthPredicted = patterns.reduce((sum, p) => {
    if (!p.nextPredicted) return sum;
    const daysUntil = (p.nextPredicted - now) / 86400;
    if (daysUntil <= 30 && daysUntil >= 0) {
      return sum + p.avgAmountUsd;
    }
    return sum;
  }, 0);

  // Use historical burn as baseline if pattern prediction is low
  const predictedSpend = Math.max(nextMonthPredicted, monthlyBurn * 0.8);
  const runway = calculateRunway(vaultBalanceUsd, monthlyBurn);
  const reserveRec = predictedSpend * 1.5; // 1.5x buffer

  const prediction: TreasuryPrediction = {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
    wallet,
    periodLabel: 'Next 30 days',
    predictedSpendUsd: predictedSpend,
    predictedCategories: spendByCategory,
    confidence: patterns.length > 0 ? 0.75 : 0.45,
    runwayDays: runway,
    reserveRecommendationUsd: reserveRec,
    generatedAt: now,
  };

  db.prepare(`
    INSERT OR REPLACE INTO treasury_predictions
      (id, wallet, period_label, predicted_spend_usd, predicted_categories,
       confidence, runway_days, reserve_recommendation_usd, generated_at)
    VALUES
      (@id, @wallet, @periodLabel, @predictedSpendUsd, @predictedCategories,
       @confidence, @runwayDays, @reserveRecommendationUsd, @generatedAt)
  `).run({
    id: prediction.id,
    wallet: prediction.wallet,
    periodLabel: prediction.periodLabel,
    predictedSpendUsd: prediction.predictedSpendUsd,
    predictedCategories: JSON.stringify(prediction.predictedCategories ?? {}),
    confidence: prediction.confidence,
    runwayDays: prediction.runwayDays ?? null,
    reserveRecommendationUsd: prediction.reserveRecommendationUsd ?? null,
    generatedAt: prediction.generatedAt,
  });

  return prediction;
}

// ── Load stored insights ────────────────────────────────────────────────────

export function getStoredInsights(wallet: string): AiTreasuryInsight[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM ai_treasury_insights
    WHERE wallet = ?
    ORDER BY generated_at DESC
    LIMIT 20
  `).all(wallet) as Array<Record<string, unknown>>;

  return rows.map(r => ({
    id: r.id as string,
    wallet: r.wallet as string,
    type: r.type as AiTreasuryInsight['type'],
    title: r.title as string,
    body: r.body as string,
    confidence: r.confidence as number,
    model: r.model as string,
    generatedAt: r.generated_at as number,
  }));
}

export function getStoredPredictions(wallet: string): TreasuryPrediction[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM treasury_predictions
    WHERE wallet = ?
    ORDER BY generated_at DESC
    LIMIT 5
  `).all(wallet) as Array<Record<string, unknown>>;

  return rows.map(r => ({
    id: r.id as string,
    wallet: r.wallet as string,
    periodLabel: r.period_label as string,
    predictedSpendUsd: r.predicted_spend_usd as number,
    predictedCategories: JSON.parse(r.predicted_categories as string ?? '{}') as Record<string, number>,
    confidence: r.confidence as number,
    runwayDays: r.runway_days as number | undefined,
    reserveRecommendationUsd: r.reserve_recommendation_usd as number | undefined,
    generatedAt: r.generated_at as number,
  }));
}

// ── Full analysis orchestration ──────────────────────────────────────────────

export async function runFullTreasuryAnalysis(
  wallet: string,
  vaultBalanceUsd: number,
  apiKey: string | null,
  openAiKey: string | null,
  sinceTimestamp?: number,
  rangeLabel?: string,
): Promise<TreasuryAnalysis> {
  const now = Math.floor(Date.now() / 1000);

  // Run local analysis (QVAC-style local processing)
  const patterns = detectRecurringPatterns(wallet, sinceTimestamp);
  const transactions = getStoredTransactions(wallet, 200, sinceTimestamp);
  const spendByCategory = aggregateSpendByCategory(wallet, sinceTimestamp);
  const monthlyBurn = getMonthlyBurnUsd(wallet, sinceTimestamp);

  // Count untagged recurring
  const untaggedCount = patterns.filter(p => !p.isConfirmed && p.confidence >= 0.4).length;

  // AI insights (if OpenAI key available)
  let insights: AiTreasuryInsight[] = [];
  if (openAiKey) {
    try {
      insights = await generateTreasuryInsights(wallet, vaultBalanceUsd, openAiKey, sinceTimestamp, rangeLabel);
    } catch {
      insights = getStoredInsights(wallet);
    }
  } else {
    insights = getStoredInsights(wallet);
  }

  // Forecast
  const prediction = generateForecast(wallet, vaultBalanceUsd, monthlyBurn);

  // Reserve health score (0–100)
  const reserveRatio = vaultBalanceUsd > 0 ? (prediction.reserveRecommendationUsd ?? 0) / vaultBalanceUsd : 0;
  const reserveHealthScore = Math.max(0, Math.min(100, 100 - reserveRatio * 100));

  // Get counterparties from DB
  const db = getDb();
  const cpRows = db.prepare(`
    SELECT * FROM counterparties WHERE wallet = ? ORDER BY total_sent_usd DESC LIMIT 20
  `).all(wallet) as Array<Record<string, unknown>>;

  const counterparties = cpRows.map(r => ({
    id: r.id as string,
    wallet: r.wallet as string,
    address: r.address as string,
    label: r.label as string | undefined,
    category: r.category as import('@root/src/types').TxCategory,
    totalSentUsd: r.total_sent_usd as number,
    totalReceivedUsd: r.total_received_usd as number,
    transactionCount: r.transaction_count as number,
    firstSeen: r.first_seen as number,
    lastSeen: r.last_seen as number,
    isRecurring: Boolean(r.is_recurring),
  }));

  return {
    wallet,
    transactions,
    counterparties,
    recurringPatterns: patterns,
    insights,
    predictions: [prediction],
    spendByCategory,
    monthlyBurnUsd: monthlyBurn,
    runwayDays: prediction.runwayDays,
    reserveHealthScore,
    lastAnalyzedAt: now,
    transactionCount: transactions.length,
    untaggedCount,
    processedLocally: true,
  };
}
