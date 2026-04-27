'use client';
import { Bell, FlaskConical, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn, formatShortAddress } from '@/lib/utils';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard':    { title: 'Bridge',        sub: 'Your cashflow command center' },
  '/vault':        { title: 'Vault',          sub: 'Capital allocation & strategies' },
  '/payments':     { title: 'Payments',       sub: 'Scheduled & recurring payouts' },
  '/history':      { title: 'Voyage Log',     sub: 'Complete transaction history' },
  '/ai':           { title: 'AI Crew',        sub: 'Cashflow intelligence & recommendations' },
  '/architecture': { title: 'Architecture',   sub: 'System design & documentation' },
  '/activity':     { title: 'Activity',       sub: 'Execution log & decisions' },
};

export function Topbar() {
  const { isSimulationMode, setSimulationMode, insights } = useApp();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const pathname = usePathname();
  const page = PAGE_TITLES[pathname] ?? { title: 'ACE Protocol', sub: '' };
  const unread = insights.filter(i => i.type === 'alert').length;

  return (
    <header className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2a3a] bg-[#0c0c13]/80 backdrop-blur-sm sticky top-0 z-40">
      {/* Mobile logo + page title */}
      <div className="flex items-center gap-3">
        <div className="lg:hidden w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff6b2b] to-[#f4a935] flex items-center justify-center">
          <Anchor className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white leading-tight">{page.title}</h1>
          <p className="hidden sm:block text-xs text-gray-600 leading-none">{page.sub}</p>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Simulation toggle — only in disconnected state */}
        {!connected && (
          <button
            onClick={() => setSimulationMode(!isSimulationMode)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
              isSimulationMode
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/15'
                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/8',
            )}
          >
            <FlaskConical className="w-3 h-3" />
            <span className="hidden sm:inline">{isSimulationMode ? 'Simulation' : 'Live'}</span>
          </button>
        )}

        {/* Notifications */}
        <Link
          href="/ai"
          className="relative p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all"
        >
          <Bell className="w-4 h-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </Link>

        {/* Wallet connect / status */}
        {connected && publicKey ? (
          <button
            onClick={() => disconnect()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">{formatShortAddress(publicKey.toBase58())}</span>
          </button>
        ) : (
          <button
            onClick={() => setVisible(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-xs text-orange-400 hover:bg-orange-500/25 transition-all font-medium"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
