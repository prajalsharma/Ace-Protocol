'use client';
// ============================================================
// ACE Protocol — Live Vault State Hook
//
// When wallet is connected, reads real devnet SOL balance and
// derives bucket values from the user's stored policy.
// Falls back to simulation data when wallet is disconnected.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { Vault, ScheduledPayment, DashboardSummary } from '@/types';
import { MOCK_VAULT, MOCK_PAYMENTS, MOCK_SUMMARY } from '@/lib/solana/mockData';

const SOL_PRICE_USD = 148; // In production: fetch from oracle

interface VaultState {
  vault: Vault | null;
  payments: ScheduledPayment[];
  summary: DashboardSummary | null;
  isLive: boolean;
  refresh: () => void;
}

export function useVaultState(): VaultState {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [vault, setVault] = useState<Vault | null>(null);
  const [payments] = useState<ScheduledPayment[]>(MOCK_PAYMENTS);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLive, setIsLive] = useState(false);

  const load = useCallback(async () => {
    if (!connected || !publicKey) {
      // Simulation mode
      setVault(MOCK_VAULT);
      setSummary(MOCK_SUMMARY);
      setIsLive(false);
      return;
    }

    try {
      // Read real SOL balance
      const lamports = await connection.getBalance(publicKey);
      const solBalance = lamports / LAMPORTS_PER_SOL;
      const totalUsd = solBalance * SOL_PRICE_USD;

      // Derive buckets from stored policy (or defaults)
      const storedPolicy = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('ace_policy') ?? 'null')
        : null;

      const alloc = storedPolicy?.allocation ?? { yield: 60, reserve: 20, liquid: 15, payments: 5 };
      const riskLevel = storedPolicy?.riskLevel ?? 'balanced';

      // Calculate upcoming payments reserved amount
      const now = Math.floor(Date.now() / 1000);
      const safetyWindowSecs = 7 * 86400; // 7-day window
      const upcomingPaymentsUsd = payments
        .filter(p => p.status === 'scheduled' && p.nextDue < now + safetyWindowSecs)
        .reduce((sum, p) => sum + p.amountUsd, 0);

      // If upcoming payments exceed payments bucket, increase reserve
      const paymentsBalance = Math.min(totalUsd * (alloc.payments / 100), upcomingPaymentsUsd + totalUsd * 0.02);
      const reservedBalance = Math.max(totalUsd * (alloc.reserve / 100), upcomingPaymentsUsd);
      const yieldBalance = totalUsd * (alloc.yield / 100);
      const liquidBalance = totalUsd - reservedBalance - yieldBalance - paymentsBalance;

      const liveVault: Vault = {
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
      };

      const liveSummary: DashboardSummary = {
        safeToSpend: Math.max(0, liquidBalance),
        reserved: Math.max(0, reservedBalance),
        earningYield: Math.max(0, yieldBalance),
        nextPaymentAmount: upcomingPaymentsUsd > 0 ? payments.filter(p => p.status === 'scheduled')[0]?.amountUsd ?? 0 : 0,
        nextPaymentDate: payments.filter(p => p.status === 'scheduled')[0]?.nextDue ?? 0,
        totalEarnedYield: totalUsd * 0.025, // estimated earned
        protocolFeePaid: totalUsd * 0.0001,
        executionQuality: {
          avgSlippage: 5.2,
          avgExecutionTime: 1.4,
          successRate: 98.7,
          savedVsBaseline: 0.89,
        },
      };

      setVault(liveVault);
      setSummary(liveSummary);
      setIsLive(true);
    } catch (err) {
      console.error('[ACE] Failed to load vault state from chain:', err);
      // Degrade gracefully to simulation
      setVault(MOCK_VAULT);
      setSummary(MOCK_SUMMARY);
      setIsLive(false);
    }
  }, [connected, publicKey, connection, payments]);

  useEffect(() => {
    load();
  }, [load]);

  return { vault, payments, summary, isLive, refresh: load };
}
