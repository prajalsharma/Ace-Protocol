'use client';
// ============================================================
// ACE Protocol — Para auth layer (getpara.com, formerly Capsule)
//
// Para replaces Privy for wallet auth / session management. Para's Solana
// external-wallet connector mounts the standard @solana/wallet-adapter-react
// providers, so the connected wallet (address + sendTransaction) is read from
// useWallet(); login/logout/session come from Para's own hooks.
//
// RESILIENCE: The whole app is mounted under Para. If Para is not configured
// (missing NEXT_PUBLIC_PARA_API_KEY) or fails to initialise (invalid key /
// wrong environment), we must NOT take down the entire site. So:
//   • Para's hooks are called only inside <ParaBridge>, which publishes their
//     values into plain React context. Consumers read context via useAuth() /
//     useSolanaWallet() and therefore never call a Para hook directly — they
//     can't throw "must be used within ParaProvider".
//   • <ParaProvider> is wrapped in an error boundary that falls back to a
//     disconnected context if Para init throws.
//   • With no valid key we skip Para entirely and run in disconnected mode
//     (landing page renders; connect is a no-op until a key is supplied).
// ============================================================

import React, {
  createContext, useCallback, useContext, useMemo,
} from 'react';
import {
  ParaProvider, Environment,
  useAccount, useModal, useLogout, useIssueJwt, useParaStatus,
} from '@getpara/react-sdk';
import '@getpara/react-sdk/styles.css';
import { useWallet } from '@solana/wallet-adapter-react';

// ─── Config ──────────────────────────────────────────────────────────────────

const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY ?? '';
// Only treat the key as usable if it has a real Para environment prefix.
const HAS_VALID_KEY = /^(beta|prod)_/.test(PARA_API_KEY);

const PARA_ENV =
  (process.env.NEXT_PUBLIC_PARA_ENVIRONMENT ?? 'BETA').toUpperCase() === 'PROD'
    ? Environment.PROD
    : Environment.BETA;

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ??
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  'https://api.mainnet-beta.solana.com';

// ─── Public hook types ───────────────────────────────────────────────────────

export interface AuthState {
  authenticated: boolean;
  ready: boolean;
  login: () => void;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

type SendTransaction = ReturnType<typeof useWallet>['sendTransaction'] | undefined;

export interface SolanaWalletState {
  address: string | null;
  sendTransaction: SendTransaction;
  connected: boolean;
}

// ─── Context (disconnected defaults) ─────────────────────────────────────────

const DISCONNECTED_AUTH: AuthState = {
  authenticated: false,
  ready: true,
  login: () => {
    if (typeof window !== 'undefined') {
      const msg = 'Wallet login is not configured. Set NEXT_PUBLIC_PARA_API_KEY (and NEXT_PUBLIC_PARA_ENVIRONMENT) and redeploy.';
      console.warn('[Para] ' + msg);
      // Visible feedback so the button never appears "dead".
      window.alert(msg);
    }
  },
  logout: async () => {},
  getAccessToken: async () => null,
};

const DISCONNECTED_WALLET: SolanaWalletState = {
  address: null,
  sendTransaction: undefined,
  connected: false,
};

const AuthContext = createContext<AuthState>(DISCONNECTED_AUTH);
const WalletContext = createContext<SolanaWalletState>(DISCONNECTED_WALLET);

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
export function useSolanaWallet(): SolanaWalletState {
  return useContext(WalletContext);
}

// ─── Bridge: calls Para hooks, publishes to context ──────────────────────────

function ParaBridge({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  const { isReady } = useParaStatus();
  const { openModal } = useModal();
  const { logoutAsync } = useLogout();
  const { issueJwtAsync } = useIssueJwt();
  const wallet = useWallet();
  const { publicKey, sendTransaction, connected, disconnect } = wallet;

  const login = useCallback(() => {
    // The Para modal is only mounted once the SDK reaches `isReady` (i.e. the
    // API key validated for this origin). If it isn't ready, openModal() is a
    // silent no-op — surface why so it isn't a mystery.
    if (!isReady) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '(server)';
      console.warn(
        `[Para] Connect modal not ready — the SDK has not initialised. ` +
        `Verify NEXT_PUBLIC_PARA_API_KEY + NEXT_PUBLIC_PARA_ENVIRONMENT, and that "${origin}" ` +
        `is added to your API key's allowed domains at https://developer.getpara.com.`,
      );
    }
    openModal();
  }, [openModal, isReady]);

  const logout = useCallback(async () => {
    try {
      await logoutAsync();
    } finally {
      try { await disconnect(); } catch { /* already disconnected */ }
    }
  }, [logoutAsync, disconnect]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const result = await issueJwtAsync();
    return result?.token ?? null;
  }, [issueJwtAsync]);

  const authValue = useMemo<AuthState>(
    () => ({ authenticated: Boolean(account?.isConnected), ready: isReady, login, logout, getAccessToken }),
    [account?.isConnected, isReady, login, logout, getAccessToken],
  );

  const walletValue = useMemo<SolanaWalletState>(
    () => ({ address: publicKey?.toBase58() ?? null, sendTransaction, connected }),
    [publicKey, sendTransaction, connected],
  );

  return (
    <AuthContext.Provider value={authValue}>
      <WalletContext.Provider value={walletValue}>{children}</WalletContext.Provider>
    </AuthContext.Provider>
  );
}

// ─── Disconnected provider (no Para) ─────────────────────────────────────────

function DisconnectedProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={DISCONNECTED_AUTH}>
      <WalletContext.Provider value={DISCONNECTED_WALLET}>{children}</WalletContext.Provider>
    </AuthContext.Provider>
  );
}

// ─── Error boundary: Para init failure → disconnected mode ───────────────────

class ParaErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[Para] Initialisation failed — running in disconnected mode. Check NEXT_PUBLIC_PARA_API_KEY / NEXT_PUBLIC_PARA_ENVIRONMENT.', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ─── Public provider ─────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // No usable key → skip Para entirely; the app still renders (disconnected).
  if (!HAS_VALID_KEY) {
    return <DisconnectedProvider>{children}</DisconnectedProvider>;
  }

  return (
    <ParaErrorBoundary fallback={<DisconnectedProvider>{children}</DisconnectedProvider>}>
      <ParaProvider
        // Render children as soon as the client exists; the app gates on
        // `ready` (useParaStatus) itself in WalletGate/AppContext.
        waitForReady={false}
        paraClientConfig={{
          apiKey: PARA_API_KEY,
          env: PARA_ENV,
        }}
        externalWalletConfig={{
          // Solana wallets only — no EVM/Cosmos wallets.
          wallets: ['PHANTOM', 'SOLFLARE', 'BACKPACK'],
          solanaConnector: {
            config: {
              endpoint: MAINNET_RPC,
              chain: 'mainnet-beta',
              appIdentity: {
                name: 'ACE Protocol',
                uri: typeof window !== 'undefined' ? window.location.origin : undefined,
              },
            },
          },
          // Validate a signature from the connected wallet and create a Para
          // session — required for issuing session JWTs to the backend.
          includeWalletVerification: true,
        }}
        paraModalConfig={{
          // Wallet-only — show the external wallet connect screen (Phantom /
          // Solflare / Backpack), not email/social auth.
          authLayout: ['EXTERNAL:FULL'],
          theme: {
            mode: 'dark',
            backgroundColor: '#08060f',
            foregroundColor: '#f0ecff',
            accentColor: '#9d5cff',
          },
          logo: '/icon.svg',
        }}
      >
        <ParaBridge>{children}</ParaBridge>
      </ParaProvider>
    </ParaErrorBoundary>
  );
}
