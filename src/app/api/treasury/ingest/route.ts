import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { ingestMainnetTransactions, getLastIngestedAt } from '@root/services/heliusService';

// Maps range slug → seconds back from now
const RANGE_SECONDS: Record<string, number> = {
  '30d':  30  * 86400,
  '90d':  90  * 86400,
  '180d': 180 * 86400,
  '1y':   365 * 86400,
  'all':  0, // no cutoff
};

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const apiKey = process.env.HELIUS_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'HELIUS_API_KEY not configured. Add it to .env.local to enable mainnet analysis.' },
      { status: 503 },
    );
  }

  // Parse requested range from body
  let rangeSlug = '30d';
  try {
    const body = await req.json() as { range?: string };
    if (body.range && RANGE_SECONDS[body.range] !== undefined) {
      rangeSlug = body.range;
    }
  } catch { /* use default */ }

  const now = Math.floor(Date.now() / 1000);
  const rangeSeconds = RANGE_SECONDS[rangeSlug] ?? RANGE_SECONDS['30d'];
  const sinceTimestamp = rangeSeconds > 0 ? now - rangeSeconds : undefined;

  // Rate limit: re-ingest max once every 5 minutes per range
  const lastIngested = getLastIngestedAt(session.wallet);
  if (lastIngested && now - lastIngested < 300 && rangeSlug === '30d') {
    return NextResponse.json({
      ok: true,
      cached: true,
      message: `Using recent data (${rangeSlug.toUpperCase()} range). Re-analysis available in a few minutes.`,
      lastIngested,
      range: rangeSlug,
    });
  }

  try {
    const result = await ingestMainnetTransactions(session.wallet, apiKey, 100, sinceTimestamp);
    return NextResponse.json({ ok: true, ...result, lastIngested: now, range: rangeSlug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingestion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
