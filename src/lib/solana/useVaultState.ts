'use client';
// ============================================================
// ACE Protocol — Live Vault State Hook
//
// Priority order:
//   1. On-chain PDA vault account (initialized vault — real bucket data)
//   2. Raw SOL balance fallback (wallet connected but vault not initialized)
//   3. Simulation/mock data (no wallet)
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Vault, ScheduledPayment, DashboardSummary } from '@/types';
import { MOCK_VAULT, MOCK_PAYMENTS, MOCK_SUMMARY } from '@/lib/solana/mockData';
import { fetchVaultAccount, onChainVaultToAppVault } from '@/lib/solana/program';

const SOL_PRICE_USD = 148; // In production: fetch from oracle

interface VaultState {
  vault: Vault | null;
  payments: ScheduledPayment[];
  summary: DashboardSummary | null;
  isLive: boolean;
  isOnChain: boolean; // true when reading from deployed PDA
  refresh: () => void;
}

export function useVaultState(): VaultState {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [vault, setVault] = useState<Vault | null>(null);
  const [payments] = useState<ScheduledPayment[]>(MOCK_PAYMENTS);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isOnChain, setIsOnChain] = useState(false);

  const load = useCallback(async () => {
    if (!connected || !publicKey) {
      setVault(MOCK_VAULT);
      setSummary(MOCK_SUMMARY);
      setIsLive(false);
      setIsOnChain(false);
      return;
    }

    try {
      // ── Attempt 1: Read from deployed on-chain vault PDA ────────────────
      const rawVault = await fetchVaultAccount(connection, publicKey);

      if (rawVault) {
        const decoded = onChainVaultToAppVault(rawVault, SOL_PRICE_USD);
        const alloc = {
          yield: Math.round(rawVault.yieldAlloc / 100),
          reserve: Math.round(rawVault.reserveAlloc / 100),
          liquid: Math.round(rawVault.liquidAlloc / 100),
          payments: Math.round(rawVault.paymentsAlloc / 100),
        };

        const now = Math.floor(Date.now() / 1000);
        const upcomingPaymentsUsd = payments
          .filter((p) => p.status === 'scheduled' && p.nextDue < now + 7 * 86400)
          .reduce((sum, p) => sum + p.amountUsd, 0);

        const onChainVault: Vault = {
          id: `vault-${publicKey.toBase58().slice(0, 8)}`,
          owner: publicKey.toBase58(),
          status: rawVault.status === 0 ? 'active' : rawVault.status === 1 ? 'paused' : 'emergency',
          totalDeposited: decoded.totalUsd,
          yieldBalance: decoded.yieldUsd,
          reserveBalance: decoded.reserveUsd,
          liquidBalance: decoded.liquidUsd,
          paymentsBalance: decoded.paymentsUsd,
          allocation: alloc,
          apy: 8.4,
          createdAt: decoded.createdAt,
          lastRebalancedAt: decoded.lastRebalancedAt,
          riskLevel: 'balanced',
          operationMode: decoded.operationMode,
          aiPaymentCapUsd: decoded.aiPaymentCapUsd,
        };

        const onChainSummary: DashboardSummary = {
          safeToSpend: Math.max(0, decoded.liquidUsd),
          reserved: Math.max(0, decoded.reserveUsd),
          earningYield: Math.max(0, decoded.yieldUsd),
          nextPaymentAmount:
            upcomingPaymentsUsd > 0
              ? (payments.filter((p) => p.status === 'scheduled')[0]?.amountUsd ?? 0)
              : 0,
          nextPaymentDate: payments.filter((p) => p.status === 'scheduled')[0]?.nextDue ?? 0,
          totalEarnedYield: decoded.totalUsd * 0.025,
          protocolFeePaid: decoded.totalUsd * 0.0001,
          executionQuality: {
            avgSlippage: 5.2,
            avgExecutionTime: 1.4,
            successRate: 98.7,
            savedVsBaseline: 0.89,
          },
        };

        setVault(onChainVault);
        setSummary(onChainSummary);
        setIsLive(true);
        setIsOnChain(true);
        return;
      }

      // ── Attempt 2: Vault PDA not found — fall back to raw SOL balance ───
      const lamports = await connection.getBalance(publicKey);
      const solBalance = lamports / LAMPORTS_PER_SOL;
      const totalUsd = solBalance * SOL_PRICE_USD;

      const storedPolicy =
        typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('ace_policy') ?? 'null')
          : null;

      const alloc = storedPolicy?.allocation ?? { yield: 60, reserve: 20, liquid: 15, payments: 5 };
      const riskLevel = storedPolicy?.riskLevel ?? 'balanced';

      const now = Math.floor(Date.now() / 1000);
      const upcomingPaymentsUsd = payments
        .filter((p) => p.status === 'scheduled' && p.nextDue < now + 7 * 86400)
        .reduce((sum, p) => sum + p.amountUsd, 0);

      const paymentsBalance = Math.min(totalUsd * (alloc.payments / 100), upcomingPaymentsUsd + totalUsd * 0.02);
      const reservedBalance = Math.max(totalUsd * (alloc.reserve / 100), upcomingPaymentsUsd);
      const yieldBalance = totalUsd * (alloc.yield / 100);
      const liquidBalance = totalUsd - reservedBalance - yieldBalance - paymentsBalance;

      const balanceVault: Vault = {
        id: `vault-${publicKey.toBase58().slice(0, 8)}`,
        owner: publicKey.toBase58(),
        status: 'active',
        totalDeposited: totalUsd,
        yieldBalance: Math.max(0, yieldBalance),
        reserveBalance: Math.max(0, reservedBalance),
        liquidBalance: Math.max(0, liquidBalance),
        paymentsBalance: Math.max(0, paymentsBalance),
        allocation: alloc,
        apy: 8.4,
        createdAt: Math.floor(Date.now() / 1000) - 45 * 86400,
        lastRebalancedAt: Math.floor(Date.now() / 1000) - 3600,
        riskLevel,
        operationMode: 'safe',
        aiPaymentCapUsd: 500,
      };

      const balanceSummary: DashboardSummary = {
        safeToSpend: Math.max(0, liquidBalance),
        reserved: Math.max(0, reservedBalance),
        earningYield: Math.max(0, yieldBalance),
        nextPaymentAmount:
          upcomingPaymentsUsd > 0
            ? (payments.filter((p) => p.status === 'scheduled')[0]?.amountUsd ?? 0)
            : 0,
        nextPaymentDate: payments.filter((p) => p.status === 'scheduled')[0]?.nextDue ?? 0,
        totalEarnedYield: totalUsd * 0.025,
        protocolFeePaid: totalUsd * 0.0001,
        executionQuality: {
          avgSlippage: 5.2,
          avgExecutionTime: 1.4,
          successRate: 98.7,
          savedVsBaseline: 0.89,
        },
      };

      setVault(balanceVault);
      setSummary(balanceSummary);
      setIsLive(true);
      setIsOnChain(false);
    } catch (err) {
      console.error('[ACE] Failed to load vault state from chain:', err);
      setVault(MOCK_VAULT);
      setSummary(MOCK_SUMMARY);
      setIsLive(false);
      setIsOnChain(false);
    }
  }, [connected, publicKey, connection, payments]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return { vault, payments, summary, isLive, isOnChain, refresh: load };
}
