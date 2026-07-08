'use client';
// ============================================================
// ACE Protocol — Top-level Providers
//
// Para (getpara.com) handles wallet connection, auth, and session management.
// All Para wiring — provider config, the context bridge, graceful degradation
// when Para is unconfigured or fails to init — lives in src/lib/para.tsx
// (AuthProvider). This keeps a missing/invalid API key from taking down the
// whole app: it falls back to a "disconnected" mode where the app still
// renders and wallet login is simply unavailable.
//
// QueryClientProvider must wrap AuthProvider because Para's hooks use
// TanStack Query.
// ============================================================

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/para';
import { AppProvider } from '@/context/AppContext';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppProvider>{children}</AppProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
