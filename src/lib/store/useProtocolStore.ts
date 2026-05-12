'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SolanaNetwork = 'mainnet' | 'devnet';

const STORAGE_KEY = 'ace_protocol_store';

interface ProtocolUiState {
  isSimulationMode: boolean;
  isOnboarded: boolean;
  network: SolanaNetwork;
  sessionToken: string | null;
  sessionWallet: string | null;
  sessionExpiresAt: number | null;
  setSimulationMode: (value: boolean) => void;
  setOnboarded: (value: boolean) => void;
  setNetwork: (value: SolanaNetwork) => void;
  setSession: (input: { token: string; wallet: string; expiresAt: number }) => void;
  clearSession: () => void;
}

export const useProtocolStore = create<ProtocolUiState>()(
  persist(
    (set) => ({
      isSimulationMode: true,
      isOnboarded: false,
      // Default to mainnet on first visit; localStorage overrides on subsequent visits
      network: 'mainnet',
      sessionToken: null,
      sessionWallet: null,
      sessionExpiresAt: null,
      setSimulationMode: (value) => set({ isSimulationMode: value }),
      setOnboarded: (value) => set({ isOnboarded: value }),
      setNetwork: (value) => set({ network: value }),
      setSession: ({ token, wallet, expiresAt }) =>
        set({ sessionToken: token, sessionWallet: wallet, sessionExpiresAt: expiresAt }),
      clearSession: () =>
        set({ sessionToken: null, sessionWallet: null, sessionExpiresAt: null }),
    }),
    {
      name: STORAGE_KEY,
      // Only persist non-sensitive UI preferences; do NOT persist session tokens
      partialize: (state) => ({
        isSimulationMode: state.isSimulationMode,
        isOnboarded: state.isOnboarded,
        network: state.network,
      }),
    },
  ),
);
