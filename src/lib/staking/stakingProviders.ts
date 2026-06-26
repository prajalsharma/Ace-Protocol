// ============================================================
// ACE Protocol — Multi-Aggregator Staking & Restaking
//
// ACE routes idle yield capital across every major Solana
// staking aggregator and restaking venue. We are LIVE on
// SolBlaze (bSOL) on Mainnet today; Jito and Hylo are
// integrated and rolling out next.
//
// On Devnet: most venues only exist on Mainnet.  Strategy:
//   • We fetch LIVE Mainnet APY/TVL data from public APIs
//   • For the Devnet demo we build the instruction and show the
//     user what WOULD happen, then submit a "stake marker" SOL
//     transfer to the ACE program vault PDA to prove on-chain
//     execution capability.
//   • The UI shows real yield projections derived from live rates.
// ============================================================

export type StakingProviderId = 'solblaze' | 'jito' | 'hylo';

export interface StakingProvider {
  id: StakingProviderId;
  name: string;
  protocol: string;
  tokenSymbol: string;
  description: string;
  websiteUrl: string;
  docUrl: string;
  /** Live APY fetched from provider public API (falls back to cached) */
  apy: number;
  /** TVL in USD */
  tvlUsd: number;
  riskScore: number;   // 1–10
  minStakeUsd: number;
  lockupDays: number;  // 0 = liquid staking (instant unstake)
  isLiquid: boolean;
  /** True when ACE has a live integration with this venue. */
  isLive: boolean;
  /** Optional brand logo served from /public. */
  logoUrl?: string;
  category: 'liquid_staking' | 'yield_vault' | 'restaking';
}

export interface StakePosition {
  provider: StakingProviderId;
  amountUsd: number;
  amountSol: number;
  stakedAt: number;
  currentApy: number;
  projectedMonthlyYieldUsd: number;
  projectedAnnualYieldUsd: number;
  canUnstakeNow: boolean;
  devnetTxSig?: string;   // marker tx on devnet
}

export interface StakeRecommendation {
  provider: StakingProviderId;
  allocatePct: number;    // % of idle yield balance to stake
  allocateUsd: number;
  rationale: string;
  expectedMonthlyYieldUsd: number;
  urgency: 'immediate' | 'soon' | 'consider';
}

// ── Cached provider data (updated by fetchLiveProviderData) ──────────────────

let _cache: Record<string, StakingProvider> | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

const STATIC_PROVIDERS: StakingProvider[] = [
  {
    id: 'solblaze',
    name: 'SolBlaze Liquid Staking',
    protocol: 'SolBlaze (BlazeStake)',
    tokenSymbol: 'bSOL',
    description: 'Liquid-stake SOL into bSOL with custom validator direction and SBLZE rewards. bSOL stays instantly liquid across Solana DeFi. ACE is live on SolBlaze on Mainnet.',
    websiteUrl: 'https://stake.solblaze.org',
    docUrl: 'https://docs.solblaze.org',
    apy: 6.0,         // fallback; overridden by live fetch
    tvlUsd: 120_000_000,
    riskScore: 2,
    minStakeUsd: 1,
    lockupDays: 0,
    isLiquid: true,
    isLive: true,     // ACE is live on SolBlaze
    logoUrl: '/solblaze.png',
    category: 'liquid_staking',
  },
  {
    id: 'jito',
    name: 'Jito Liquid Staking',
    protocol: 'Jito Network',
    tokenSymbol: 'jitoSOL',
    description: 'Liquid-stake SOL and earn MEV rewards on top of base staking yield. jitoSOL is instantly redeemable.',
    websiteUrl: 'https://www.jito.network/staking/',
    docUrl: 'https://docs.jito.network/staking',
    apy: 8.1,         // fallback; overridden by live fetch
    tvlUsd: 3_100_000_000,
    riskScore: 2,
    minStakeUsd: 1,
    lockupDays: 0,
    isLiquid: true,
    isLive: false,    // integrated, rolling out next
    category: 'liquid_staking',
  },
  {
    id: 'hylo',
    name: 'Hylo Yield Vault',
    protocol: 'Hylo Protocol',
    tokenSymbol: 'hyUSD',
    description: 'Deploy stablecoins into Hylo collateralised yield vault. Earn protocol yield with reserve-safe exposure.',
    websiteUrl: 'https://hylo.so',
    docUrl: 'https://docs.hylo.so',
    apy: 11.4,        // fallback
    tvlUsd: 87_000_000,
    riskScore: 4,
    minStakeUsd: 10,
    lockupDays: 0,
    isLiquid: true,
    isLive: false,    // integrated, rolling out next
    category: 'yield_vault',
  },
];

/** Fetch live APY from SolBlaze's public stake-pool stats endpoint.
 *  Response shape: { success: true, apy: 6.01, total: 6.01, base: 6.01, ... }
 *  The `total`/`apy` fields are already expressed as a percentage. */
