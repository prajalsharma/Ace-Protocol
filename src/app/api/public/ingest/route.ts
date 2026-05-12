/**
 * Public wallet ingestion — no auth required.
 * Accepts a wallet address and fetches its Mainnet transaction history via Helius.
 * Rate-limited to once per 5 min per wallet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ingestMainnetTransactions, getLastIngestedAt } from '@root/services/heliusService';

const RANGE_SECONDS: Record<string, number> = {
  '30d':  30  * 86400,
  '90d':  90  * 86400,
  '180d': 180 * 86400,
  '1y':   365 * 86400,
  'all':  0,
};

// Basic Solana address validation
function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.HELIUS_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'HELIUS_API_KEY not configured.' },
      { status: 503 },
    );
  }

  let wallet = '';
  let rangeSlug = '30d';
  try {
    const body = await req.json() as { wallet?: string; range?: string };
    wallet = (body.wallet ?? '').trim();
    if (body.range && RANGE_SECONDS[body.range] !== undefined) rangeSlug = body.range;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!wallet || !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: 'Invalid Solana wallet address.' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const rangeSeconds = RANGE_SECONDS[rangeSlug] ?? RANGE_SECONDS['30d'];
  const sinceTimestamp = rangeSeconds > 0 ? now - rangeSeconds : undefined;

  // Rate limit: one ingest per wallet per 10 minutes for public callers
  const lastIngested = getLastIngestedAt(wallet);
  if (lastIngested && now - lastIngested < 600) {
    return NextResponse.json({
      ok: true,
      cached: true,
      message: 'Using cached data.',
      lastIngested,
      range: rangeSlug,
    });
  }

  try {
    // maxPages=3 → up to 300 txns; keeps public callers within Helius free-tier limits
    const result = await ingestMainnetTransactions(wallet, apiKey, 100, sinceTimestamp, 3);
    return NextResponse.json({ ok: true, ...result, lastIngested: now, range: rangeSlug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingestion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
