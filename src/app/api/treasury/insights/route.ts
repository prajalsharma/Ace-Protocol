import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { generateTreasuryInsights, getStoredInsights } from '@root/services/aiTreasuryService';
import { getProtocolState } from '@root/services/treasuryService';

export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const insights = getStoredInsights(session.wallet);
  return NextResponse.json({ insights });
}

const RANGE_SECONDS: Record<string, number> = {
  '30d':  30  * 86400,
  '90d':  90  * 86400,
  '180d': 180 * 86400,
  '1y':   365 * 86400,
  'all':  0,
};

const RANGE_LABELS: Record<string, string> = {
  '30d': 'Last 30 Days', '90d': 'Last 90 Days',
  '180d': 'Last 180 Days', '1y': 'Last 1 Year', 'all': 'All Available History',
};

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not configured. Add it to .env.local to enable AI insights.' },
      { status: 503 },
    );
  }

  const rangeSlug = req.nextUrl.searchParams.get('range') ?? '30d';
  const validRange = RANGE_SECONDS[rangeSlug] !== undefined ? rangeSlug : '30d';
  const rangeSeconds = RANGE_SECONDS[validRange] ?? RANGE_SECONDS['30d'];
  const now = Math.floor(Date.now() / 1000);
  const sinceTimestamp = rangeSeconds > 0 ? now - rangeSeconds : undefined;
  const rangeLabel = RANGE_LABELS[validRange];

  let vaultBalance = 0;
  try {
    const state = await getProtocolState(session.wallet);
    vaultBalance = state.vault?.totalDeposited ?? 0;
  } catch {
    // Non-fatal
  }

  try {
    const insights = await generateTreasuryInsights(session.wallet, vaultBalance, apiKey, sinceTimestamp, rangeLabel);
    return NextResponse.json({ insights });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Insight generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
