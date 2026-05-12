'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';
import type {
  CashflowInsight,
  DashboardSummary,
  ProtocolStateResponse,
  ScheduledPayment,
  TransactionRecord,
  Vault,
  WalletSession,
  YieldStrategy,
} from '@/types';
import { useProtocolStore, type SolanaNetwork } from '@/lib/store/useProtocolStore';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AppState {
  isSimulationMode: boolean;
  isOnboarded: boolean;
  network: SolanaNetwork;
  vault: Vault | null;
  payments: ScheduledPayment[];
  transactions: TransactionRecord[];
  strategies: YieldStrategy[];
  insights: CashflowInsight[];
  summary: DashboardSummary | null;
  isLoading: boolean;
  walletAddress: string | null;
  isWalletConnected: boolean;
  sessionToken: string | null;
  isSessionReady: boolean;
  sessionError: string | null;
}

interface AppActions {
  setSimulationMode: (v: boolean) => void;
  setNetwork: (v: SolanaNetwork) => void;
  completeOnboarding: () => void;
  refreshVault: () => void;
  dismissInsight: (id: string) => void;
  updatePayment: (id: string, patch: Partial<ScheduledPayment>) => void;
  addTransaction: (tx: TransactionRecord) => void;
  addPayment: (p: ScheduledPayment) => void;
  updateVault: (patch: Partial<Vault>) => void;
  executePayment: (id: string) => Promise<{ ok: boolean; reason?: string }>;
  disconnectWallet: () => Promise<void>;
}

const defaultState: AppState = {
  isSimulationMode: true,
  isOnboarded: false,
  network: 'mainnet',
  vault: null,
  payments: [],
  transactions: [],
  strategies: [],
  insights: [],
  summary: null,
  isLoading: false,
  walletAddress: null,
  isWalletConnected: false,
  sessionToken: null,
  isSessionReady: false,
  sessionError: null,
};

const AppContext = createContext<AppState & AppActions>({
  ...defaultState,
  setSimulationMode: () => {},
  setNetwork: () => {},
  completeOnboarding: () => {},
  refreshVault: () => {},
  dismissInsight: () => {},
  updatePayment: () => {},
  addTransaction: () => {},
  addPayment: () => {},
  updateVault: () => {},
  executePayment: async () => ({ ok: false }),
  disconnectWallet: async () => {},
});

const SESSION_STORAGE_KEY = 'ace_wallet_session';

function getEmptyDataState(
  isSimulationMode: boolean,
  isOnboarded: boolean,
): Pick<AppState,
  | 'vault' | 'payments' | 'transactions' | 'strategies' | 'insights' | 'summary'
  | 'isWalletConnected' | 'walletAddress' | 'isSimulationMode' | 'isOnboarded'
  | 'sessionToken' | 'isSessionReady' | 'sessionError'
