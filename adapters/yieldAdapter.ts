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
  return [
    {
      id: 'strat-hylo-stable',
      name: 'Harbor Reserve Yield',
      protocol: 'Hylo-compatible',
      apy: 8.4,
      tvl: 48_200_000,
      riskScore: 3,
      isActive: true,
      allocatedAmount: Number(vault.yieldBalance.toFixed(2)),
      description: 'Reserve-safe stablecoin deployment for idle capital.',
    },
    {
      id: 'strat-sol-liquid',
      name: 'Voyage Staking',
      protocol: 'Liquid Staking',
      apy: 6.9,
      tvl: 210_000_000,
      riskScore: 2,
      isActive: vault.allocation.yield >= 55,
      allocatedAmount: Number((vault.yieldBalance * 0.42).toFixed(2)),
      description: 'Conservative Solana staking exposure for protocol treasuries.',
    },
  ];
}
