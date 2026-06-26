import type { Vault, YieldStrategy } from '@root/src/types';

export interface YieldProjection {
  accruedUsd: number;
  projectedMonthlyUsd: number;
}

export function accrueDeterministicYield(
  currentYieldBalanceUsd: number,
  annualRatePct: number,
  elapsedSeconds: number,
): YieldProjection {
  const yearSeconds = 365 * 24 * 60 * 60;
  const rate = annualRatePct / 100;
  const accruedUsd = currentYieldBalanceUsd * rate * (elapsedSeconds / yearSeconds);
  const projectedMonthlyUsd = currentYieldBalanceUsd * rate * (30 / 365);
  return {
    accruedUsd: Number(accruedUsd.toFixed(2)),
    projectedMonthlyUsd: Number(projectedMonthlyUsd.toFixed(2)),
  };
}

export function getDefaultYieldStrategies(vault: Vault): YieldStrategy[] {
  // ACE is live on SolBlaze. Idle yield capital is restaked into bSOL through
  // the SolBlaze stake pool — the single active venue surfaced post-login.
  return [
    {
      id: 'strat-solblaze-bsol',
      name: 'SolBlaze Liquid Staking',
      protocol: 'SolBlaze · bSOL',
      apy: 6.0,
      tvl: 120_000_000,
      riskScore: 2,
      isActive: true,
      allocatedAmount: Number(vault.yieldBalance.toFixed(2)),
      description: 'Idle yield restaked into bSOL through the SolBlaze stake pool. Liquid — instant unstake, no lockup.',
    },
  ];
}
