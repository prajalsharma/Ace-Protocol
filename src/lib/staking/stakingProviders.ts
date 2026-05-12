// ============================================================
// ACE Protocol — Hylo + Jito Staking Integration
//
// On Devnet: we cannot submit real Hylo/Jito txns (they live
// on Mainnet only).  Strategy:
//   • We fetch LIVE Mainnet APY/TVL data from their public APIs
//   • For Devnet demo we build the instruction and show the user
//     what WOULD happen, then submit a "stake marker" SOL transfer
//     to the ACE program vault PDA to prove on-chain capability.
//   • The UI shows real yield projections derived from live rates.
// ============================================================

export interface StakingProvider {
  id: 'hylo' | 'jito';
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
  category: 'liquid_staking' | 'yield_vault' | 'restaking';
}

export interface StakePosition {
  provider: 'hylo' | 'jito';
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
  provider: 'hylo' | 'jito';
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
    category: 'yield_vault',
  },
];

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

  const [jitoApy, hyloApy] = await Promise.all([fetchJitoApy(), fetchHyloApy()]);

  const providers = STATIC_PROVIDERS.map(p => ({
    ...p,
    apy: p.id === 'jito' ? (jitoApy ?? p.apy) : (hyloApy ?? p.apy),
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

  for (const p of providers) {
    if (idleYieldBalanceUsd < p.minStakeUsd) continue;

    // Conservative: put at most 60% of idle yield into any single provider
    const allocPct = p.id === 'jito' ? 40 : 20;
    const allocUsd = Number(((idleYieldBalanceUsd * allocPct) / 100).toFixed(2));
    if (allocUsd < p.minStakeUsd) continue;

    const monthlyYield = Number(((allocUsd * p.apy) / 100 / 12).toFixed(2));

    let urgency: StakeRecommendation['urgency'] = 'consider';
    if (idleYieldBalanceUsd > 500 && p.apy >= 8) urgency = 'immediate';
    else if (idleYieldBalanceUsd > 100) urgency = 'soon';

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

  // Sort: Jito first (lower risk), Hylo second
  return recommendations.sort((a, b) => {
    const order = { jito: 0, hylo: 1 };
    return (order[a.provider] ?? 99) - (order[b.provider] ?? 99);
  });
}

/** Build a simulated devnet "stake marker" transaction description.
 *  On mainnet this would call Jito's or Hylo's SDK instruction.
 *  On devnet we record the intent as a protocol vault transfer.
 */
export function buildDevnetStakeMarkerDescription(
  provider: 'hylo' | 'jito',
  amountUsd: number,
  solPriceUsd: number,
): string {
  const solAmount = (amountUsd / solPriceUsd).toFixed(4);
  const protoName = provider === 'jito' ? 'Jito Liquid Staking' : 'Hylo Yield Vault';
  return `[Devnet] Stake intent: ${solAmount} SOL (≈$${amountUsd.toFixed(2)}) → ${protoName}. On Mainnet this submits the protocol staking instruction.`;
}