async function fetchSolBlazeApy(): Promise<number | null> {
  try {
    const res = await fetch('https://stake.solblaze.org/api/v1/apy', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json() as { success?: boolean; apy?: number; total?: number };
    const raw = json.total ?? json.apy;
    if (typeof raw === 'number' && raw > 0) return raw; // already a percentage
    return null;
  } catch {
    return null;
  }
}

/** Fetch live APY from Jito's public stats endpoint. */
async function fetchJitoApy(): Promise<number | null> {
  try {
    const res = await fetch('https://kobe.mainnet.jito.network/api/v1/apy', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json() as { value?: number; apy?: number };
    const raw = json.value ?? json.apy;
    if (typeof raw === 'number' && raw > 0) return raw * 100; // it's a decimal
    return null;
  } catch {
    return null;
  }
}

/** Fetch live APY from Hylo's public API. */
async function fetchHyloApy(): Promise<number | null> {
  try {
    const res = await fetch('https://api.hylo.so/v1/stats', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json() as { vaultApy?: number; apy?: number; yield?: number };
    const raw = json.vaultApy ?? json.apy ?? json.yield;
    if (typeof raw === 'number' && raw > 0) return raw > 1 ? raw : raw * 100;
    return null;
  } catch {
    return null;
  }
}

export async function getLiveProviders(): Promise<StakingProvider[]> {
  const now = Date.now();
  if (_cache && now - _cacheTs < CACHE_TTL_MS) {
    return Object.values(_cache);
  }

  const [solblazeApy, jitoApy, hyloApy] = await Promise.all([
    fetchSolBlazeApy(),
    fetchJitoApy(),
    fetchHyloApy(),
  ]);

  const liveApy: Record<StakingProviderId, number | null> = {
    solblaze: solblazeApy,
    jito: jitoApy,
    hylo: hyloApy,
  };

  const providers = STATIC_PROVIDERS.map(p => ({
    ...p,
    apy: liveApy[p.id] ?? p.apy,
  }));

  _cache = Object.fromEntries(providers.map(p => [p.id, p]));
  _cacheTs = now;

  return providers;
}

/** Build staking recommendations for a given idle balance. */
export function buildStakeRecommendations(
  idleYieldBalanceUsd: number,
  solPriceUsd: number,
  providers: StakingProvider[],
): StakeRecommendation[] {
  if (idleYieldBalanceUsd < 10) return [];

  const recommendations: StakeRecommendation[] = [];

  // Idle-capital allocation. Only venues ACE is LIVE on (SolBlaze today) get
  // actionable recommendations; Jito/Hylo are surfaced as "coming soon" in the
  // UI but are not yet recommended for deployment.
  const ALLOC_PCT: Record<StakingProviderId, number> = {
    solblaze: 50,
    jito: 35,
    hylo: 20,
  };

  for (const p of providers) {
    if (!p.isLive) continue; // coming-soon venues are not recommended yet
    if (idleYieldBalanceUsd < p.minStakeUsd) continue;

    const allocPct = ALLOC_PCT[p.id] ?? 40;
    const allocUsd = Number(((idleYieldBalanceUsd * allocPct) / 100).toFixed(2));
    if (allocUsd < p.minStakeUsd) continue;

    const monthlyYield = Number(((allocUsd * p.apy) / 100 / 12).toFixed(2));

    let urgency: StakeRecommendation['urgency'] = 'consider';
    if (idleYieldBalanceUsd > 100) urgency = 'immediate';
    else if (idleYieldBalanceUsd > 50) urgency = 'soon';

    recommendations.push({
      provider: p.id,
      allocatePct: allocPct,
      allocateUsd: allocUsd,
      rationale: `${p.name} offers ${p.apy.toFixed(1)}% APY with ${p.riskScore}/10 risk. ${
        p.isLiquid ? 'Liquid — instant unstake.' : `${p.lockupDays}d lockup.`
      } Est. monthly yield on allocated amount: $${monthlyYield.toFixed(2)}.`,
      expectedMonthlyYieldUsd: monthlyYield,
      urgency,
    });
  }

  // Sort: SolBlaze first (live), then Jito, then Hylo.
  const order: Record<StakingProviderId, number> = { solblaze: 0, jito: 1, hylo: 2 };
  return recommendations.sort(
    (a, b) => (order[a.provider] ?? 99) - (order[b.provider] ?? 99),
  );
}

const PROVIDER_NAME: Record<StakingProviderId, string> = {
  solblaze: 'SolBlaze Liquid Staking',
  jito: 'Jito Liquid Staking',
  hylo: 'Hylo Yield Vault',
};

/** Build a "stake marker" transaction description.
 *  SolBlaze is live on Mainnet via ACE; Jito/Hylo are devnet-demo for now.
 *  On devnet we record the intent as a protocol vault transfer.
 */
export function buildDevnetStakeMarkerDescription(
  provider: StakingProviderId,
  amountUsd: number,
  solPriceUsd: number,
): string {
  const solAmount = (amountUsd / solPriceUsd).toFixed(4);
  const protoName = PROVIDER_NAME[provider] ?? 'staking venue';
  const tail = provider === 'solblaze'
    ? 'SolBlaze integration is live — ACE mints bSOL via the SolBlaze stake pool.'
    : 'Integration coming soon.';
  return `[Devnet] Stake intent: ${solAmount} SOL (≈$${amountUsd.toFixed(2)}) → ${protoName}. ${tail}`;
}
