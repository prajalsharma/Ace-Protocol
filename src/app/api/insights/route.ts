// ============================================================
// ACE Protocol — AI Insights API Route
//
// Receives structured protocol state JSON.
// Returns human-readable explanations via Claude 3.7 Sonnet.
// AI NEVER modifies protocol state — explanation only.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export interface InsightRequest {
  reserveCoverage: 'healthy' | 'warning' | 'critical';
  upcomingPayments: number;
  totalUpcomingUsd: number;
  executionUrgency: 'low' | 'medium' | 'high';
  estimatedFee: number;
  reserveRatio: number;
  freeBalance: number;
  investableBalance: number;
  context?: string; // e.g. "payment_execution_failed"
}

export interface InsightResponse {
  summary: string;
  reserveExplanation: string;
  executionExplanation: string;
  recommendation: string;
  generatedBy: string;
}

function buildPrompt(state: InsightRequest): string {
  return `You are the ACE Protocol explanation engine. The deterministic financial engine has produced these computed values:

Reserve coverage status: ${state.reserveCoverage}
Upcoming payments count: ${state.upcomingPayments}
Total upcoming obligations: $${state.totalUpcomingUsd.toFixed(2)}
Execution urgency: ${state.executionUrgency}
Current network fee estimate: $${state.estimatedFee.toFixed(4)}
Reserve ratio: ${state.reserveRatio}%
Free (liquid) balance: $${state.freeBalance.toFixed(2)}
Investable (excess) balance: $${state.investableBalance.toFixed(2)}
${state.context ? `Context: ${state.context}` : ''}

Generate a JSON response with these four fields:
- summary: 1-2 sentence overview of current financial health
- reserveExplanation: explain WHY reserve is at this level (reference payments/timing)
- executionExplanation: explain the execution timing recommendation (reference fees/urgency)
- recommendation: one clear actionable suggestion for the user

Rules:
- Never suggest moving funds autonomously
- Never invent numbers beyond what is provided
- Be specific, deterministic, and honest about simulation mode
- Keep each field under 60 words
- Response must be valid JSON only, no markdown`;
}

// Deterministic fallback when no AI key is configured
function deterministicFallback(state: InsightRequest): InsightResponse {
  const reserveMsg =
    state.reserveCoverage === 'healthy'
      ? `Reserve is healthy at ${state.reserveRatio}% of vault.`
      : state.reserveCoverage === 'warning'
      ? `Reserve at ${state.reserveRatio}% — below recommended threshold.`
      : `Reserve critically low. Immediate attention required.`;

  const urgencyMsg =
    state.executionUrgency === 'low'
      ? `Execution urgency is low. Delaying can reduce fee cost ($${state.estimatedFee.toFixed(4)}).`
      : state.executionUrgency === 'medium'
      ? `Execution urgency is medium. Execute within the next few hours.`
      : `High urgency — execute immediately regardless of fee conditions.`;

  return {
    summary: `Vault has $${state.freeBalance.toFixed(2)} liquid and $${state.investableBalance.toFixed(2)} investable. ${reserveMsg}`,
    reserveExplanation: `Reserve covers ${state.upcomingPayments} upcoming payment(s) totalling $${state.totalUpcomingUsd.toFixed(2)}. ${reserveMsg}`,
    executionExplanation: urgencyMsg,
    recommendation:
      state.reserveCoverage === 'critical'
        ? 'Deposit funds or reduce scheduled payment amounts to restore reserve safety.'
        : state.investableBalance > 500
        ? 'Consider allocating excess investable balance to a yield strategy.'
        : 'Current allocation is balanced. Monitor reserve as payment dates approach.',
    generatedBy: 'deterministic-fallback',
  };
}

function validateBody(body: unknown): body is InsightRequest {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  const validCoverage = ['healthy', 'warning', 'critical'];
  const validUrgency = ['low', 'medium', 'high'];
  return (
    validCoverage.includes(b.reserveCoverage as string) &&
    validUrgency.includes(b.executionUrgency as string) &&
    typeof b.upcomingPayments === 'number' &&
    typeof b.totalUpcomingUsd === 'number' &&
    typeof b.estimatedFee === 'number' &&
    typeof b.reserveRatio === 'number' &&
    typeof b.freeBalance === 'number' &&
    typeof b.investableBalance === 'number'
  );
}

export async function POST(req: NextRequest) {
  let body: InsightRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      { error: 'Missing or invalid required fields. Expected: reserveCoverage, executionUrgency, upcomingPayments, totalUpcomingUsd, estimatedFee, reserveRatio, freeBalance, investableBalance' },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;

  // No AI key — use deterministic fallback (always works, no hallucination)
  if (!apiKey) {
    return NextResponse.json(deterministicFallback(body));
  }

  // Claude 3.7 Sonnet path
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 400,
          messages: [{ role: 'user', content: buildPrompt(body) }],
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) throw new Error(`Anthropic API ${res.status}`);

      const data = await res.json();
      const text: string = data?.content?.[0]?.text ?? '';
      const parsed: InsightResponse = JSON.parse(text);
      parsed.generatedBy = 'claude-sonnet-4-5';
      return NextResponse.json(parsed);
    } catch (err) {
      console.error('[ACE insights] Claude failed, using fallback:', err);
      return NextResponse.json(deterministicFallback(body));
    }
  }

  // GPT-4.1 path
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: buildPrompt(body) }],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`OpenAI API ${res.status}`);

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const parsed: InsightResponse = JSON.parse(text);
    parsed.generatedBy = 'gpt-4.1';
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[ACE insights] OpenAI failed, using fallback:', err);
    return NextResponse.json(deterministicFallback(body));
  }
}
