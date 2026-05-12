// ============================================================
// ACE Protocol — SOL Price Oracle API Route
//
// Fetches real-time SOL/USD price from CoinGecko public API.
// Falls back to a deterministic seed if the feed is unavailable.
// Production: replace with Pyth or Switchboard on-chain feed.
// ============================================================

import { NextResponse } from 'next/server';

const CACHE_TTL_MS = 30_000; // 30-second cache
let _cachedPrice: { priceUsd: number; timestamp: number; source: string } | null = null;

export async function GET() {
  const now = Date.now();

  // Return cached price if fresh
  if (_cachedPrice && now - _cachedPrice.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ..._cachedPrice, cached: true });
  }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true',
      { next: { revalidate: 30 }, signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

    const data = await res.json();
    const priceUsd: number = data?.solana?.usd;
    const change24h: number = data?.solana?.usd_24h_change ?? 0;

    if (!priceUsd || isNaN(priceUsd)) throw new Error('Invalid price data');

    _cachedPrice = { priceUsd, timestamp: now, source: 'coingecko' };

    return NextResponse.json({
      priceUsd,
      change24h: parseFloat(change24h.toFixed(2)),
      source: 'coingecko',
      timestamp: now,
      cached: false,
    });
  } catch (err) {
    // Deterministic fallback: seeded from hour + day to avoid wild swings
    const seed = Math.floor(now / 3_600_000); // changes hourly
    const base = 148;
    const variance = (Math.sin(seed * 17.3 + 42.7) * 0.5 + 0.5) * 20 - 10; // ±$10
    const fallbackPrice = parseFloat((base + variance).toFixed(2));

    _cachedPrice = { priceUsd: fallbackPrice, timestamp: now, source: 'fallback' };

    return NextResponse.json({
      priceUsd: fallbackPrice,
      change24h: 0,
      source: 'fallback',
      timestamp: now,
      cached: false,
      warning: 'Live price feed unavailable. Using seeded fallback.',
    });
  }
}
