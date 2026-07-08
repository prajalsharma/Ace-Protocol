'use client';
// ============================================================
// ACE Protocol — Top-level Providers
// Para (getpara.com) handles wallet connection, auth, and session
// management. Its external-wallet connector mounts the standard
// @solana/wallet-adapter-react providers, so the connected Solana
// wallet is available app-wide via useWallet().
//
// IMPORTANT: ParaProvider must be mounted ONCE with a static config.
// Do NOT read dynamic state (Zustand, useState, etc.) inside this
// component — remounting ParaProvider mid-session destroys the
// Solana connector context and the wallet connection.
//
// Network switching is handled entirely at the AppContext/API layer
// via the `?network=` query param. The connector endpoint below only
// backs the wallet-adapter Connection; each on-chain action builds its
// own Connection from NEXT_PUBLIC_SOLANA_RPC.
// ============================================================

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ParaProvider, Environment } from '@getpara/react-sdk';
import '@getpara/react-sdk/styles.css';
import { AppProvider } from '@/context/AppContext';

const PARA_API_KEY = process.env.NEXT_PUBLIC_PARA_API_KEY ?? '';
// BETA (devnet/testing) vs PROD. Defaults to BETA to match devnet usage.
const PARA_ENV =
  (process.env.NEXT_PUBLIC_PARA_ENVIRONMENT ?? 'BETA').toUpperCase() === 'PROD'
    ? Environment.PROD
    : Environment.BETA;

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ??
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  'https://api.mainnet-beta.solana.com';

// The wallet-adapter Connection endpoint. Kept on mainnet to match the
// app's default network; on-chain actions override this per-call.
const CONNECTOR_ENDPOINT = MAINNET_RPC;

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  // ParaProvider is ALWAYS mounted so its store context exists during SSR /
  // static prerendering — Para's hooks (useAccount, etc.) throw if the
  // provider is missing. When NEXT_PUBLIC_PARA_API_KEY is absent (e.g. a build
  // without env), a placeholder key keeps the provider mountable; auth simply
  // won't function until a real key is supplied at runtime.
  // waitForReady={false} lets children render immediately (SSR-safe) — the app
  // gates on `ready` via useParaStatus() in WalletGate/AppContext instead.
  return (
    <QueryClientProvider client={queryClient}>
      <ParaProvider
        waitForReady={false}
        paraClientConfig={{
          apiKey: PARA_API_KEY || 'para_placeholder_key',
          env: PARA_ENV,
        }}
        externalWalletConfig={{
          // Solana wallets only — no EVM/Cosmos wallets
          wallets: ['PHANTOM', 'SOLFLARE', 'BACKPACK'],
          solanaConnector: {
            config: {
              endpoint: CONNECTOR_ENDPOINT,
              chain: 'mainnet-beta',
              appIdentity: {
                name: 'ACE Protocol',
                uri: typeof window !== 'undefined' ? window.location.origin : undefined,
              },
            },
          },
          // Validate a signature from the connected wallet and create a
          // Para session — required for issuing session JWTs to the backend.
          includeWalletVerification: true,
        }}
        paraModalConfig={{
          theme: {
            mode: 'dark',
            backgroundColor: '#08060f',
            foregroundColor: '#f0ecff',
            accentColor: '#9d5cff',
          },
          logo: '/icon.svg',
        }}
      >
        <AppProvider>{children}</AppProvider>
      </ParaProvider>
    </QueryClientProvider>
  );
}
