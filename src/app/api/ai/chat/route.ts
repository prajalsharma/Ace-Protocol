import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { getProtocolState } from '@root/services/treasuryService';

// ─── ACE Treasury AI Assistant ────────────────────────────────────────────────
// Uses OpenAI Responses API with model gpt-4.1-mini.
// AI NEVER moves funds or modifies state — explanation and advice only.
// Every response includes confidence, reasoning, and reserve impact.

interface ChatRequest {
  message: string;
  context?: string;
  mode?: 'treasury' | 'qvac';
}

interface ChatResponse {
  reply: string;
  confidence: number;
  reserveImpact: string;
  reasoning: string;
  model: string;
}

function buildSystemPrompt(context: string): string {
  return `You are ACE, the AI treasury assistant for the ACE Protocol — an AI-assisted treasury operating system built on Solana.

Your role:
- Explain treasury status, risks, and reserve health
- Recommend reserve adjustments and payment strategies
- Forecast runway based on scheduled payments
- Classify and explain payment categories
- Explain why payments were delayed or blocked

Treasury context:
${context}

STRICT RULES:
- NEVER suggest directly moving funds autonomously
- NEVER bypass spending caps or reserve minimums
- NEVER override policy constraints
- Always include confidence score (0.0–1.0) in your reasoning
- Always mention reserve impact of any recommendation
- Keep responses concise (under 120 words)
- Be honest about simulation/devnet status
- If asked about something outside treasury, politely redirect

Response format (JSON):
{
  "reply": "Your conversational response here",
  "confidence": 0.85,
  "reserveImpact": "No direct impact / +$X to reserve / -$X from reserve",
  "reasoning": "Why you gave this recommendation"
}`;
}

function deterministicResponse(message: string, context: string): ChatResponse {
  const lower = message.toLowerCase();

  if (lower.includes('runway')) {
    return {
      reply: `Based on your current scheduled payments and reserve balance, I can estimate your treasury runway. ${context.includes('vault') ? 'Review your reserve health and upcoming obligations to get an accurate runway estimate.' : 'Upload transaction data to get a precise runway forecast.'}`,
      confidence: 0.78,
      reserveImpact: 'No direct impact — analysis only',
      reasoning: 'Runway calculation based on current reserve ratio and payment obligations',
      model: 'deterministic-fallback',
    };
  }

  if (lower.includes('reserve')) {
    return {
      reply: 'Your reserve buffer should stay above 15% of total deposits. If you have upcoming payments within 7 days, consider increasing reserve allocation before deploying capital to yield strategies.',
      confidence: 0.91,
      reserveImpact: 'Recommending reserve increase if below threshold',
      reasoning: 'Reserve health is the first priority before yield deployment',
      model: 'deterministic-fallback',
    };
  }

  if (lower.includes('payment') || lower.includes('payroll')) {
    return {
      reply: 'Recurring payments are scheduled and will execute automatically in Autopilot mode once reserve checks pass. In Safe Mode, each payment requires manual approval before execution.',
      confidence: 0.87,
      reserveImpact: 'Impact depends on payment amount vs available liquid balance',
      reasoning: 'Payment execution follows policy guardrails',
      model: 'deterministic-fallback',
    };
  }

  if (lower.includes('yield') || lower.includes('apy') || lower.includes('earn')) {
    return {
      reply: 'Idle stablecoins above the reserve floor are eligible for yield deployment. The protocol routes excess capital to yield strategies while maintaining your configured reserve percentage.',
      confidence: 0.83,
      reserveImpact: 'Yield deployment reduces liquid balance but maintains reserve minimum',
      reasoning: 'Yield allocation should only occur after reserve requirements are satisfied',
      model: 'deterministic-fallback',
    };
  }

  if (lower.includes('risk') || lower.includes('safe')) {
    return {
      reply: 'ACE enforces multiple safety layers: reserve floor (15%), spending caps, destination whitelists, and manual approval thresholds. All autopilot actions are bounded by your policy settings.',
      confidence: 0.95,
      reserveImpact: 'Policy constraints prevent reserve from dropping below minimum',
      reasoning: 'Safety is enforced deterministically at the policy engine layer',
      model: 'deterministic-fallback',
    };
  }

  return {
    reply: 'I can help you understand your treasury status, reserve health, payment schedules, and yield strategies. What would you like to know?',
    confidence: 0.70,
    reserveImpact: 'No direct impact',
    reasoning: 'General guidance — specify a topic for targeted analysis',
    model: 'deterministic-fallback',
  };
}

