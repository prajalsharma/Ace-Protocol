'use client';
// ============================================================
// ACE Protocol — App Context
// Wires wallet state → vault state → UI state
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import type {
  Vault, ScheduledPayment, TransactionRecord,
  YieldStrategy, CashflowInsight, DashboardSummary,
} from '@/types';
import {
  MOCK_VAULT,
  MOCK_PAYMENTS,
  MOCK_TRANSACTIONS,
  MOCK_STRATEGIES,
  MOCK_INSIGHTS,
  MOCK_SUMMARY,
} from '@/lib/solana/mockData';
import { appendLog } from '@/lib/activityLog';

const SOL_PRICE_USD = 148; // production: fetch from oracle

interface AppState {
  isSimulationMode: boolean;
  isOnboarded: boolean;
  vault: Vault | null;
  payments: ScheduledPayment[];
  transactions: TransactionRecord[];
  strategies: YieldStrategy[];
  insights: CashflowInsight[];
  summary: DashboardSummary | null;
  isLoading: boolean;
  walletAddress: string | null;
  isWalletConnected: boolean;
}

interface AppActions {
  setSimulationMode: (v: boolean) => void;
  completeOnboarding: () => void;
  refreshVault: () => void;
  dismissInsight: (id: string) => void;
  updatePayment: (id: string, patch: Partial<ScheduledPayment>) => void;
  addTransaction: (tx: TransactionRecord) => void;
  addPayment: (p: ScheduledPayment) => void;
  updateVault: (patch: Partial<Vault>) => void;
}

const defaultState: AppState = {
  isSimulationMode: true,
  isOnboarded: false,
  vault: null,
  payments: [],
  transactions: [],
  strategies: [],
  insights: [],
  summary: null,
  isLoading: true,
  walletAddress: null,
  isWalletConnected: false,
};

const AppContext = createContext<AppState & AppActions>({
  ...defaultState,
  setSimulationMode: () => {},
  completeOnboarding: () => {},
  refreshVault: () => {},
  dismissInsight: () => {},
  updatePayment: () => {},
  addTransaction: () => {},
  addPayment: () => {},
  updateVault: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<AppState>(defaultState);

  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    // Base mock data (always available)
    const base = {
      transactions: MOCK_TRANSACTIONS,
      strategies: MOCK_STRATEGIES,
      insights: MOCK_INSIGHTS,
    };

    if (connected && publicKey) {
      try {
        const lamports = await connection.getBalance(publicKey);
        const totalUsd = (lamports / LAMPORTS_PER_SOL) * SOL_PRICE_USD;

        const storedPolicy = typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('ace_policy') ?? 'null')
          : null;
        const alloc = storedPolicy?.allocation ?? { yield: 60, reserve: 20, liquid: 15, payments: 5 };
        const riskLevel = storedPolicy?.riskLevel ?? 'balanced';

        const now = Math.floor(Date.now() / 1000);
        const safetyWindow = 7 * 86400;
        const upcomingPaymentsUsd = MOCK_PAYMENTS
          .filter(p => p.status === 'scheduled' && p.nextDue < now + safetyWindow)
          .reduce((s, p) => s + p.amountUsd, 0);

        const reserveBalance = Math.max(totalUsd * (alloc.reserve / 100), upcomingPaymentsUsd);
        const yieldBalance = totalUsd * (alloc.yield / 100);
        const paymentsBalance = Math.min(totalUsd * (alloc.payments / 100), upcomingPaymentsUsd);
        const liquidBalance = Math.max(0, totalUsd - reserveBalance - yieldBalance - paymentsBalance);

        const liveVault: Vault = {
          id: `vault-${publicKey.toBase58().slice(0, 8)}`,
          owner: publicKey.toBase58(),
          status: 'active',
          totalDeposited: totalUsd,
          yieldBalance: Math.max(0, yieldBalance),
          reserveBalance: Math.max(0, reserveBalance),
          liquidBalance,
          paymentsBalance: Math.max(0, paymentsBalance),
          allocation: alloc,
          apy: 8.4,
          createdAt: Math.floor(Date.now() / 1000) - 45 * 86400,
          lastRebalancedAt: Math.floor(Date.now() / 1000) - 3600,
          riskLevel,
        };

        const liveSummary: DashboardSummary = {
          safeToSpend: liquidBalance,
          reserved: reserveBalance,
          earningYield: yieldBalance,
          nextPaymentAmount: MOCK_PAYMENTS.filter(p => p.status === 'scheduled')[0]?.amountUsd ?? 0,
          nextPaymentDate: MOCK_PAYMENTS.filter(p => p.status === 'scheduled')[0]?.nextDue ?? 0,
          totalEarnedYield: totalUsd * 0.025,
          protocolFeePaid: totalUsd * 0.0001,
          executionQuality: {
            avgSlippage: 5.2,
            avgExecutionTime: 1.4,
            successRate: 98.7,
            savedVsBaseline: 0.89,
          },
        };

        appendLog({
          type: 'policy',
          message: `Wallet connected: ${publicKey.toBase58().slice(0, 8)}…`,
          detail: `Live balance: ${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL (~$${totalUsd.toFixed(2)})`,
        });

        setState(prev => ({
          ...prev,
          ...base,
          vault: liveVault,
          payments: MOCK_PAYMENTS,
          summary: liveSummary,
          walletAddress: publicKey.toBase58(),
          isWalletConnected: true,
          isSimulationMode: false,
          isLoading: false,
          isOnboarded: typeof window !== 'undefined' && localStorage.getItem('ace_onboarded') === 'true',
        }));
        return;
      } catch (err) {
        console.error('[ACE] Chain read failed, falling back to simulation:', err);
      }
    }

    // Simulation fallback
    setState(prev => ({
      ...prev,
      ...base,
      vault: MOCK_VAULT,
      payments: MOCK_PAYMENTS,
      summary: MOCK_SUMMARY,
      walletAddress: null,
      isWalletConnected: false,
      isSimulationMode: true,
      isLoading: false,
      isOnboarded: typeof window !== 'undefined' && localStorage.getItem('ace_onboarded') === 'true',
    }));
  }, [connected, publicKey, connection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const setSimulationMode = (v: boolean) =>
    setState(prev => ({ ...prev, isSimulationMode: v }));

  const completeOnboarding = () => {
    if (typeof window !== 'undefined') localStorage.setItem('ace_onboarded', 'true');
    setState(prev => ({ ...prev, isOnboarded: true }));
  };

  const refreshVault = () => loadData();

  const dismissInsight = (id: string) =>
    setState(prev => ({ ...prev, insights: prev.insights.filter(i => i.id !== id) }));

  const updatePayment = (id: string, patch: Partial<ScheduledPayment>) =>
    setState(prev => ({
      ...prev,
      payments: prev.payments.map(p => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const addTransaction = (tx: TransactionRecord) =>
    setState(prev => ({ ...prev, transactions: [tx, ...prev.transactions] }));

  const addPayment = (p: ScheduledPayment) =>
    setState(prev => ({ ...prev, payments: [...prev.payments, p] }));

  const updateVault = (patch: Partial<Vault>) =>
    setState(prev => ({
      ...prev,
      vault: prev.vault ? { ...prev.vault, ...patch } : prev.vault,
    }));

  return (
    <AppContext.Provider
      value={{
        ...state,
        setSimulationMode,
        completeOnboarding,
        refreshVault,
        dismissInsight,
        updatePayment,
        addTransaction,
        addPayment,
        updateVault,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
