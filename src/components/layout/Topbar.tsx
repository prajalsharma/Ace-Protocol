'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Copy, Check, LogOut, ChevronDown, Shield, Zap } from 'lucide-react';
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';
import { useApp } from '@/context/AppContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn, formatShortAddress } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AceMark } from '@/components/brand/AceMark';
import { NetworkToggle } from '@/components/NetworkToggle';

const PAGE_META: Record<string, { title: string; sub?: string }> = {
  '/dashboard':         { title: 'Overview',              sub: 'Treasury snapshot' },
  '/vault':             { title: 'Vault',                  sub: 'Capital allocation & yield' },
  '/payments':          { title: 'Payments',               sub: 'Scheduled obligations & flows' },
  '/treasury':          { title: 'Treasury Intelligence',  sub: 'Mainnet wallet analysis' },
  '/private-transfers': { title: 'Private',                sub: 'Cloak — shielded payment flows' },
  '/ai':                { title: 'AI Crew',                sub: 'Autonomous treasury intelligence' },
  '/qvac':              { title: 'QVAC',                   sub: 'Local AI pattern analysis' },
  '/jupiter':           { title: 'Jupiter',                sub: 'Swap & rebalance execution' },
  '/history':           { title: 'History',                sub: 'Complete transaction ledger' },
  '/activity':          { title: 'Activity',               sub: 'Execution log & audit trail' },
  '/settings':          { title: 'Settings',               sub: 'Protocol configuration' },
  '/staking':           { title: 'Staking',                sub: 'Yield deployment & liquid staking' },
};

function WalletAvatar({ address }: { address: string }) {
  const seed = address.slice(0, 6);
  const h1 = parseInt(seed.slice(0, 2), 16) % 360;
  const h2 = (h1 + 60) % 360;
  return (
    <div
      className="w-7 h-7 flex items-center justify-center text-[10px] font-bold text-white shrink-0"
      style={{
        background: `linear-gradient(135deg, hsl(${h1},60%,38%), hsl(${h2},70%,30%))`,
        borderRadius: '6px',
        boxShadow: `0 0 12px hsla(${h1},60%,38%,0.3)`,
      }}
    >
      {address.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const meta = PAGE_META[pathname] ?? { title: 'ACE Protocol' };

  const { authenticated } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const address = solanaWallets[0]?.address ?? null;

  const { insights, disconnectWallet, vault } = useApp();
  const unread = insights.filter(i => i.type === 'alert').length;
  const isAutopilot = vault?.operationMode === 'autopilot';

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDisconnect() {
    setOpen(false);
    await disconnectWallet();
    router.replace('/');
  }

  return (
    <header
      className="flex items-center justify-between px-8 h-[76px] sticky top-0 z-40 shrink-0"
      style={{
        background: 'rgba(5,9,20,0.92)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--border-base)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Left: logo (mobile only) + page context */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Mobile logo */}
        <AceMark className="lg:hidden h-8 w-8 shrink-0" />

        {/* Page title + subtitle */}
        <div className="min-w-0">
          <h1
            className="text-[18px] font-bold leading-none truncate"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.035em',
            }}
          >
            {meta.title}
          </h1>
          {meta.sub && (
            <p
              className="hidden sm:block text-[11.5px] leading-none mt-[6px] truncate"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {meta.sub}
            </p>
          )}
        </div>
      </div>

      {/* Right: indicators + wallet */}
      <div className="flex items-center gap-2">

        {/* Network toggle — always visible */}
        <NetworkToggle />

        {/* Divider */}
        <div className="w-px h-4 mx-0.5 hidden sm:block" style={{ background: 'var(--border-base)' }} />

        {/* Operation mode badge */}
        {authenticated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded text-[10.5px] font-semibold"
            style={{
              background: isAutopilot ? 'var(--violet-dim)' : 'var(--teal-dim)',
              border: `1px solid ${isAutopilot ? 'rgba(168,85,247,0.22)' : 'rgba(45,212,191,0.18)'}`,
              color: isAutopilot ? 'var(--violet-bright)' : 'var(--teal-bright)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            {isAutopilot ? <Zap className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {isAutopilot ? 'Autopilot' : 'Safe Mode'}
          </motion.div>
        )}

        {/* Live network badge */}
        {authenticated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.06 }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded text-[10.5px] font-semibold tracking-wide"
            style={{
              background: 'var(--teal-dim)',
              border: '1px solid rgba(45,212,191,0.18)',
              color: 'var(--teal-bright)',
              borderRadius: 'var(--r-sm)',
            }}
          >
            <span className="status-live" style={{ width: 5, height: 5 }} />
            Live
          </motion.div>
        )}

        {/* Notifications */}
        <Link
          href="/ai"
          className="relative btn-icon"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <Bell className="w-[15px] h-[15px]" />
          {unread > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-[8px] h-[8px] rounded-full flex items-center justify-center"
              style={{ background: 'var(--teal)', boxShadow: '0 0 6px rgba(45,212,191,0.6)' }}
            />
          )}
        </Link>

        {/* Wallet divider */}
        {authenticated && address && (
          <div className="w-px h-4 mx-1" style={{ background: 'var(--border-base)' }} />
        )}

        {/* Wallet dropdown */}
        {authenticated && address && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded transition-all"
              style={{ borderRadius: 'var(--r-md)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <WalletAvatar address={address} />
              <span
                className="hidden sm:block text-[12.5px] font-medium"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
              >
                {formatShortAddress(address)}
              </span>
              <ChevronDown
                className={cn('w-3 h-3 transition-transform duration-200', open && 'rotate-180')}
                style={{ color: 'var(--text-muted)' }}
              />
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 mt-2 w-62 overflow-hidden"
                  style={{
                    borderRadius: 'var(--r-lg)',
                    border: '1px solid var(--border-hi)',
                    background: 'var(--bg-raised)',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: 220,
                  }}
                >
                  {/* Teal glow strip */}
                  <div className="glow-teal-top" />

                  {/* Address row */}
                  <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--border-base)' }}>
                    <p className="label-section mb-2">Connected Wallet</p>
                    <div className="flex items-center gap-2">
                      <WalletAvatar address={address} />
                      <p
                        className="text-[12.5px] truncate"
                        style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}
                      >
                        {formatShortAddress(address)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-1.5 space-y-px">
                    <button
                      onClick={copyAddress}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-all"
                      style={{ color: 'var(--text-secondary)', borderRadius: 'var(--r-sm)' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.045)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      {copied
                        ? <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--teal)' }} />
                        : <Copy className="w-3.5 h-3.5 shrink-0" />
                      }
                      {copied ? 'Copied!' : 'Copy address'}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-all"
                      style={{ color: 'var(--red)', borderRadius: 'var(--r-sm)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.07)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      Disconnect wallet
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
