'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { AceMark } from '@/components/brand/AceMark';
import { useApp } from '@/context/AppContext';
import { RefreshCw, LogOut, Loader2, Unplug, AlertTriangle } from 'lucide-react';

function classifyError(err: string): { title: string; hint: string; canRetry: boolean } {
  const lower = err.toLowerCase();

  if (lower.includes('does not support') || lower.includes('not linked')) {
    return {
      title: 'Wallet not supported',
      hint: err,
      canRetry: false,
    };
  }
  if (lower.includes('privy session') || lower.includes('reconnect')) {
    return {
      title: 'Session unavailable',
      hint: 'Your Privy session ended. Disconnect and reconnect your wallet.',
      canRetry: false,
    };
  }
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('cancel')) {
    return {
      title: 'Signature declined',
      hint: 'You cancelled the sign request. Click "Sign in" to try again.',
      canRetry: true,
    };
  }
  if (lower.includes('http 5') || lower.includes('500') || lower.includes('server')) {
    return {
      title: 'Server error',
      hint: 'The API returned an error. Please try again.',
      canRetry: true,
    };
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return {
      title: 'Network error',
      hint: 'Could not reach the server. Check your connection and try again.',
      canRetry: true,
    };
  }
  if (lower.includes('treasury') || lower.includes('unable to load')) {
    return {
      title: 'Dashboard unavailable',
      hint: 'Your wallet connected but treasury data could not be loaded. Try again.',
      canRetry: true,
    };
  }

  return {
    title: 'Authentication failed',
    hint: err,
    canRetry: true,
  };
}

export function WalletGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { authenticated, ready: privyReady, login, logout } = usePrivy();
  const { isLoading, isSessionReady, sessionError, refreshVault, disconnectWallet } = useApp();

  const [loadingTooLong, setLoadingTooLong] = useState(false);
  useEffect(() => {
    if (!isLoading) { setLoadingTooLong(false); return; }
    const timer = setTimeout(() => setLoadingTooLong(true), 30_000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Privy is still hydrating — render nothing to avoid flash
  if (!privyReady) return null;

  // Not authenticated — redirect to landing
  if (!authenticated) {
    router.replace('/');
    return null;
  }

  // Authenticated + session ready — render the protected dashboard
  if (isSessionReady) return <>{children}</>;

  // Session error
  if (sessionError) {
    const { title, hint, canRetry } = classifyError(sessionError);
    return (
      <div className="min-h-screen protocol-bg text-[#f0ecff] flex items-center justify-center px-6">
        <div className="max-w-sm w-full rounded-[28px] border border-white/[0.07] bg-[#08060f]/85 backdrop-blur-2xl p-10 text-center shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          <AceMark className="mx-auto mb-6 h-14 w-14" glow />
          <div className="flex items-center justify-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[#fb7185]" />
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#4e4868]">Authentication error</p>
          </div>
          <h1 className="font-display text-xl font-600 tracking-[-0.04em] text-white">{title}</h1>
          <p className="mt-3 text-[0.85rem] leading-7 text-[#6e6886]">{hint}</p>
          <div className="mt-8 flex flex-col gap-3">
            {canRetry && (
              <button
                onClick={() => refreshVault()}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[13px] font-semibold text-[#08060f] transition-all hover:-translate-y-0.5 hover:bg-[#ede0ff] hover:shadow-[0_8px_24px_rgba(157,92,255,0.3)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            )}
            <button
              onClick={() => login()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-6 py-3 text-[13px] font-medium text-[#8882aa] transition-all hover:bg-white/[0.06] hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Switch wallet
            </button>
            <button
              onClick={async () => {
                await disconnectWallet();
                router.replace('/');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-6 py-3 text-[13px] font-medium text-[#fb7185]/70 transition-all hover:bg-[#fb7185]/10 hover:text-[#fb7185]"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect &amp; return home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Timeout — loading took more than 30s
  if (loadingTooLong) {
    return (
      <div className="min-h-screen protocol-bg text-[#f0ecff] flex items-center justify-center px-6">
        <div className="max-w-sm w-full rounded-[28px] border border-white/[0.07] bg-[#08060f]/85 backdrop-blur-2xl p-10 text-center shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
          <AceMark className="mx-auto mb-6 h-14 w-14" glow />
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#4e4868]">Taking too long</p>
          <h1 className="mt-3 font-display text-xl font-600 tracking-[-0.04em] text-white">Session not established</h1>
          <p className="mt-3 text-[0.85rem] leading-7 text-[#6e6886]">
            Authentication stalled. Disconnect and reconnect your wallet.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => refreshVault()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-[13px] font-semibold text-[#08060f] transition-all hover:-translate-y-0.5 hover:bg-[#ede0ff]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button
              onClick={async () => { await logout(); router.replace('/'); }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-6 py-3 text-[13px] font-medium text-[#fb7185]/70 transition-all hover:bg-[#fb7185]/10 hover:text-[#fb7185]"
            >
              <Unplug className="h-3.5 w-3.5" />
              Disconnect &amp; return home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading spinner
  return (
    <div className="min-h-screen protocol-bg text-[#f0ecff] flex items-center justify-center px-6">
      <div className="max-w-sm w-full rounded-[28px] border border-white/[0.07] bg-[#08060f]/85 backdrop-blur-2xl p-10 text-center shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
        <AceMark className="mx-auto mb-6 h-14 w-14" glow />
        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-[#9d5cff]" />
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#4e4868]">Loading protocol</p>
        </div>
        <h1 className="font-display text-xl font-600 tracking-[-0.04em] text-white">
          Connecting to ACE
        </h1>
        <p className="mt-3 text-[0.85rem] leading-7 text-[#6e6886]">
          Establishing your secure session…
        </p>
        <button
          onClick={async () => { await logout(); router.replace('/'); }}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.03] px-6 py-3 text-[13px] font-medium text-[#8882aa] transition-all hover:bg-white/[0.06] hover:text-white w-full"
        >
          <Unplug className="h-3.5 w-3.5" />
          Cancel &amp; disconnect
        </button>
      </div>
    </div>
  );
}
