'use client';
// ============================================================
// ACE Protocol — Para auth compatibility layer
//
// Para (getpara.com, formerly Capsule) replaces Privy as the wallet
// auth / session provider. Para's external-wallet connector mounts the
// standard `@solana/wallet-adapter-react` providers under the hood, so
// the connected Solana wallet (address + sendTransaction) is read
// directly from `useWallet()`, while login/logout/session concerns come
// from Para's own hooks.
//
// These two hooks intentionally mirror the old Privy hook surface
// (`usePrivy` / `useSolanaWallets`) so the rest of the app keeps the
// same shape:
//   • useAuth()          → { authenticated, ready, login, logout, getAccessToken }
//   • useSolanaWallet()  → { address, sendTransaction, connected }
// ============================================================

import { useCallback } from 'react';
import { useAccount, useModal, useLogout, useIssueJwt, useParaStatus } from '@getpara/react-sdk';
import { useWallet } from '@solana/wallet-adapter-react';

export interface AuthState {
  /** True once the user has a valid Para session (wallet connected + verified). */
  authenticated: boolean;
  /** True once the Para SDK has finished its initial hydration. */
  ready: boolean;
  /** Opens the Para connect/auth modal. */
  login: () => void;
  /** Ends the Para session and disconnects the external wallet. */
  logout: () => Promise<void>;
  /** Issues a fresh Para JWT for exchange with the backend session route. */
  getAccessToken: () => Promise<string | null>;
}

export function useAuth(): AuthState {
  const account = useAccount();
  const { isReady } = useParaStatus();
  const { openModal } = useModal();
  const { logoutAsync } = useLogout();
  const { issueJwtAsync } = useIssueJwt();
  const { disconnect } = useWallet();

  const authenticated = Boolean(account?.isConnected);

  const login = useCallback(() => {
    openModal();
  }, [openModal]);

  const logout = useCallback(async () => {
    try {
      await logoutAsync();
    } finally {
      // Also drop the underlying wallet-adapter connection so the UI
      // fully resets even if the Para session teardown throws.
      try {
        await disconnect();
      } catch {
        /* wallet already disconnected */
      }
    }
  }, [logoutAsync, disconnect]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const result = await issueJwtAsync();
    return result?.token ?? null;
  }, [issueJwtAsync]);

  return { authenticated, ready: isReady, login, logout, getAccessToken };
}

export interface SolanaWalletState {
  /** Base58 address of the connected external wallet, or null. */
  address: string | null;
  /** Signs + sends a transaction through the connected wallet (Phantom/Solflare/Backpack). */
  sendTransaction: ReturnType<typeof useWallet>['sendTransaction'];
  connected: boolean;
}

export function useSolanaWallet(): SolanaWalletState {
  const { publicKey, sendTransaction, connected } = useWallet();
  return {
    address: publicKey?.toBase58() ?? null,
    sendTransaction,
    connected,
  };
}