export async function POST(req: NextRequest) {
  let body: ChatRequest;
  try {
    body = await req.json() as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  // Build context from protocol state if authenticated
  let treasuryContext = body.context ?? 'No treasury data available.';

  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (session) {
    try {
      const state = await getProtocolState(session.wallet);
      treasuryContext = [
        `Wallet: ${session.wallet.slice(0, 8)}…`,
        `Total deposited: $${state.vault.totalDeposited.toFixed(2)}`,
        `Reserve balance: $${state.vault.reserveBalance.toFixed(2)} (${state.vault.totalDeposited > 0 ? ((state.vault.reserveBalance / state.vault.totalDeposited) * 100).toFixed(1) : 0}% ratio)`,
        `Liquid balance: $${state.vault.liquidBalance.toFixed(2)}`,
        `Yield balance: $${state.vault.yieldBalance.toFixed(2)} at ${state.vault.apy}% APY`,
        `Operation mode: ${state.vault.operationMode}`,
        `AI payment cap: $${state.vault.aiPaymentCapUsd}`,
        `Scheduled payments: ${state.payments.filter(p => p.status === 'scheduled').length}`,
        `Upcoming obligations (7d): $${state.payments.filter(p => p.status === 'scheduled' && p.nextDue < Math.floor(Date.now() / 1000) + 7 * 86400).reduce((s, p) => s + p.amountUsd, 0).toFixed(2)}`,
        state.insights.length > 0 ? `Active insights: ${state.insights.map(i => i.title).join(', ')}` : 'No active insights',
      ].join('\n');
    } catch {
      // Keep provided context
    }
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(deterministicResponse(body.message, treasuryContext));
  }

  // OpenAI Responses API with gpt-4.1-mini
  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        instructions: buildSystemPrompt(treasuryContext),
        input: body.message,
        text: {
          format: {
            type: 'json_object',
          },
        },
        max_output_tokens: 300,
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[ACE chat] OpenAI Responses API error:', res.status, err);
      // Fall through to chat completions fallback
      throw new Error(`OpenAI ${res.status}`);
    }

    const data = await res.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
    const text = data?.output?.[0]?.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text) as Partial<ChatResponse>;

    return NextResponse.json({
      reply: parsed.reply ?? 'I encountered an issue processing your request.',
      confidence: parsed.confidence ?? 0.75,
      reserveImpact: parsed.reserveImpact ?? 'Unknown',
      reasoning: parsed.reasoning ?? '',
      model: 'gpt-4.1-mini',
    });
  } catch {
    // Fallback to chat completions API (gpt-4o-mini for compatibility)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          max_tokens: 300,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: buildSystemPrompt(treasuryContext) },
            { role: 'user', content: body.message },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) throw new Error(`Chat completions ${res.status}`);

      const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = data?.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(text) as Partial<ChatResponse>;

      return NextResponse.json({
        reply: parsed.reply ?? 'I encountered an issue processing your request.',
        confidence: parsed.confidence ?? 0.75,
        reserveImpact: parsed.reserveImpact ?? 'Unknown',
        reasoning: parsed.reasoning ?? '',
        model: 'gpt-4.1-mini',
      });
    } catch (err2) {
      console.error('[ACE chat] All AI paths failed:', err2);
      return NextResponse.json(deterministicResponse(body.message, treasuryContext));
    }
  }
}
