'use client';
// ============================================================
// ACE Protocol — Top-level Providers
// Privy handles wallet connection, auth, and session management.
//
// IMPORTANT: PrivyProvider must be mounted ONCE with a static config.
// Do NOT read dynamic state (Zustand, useState, etc.) inside this
// component — remounting PrivyProvider mid-session destroys the
// Solana connector context and causes "Unsupported account" errors.
//
// Network switching is handled entirely at the AppContext/API layer
// via the `?network=` query param — Privy does not need to change.
// Both clusters are declared upfront so Privy accepts either.
// ============================================================

import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { AppProvider } from '@/context/AppContext';

const PRIVY_APP_ID  = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const MAINNET_RPC   =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ??
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  'https://api.mainnet-beta.solana.com';
const DEVNET_RPC    =
  process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC ??
  'https://api.devnet.solana.com';

export function Providers({ children }: { children: React.ReactNode }) {
  // During SSR / static build NEXT_PUBLIC_PRIVY_APP_ID is not available.
  // Skip PrivyProvider so the build doesn't crash — auth runs client-side only.
  if (!PRIVY_APP_ID) {
    return <AppProvider>{children}</AppProvider>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // Wallet-only login — no email/social
        loginMethods: ['wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#9d5cff',
          logo: '/icon.svg',
          showWalletLoginFirst: true,
          // Solana wallets only — no EVM wallets
          walletList: ['phantom', 'solflare', 'backpack'],
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors({ shouldAutoConnect: true }),
          },
        },
        // Declare both clusters statically so Privy never tries EVM fallback.
        // The active network is controlled by AppContext, not by Privy config.
        solanaClusters: [
          { name: 'mainnet-beta', rpcUrl: MAINNET_RPC },
          { name: 'devnet',       rpcUrl: DEVNET_RPC  },
        ],
        // Do NOT auto-create embedded wallets — users must bring their own
        embeddedWallets: {
          createOnLogin: 'off',
        },
      }}
    >
      <AppProvider>{children}</AppProvider>
    </PrivyProvider>
  );
}
