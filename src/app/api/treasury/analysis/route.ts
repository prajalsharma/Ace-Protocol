import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { runFullTreasuryAnalysis } from '@root/services/aiTreasuryService';
import { getProtocolState } from '@root/services/treasuryService';

// Maps range slug → seconds back from now
const RANGE_SECONDS: Record<string, number> = {
  '30d':  30  * 86400,
  '90d':  90  * 86400,
  '180d': 180 * 86400,
  '1y':   365 * 86400,
  'all':  0, // no cutoff
};

const RANGE_LABELS: Record<string, string> = {
  '30d':  'Last 30 Days',
  '90d':  'Last 90 Days',
  '180d': 'Last 180 Days',
  '1y':   'Last 1 Year',
  'all':  'All Available History',
};

export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    // Get vault balance for context
    let vaultBalance = 0;
    try {
      const state = await getProtocolState(session.wallet);
      vaultBalance = state.vault?.totalDeposited ?? 0;
    } catch {
      // Non-fatal
    }

    // Parse time range from query param
    const rangeSlug = req.nextUrl.searchParams.get('range') ?? '30d';
    const validRange = RANGE_SECONDS[rangeSlug] !== undefined ? rangeSlug : '30d';
    const rangeSeconds = RANGE_SECONDS[validRange] ?? RANGE_SECONDS['30d'];
    const now = Math.floor(Date.now() / 1000);
    const sinceTimestamp = rangeSeconds > 0 ? now - rangeSeconds : undefined;
    const rangeLabel = RANGE_LABELS[validRange] ?? RANGE_LABELS['30d'];

    const heliusKey = process.env.HELIUS_API_KEY ?? null;
    const openAiKey = process.env.OPENAI_API_KEY ?? null;

    const analysis = await runFullTreasuryAnalysis(
      session.wallet,
      vaultBalance,
      heliusKey,
      openAiKey,
      sinceTimestamp,
      rangeLabel,
    );

    return NextResponse.json({ ...analysis, rangeLabel, rangeSlug: validRange });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
