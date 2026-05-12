/**
 * Public wallet analysis — no auth required.
 * Returns treasury intelligence summary for any Solana wallet address.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runFullTreasuryAnalysis } from '@root/services/aiTreasuryService';

const RANGE_SECONDS: Record<string, number> = {
  '30d':  30  * 86400,
  '90d':  90  * 86400,
  '180d': 180 * 86400,
  '1y':   365 * 86400,
  'all':  0,
};

const RANGE_LABELS: Record<string, string> = {
  '30d':  'Last 30 Days',
  '90d':  'Last 90 Days',
  '180d': 'Last 180 Days',
  '1y':   'Last 1 Year',
  'all':  'All Available History',
};

function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get('wallet') ?? '').trim();
  const rangeSlug = req.nextUrl.searchParams.get('range') ?? '30d';

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid Solana wallet address.' }, { status: 400 });
  }

  const validRange = RANGE_SECONDS[rangeSlug] !== undefined ? rangeSlug : '30d';
  const rangeSeconds = RANGE_SECONDS[validRange] ?? RANGE_SECONDS['30d'];
  const now = Math.floor(Date.now() / 1000);
  const sinceTimestamp = rangeSeconds > 0 ? now - rangeSeconds : undefined;
  const rangeLabel = RANGE_LABELS[validRange] ?? RANGE_LABELS['30d'];

  const heliusKey = process.env.HELIUS_API_KEY ?? null;
  const openAiKey = process.env.OPENAI_API_KEY ?? null;

  try {
    const analysis = await runFullTreasuryAnalysis(
      wallet,
      0, // no vault balance for public analysis
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