> {
  return {
    vault: null,
    payments: [],
    transactions: [],
    strategies: [],
    insights: [],
    summary: null,
    walletAddress: null,
    isWalletConnected: false,
    isSimulationMode,
    isOnboarded,
    sessionToken: null,
    isSessionReady: false,
    sessionError: null,
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── Privy auth ──────────────────────────────────────────────────────────
  const { authenticated, getAccessToken, logout, ready: privyReady } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();

  const solanaWallet = solanaWallets[0] ?? null;
  const walletAddress = solanaWallet?.address ?? null;
  const isConnected = authenticated && !!walletAddress;

  // ── Protocol store (Zustand — persisted UI state) ──────────────────────
  const isSimulationMode      = useProtocolStore((s) => s.isSimulationMode);
  const isOnboarded           = useProtocolStore((s) => s.isOnboarded);
  const network               = useProtocolStore((s) => s.network);
  const sessionToken          = useProtocolStore((s) => s.sessionToken);
  const sessionWallet         = useProtocolStore((s) => s.sessionWallet);
  const setSimulationModeStore = useProtocolStore((s) => s.setSimulationMode);
  const setOnboarded          = useProtocolStore((s) => s.setOnboarded);
  const setNetworkStore       = useProtocolStore((s) => s.setNetwork);
  const setSession            = useProtocolStore((s) => s.setSession);
  const clearSession          = useProtocolStore((s) => s.clearSession);

  const [state, setState] = useState<AppState>(defaultState);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const applyProtocolState = useCallback(
    (payload: ProtocolStateResponse, token: string) => {
      setState((prev) => ({
        ...prev,
        vault: payload.vault,
        payments: payload.payments,
        transactions: payload.transactions,
        strategies: payload.strategies,
        insights: payload.insights,
        summary: payload.summary,
        walletAddress: payload.wallet,
        isWalletConnected: true,
        isSimulationMode: payload.isSimulationMode,
        isOnboarded,
        sessionToken: token,
        isSessionReady: true,
        sessionError: null,
        isLoading: false,
      }));
    },
    [isOnboarded],
  );

  const authFetch = useCallback(
    async <T,>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
      if (!sessionToken) throw new Error('No authenticated session.');
      const response = await fetch(input, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Request failed.');
      }
      return response.json() as Promise<T>;
    },
    [sessionToken],
  );

  // ── Session establishment ────────────────────────────────────────────────

  const ensureSession = useCallback(async (): Promise<WalletSession | null> => {
    if (!isConnected || !walletAddress) return null;

    // 1. Check existing in-memory session
    if (sessionToken && sessionWallet === walletAddress) {
      const res = await fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) return res.json() as Promise<WalletSession>;
      // Token stale — fall through to re-issue
    }

    // 2. Check localStorage cache
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as WalletSession;
          if (parsed.wallet === walletAddress) {
            const res = await fetch('/api/auth/session', {
              headers: { Authorization: `Bearer ${parsed.token}` },
            });
            if (res.ok) {
              setSession({ token: parsed.token, wallet: parsed.wallet, expiresAt: parsed.expiresAt });
              return parsed;
            }
          }
        } catch {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
    }

    // 3. Get a fresh Privy access token and exchange it for our session JWT
    const privyToken = await getAccessToken();
    if (!privyToken) throw new Error('Privy session unavailable. Please reconnect your wallet.');

    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ privyToken, wallet: walletAddress }),
    });

    const text = await res.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Auth server returned unexpected response (HTTP ${res.status}): ${text.slice(0, 120)}`);
    }

    if (!res.ok) {
      throw new Error(typeof body.error === 'string' ? body.error : 'Session creation failed.');
    }

    const session = body as unknown as WalletSession;
    setSession({ token: session.token, wallet: session.wallet, expiresAt: session.expiresAt });
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
    return session;
  }, [isConnected, walletAddress, sessionToken, sessionWallet, getAccessToken, setSession]);

  // ── Data loading ─────────────────────────────────────────────────────────
  // Always clears cached balances/analytics before re-fetching to prevent stale
  // state leaking between networks.

  const loadData = useCallback(async () => {
    if (!isConnected || !walletAddress) {
      clearSession();
      if (typeof window !== 'undefined') localStorage.removeItem(SESSION_STORAGE_KEY);
      setState((prev) => ({ ...prev, ...getEmptyDataState(isSimulationMode, isOnboarded), isLoading: false }));
      return;
    }

    // Immediately wipe previous network's data before fetching new data.
    // This ensures no stale balances or analytics leak between networks.
    setState((prev) => ({
      ...prev,
      vault: null,
      payments: [],
      transactions: [],
      strategies: [],
      insights: [],
      summary: null,
      isLoading: true,
      sessionError: null,
    }));

    try {
      const session = await ensureSession();
      if (!session) throw new Error('Session unavailable.');

      const res = await fetch(`/api/protocol/state?network=${network}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Unable to load treasury state.');
      }
      const payload = (await res.json()) as ProtocolStateResponse;
      applyProtocolState(payload, session.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize session.';
      clearSession();
      if (typeof window !== 'undefined') localStorage.removeItem(SESSION_STORAGE_KEY);
      setState((prev) => ({
        ...prev,
        ...getEmptyDataState(false, isOnboarded),
        walletAddress,
        isWalletConnected: true,
        sessionError: message,
        isLoading: false,
      }));
    }
  }, [applyProtocolState, clearSession, ensureSession, isConnected, isOnboarded, isSimulationMode, network, walletAddress]);

  const loadDataRef = useRef(loadData);
  loadDataRef.current = loadData;

  // Re-run when Privy auth state, the active wallet, or selected network changes.
  // Network change triggers full state wipe + re-fetch automatically.
  useEffect(() => {
    if (!privyReady) return;
    const timer = window.setTimeout(() => { void loadDataRef.current(); }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyReady, isConnected, walletAddress, network]);

  useEffect(() => {
    if (isConnected) setSimulationModeStore(false);
  }, [isConnected, setSimulationModeStore]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnboarded(localStorage.getItem('ace_onboarded') === 'true');
  }, [setOnboarded]);

  // ── Network switcher ──────────────────────────────────────────────────────
  // When setNetwork is called:
  //  1. Zustand store updates (persisted to localStorage)
  //  2. The effect above fires and re-runs loadData with the new network
  //  3. loadData immediately clears all stale data before fetching

  const setNetwork = useCallback(
    (v: SolanaNetwork) => {
      // Eagerly wipe data so UI reflects the switch immediately
      setState((prev) => ({
        ...prev,
        vault: null,
        payments: [],
        transactions: [],
        strategies: [],
        insights: [],
        summary: null,
        isLoading: true,
        sessionError: null,
      }));
      setNetworkStore(v);
    },
    [setNetworkStore],
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const disconnectWallet = useCallback(async () => {
    clearSession();
    if (typeof window !== 'undefined') localStorage.removeItem(SESSION_STORAGE_KEY);
    setState((prev) => ({ ...prev, ...getEmptyDataState(isSimulationMode, isOnboarded), isLoading: false }));
    await logout();
  }, [clearSession, logout, isOnboarded, isSimulationMode]);

  const setSimulationMode = (v: boolean) => setSimulationModeStore(v);

  const completeOnboarding = () => {
    if (typeof window !== 'undefined') localStorage.setItem('ace_onboarded', 'true');
    setOnboarded(true);
  };

  const refreshVault = () => { void loadData(); };

  const dismissInsight = (id: string) => {
    setState((prev) => ({ ...prev, insights: prev.insights.filter((i) => i.id !== id) }));
    void authFetch<{ ok: boolean }>(`/api/protocol/insights/${id}/dismiss`, { method: 'POST' }).catch(() => {});
  };

  const updatePayment = (id: string, patch: Partial<ScheduledPayment>) => {
    setState((prev) => ({
      ...prev,
      payments: prev.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    void authFetch<ScheduledPayment>(`/api/protocol/payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).catch(() => {});
  };

  const addTransaction = (tx: TransactionRecord) => {
    setState((prev) => ({ ...prev, transactions: [tx, ...prev.transactions] }));
    void authFetch<TransactionRecord>('/api/protocol/transactions', {
      method: 'POST',
      body: JSON.stringify(tx),
    }).catch(() => {});
  };

  const addPayment = (payment: ScheduledPayment) => {
    setState((prev) => ({ ...prev, payments: [...prev.payments, payment] }));
    void authFetch<ScheduledPayment>('/api/protocol/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    }).catch(() => {});
  };

  const updateVault = (patch: Partial<Vault>) => {
    setState((prev) => ({
      ...prev,
      vault: prev.vault ? { ...prev.vault, ...patch } : prev.vault,
    }));
    void authFetch<Vault>('/api/protocol/vault', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).catch(() => {});
  };

  const executePayment = useCallback(
    async (id: string) => {
      try {
        const result = await authFetch<{ ok: boolean; reason?: string }>(
          `/api/protocol/payments/${id}/execute`,
          { method: 'POST' },
        );
        await loadData();
        return result;
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : 'Payment execution failed.' };
      }
    },
    [authFetch, loadData],
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        network,
        sessionToken,
        setSimulationMode,
        setNetwork,
        completeOnboarding,
        refreshVault,
        dismissInsight,
        updatePayment,
        addTransaction,
        addPayment,
        updateVault,
        executePayment,
        disconnectWallet,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
