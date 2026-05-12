'use client';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { useApp } from '@/context/AppContext';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';

function DevnetBanner() {
  const { network } = useApp();

  return (
    <AnimatePresence>
      {network === 'devnet' && (
        <motion.div
          key="devnet-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div
            className="flex items-center justify-center gap-2.5 px-4 py-2 text-[11.5px] font-semibold tracking-wide"
            style={{
              background: 'rgba(16,217,140,0.07)',
              borderBottom: '1px solid rgba(16,217,140,0.18)',
              color: 'var(--green)',
            }}
          >
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            <span>
              Devnet Sandbox — balances and transactions are test data only. No real funds at risk.
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient background mesh — subtle depth */}
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute"
          style={{
            width: 900,
            height: 900,
            top: -300,
            left: -200,
            background: 'radial-gradient(ellipse, rgba(168,85,247,0.055) 0%, transparent 65%)',
            borderRadius: '50%',
          }}
        />
        <div
          className="absolute"
          style={{
            width: 700,
            height: 700,
            bottom: -200,
            right: -150,
            background: 'radial-gradient(ellipse, rgba(45,212,191,0.04) 0%, transparent 65%)',
            borderRadius: '50%',
          }}
        />
      </div>

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Topbar />
        <DevnetBanner />
        <main
          className="flex-1 overflow-auto"
          style={{ padding: 'clamp(28px, 3vw, 48px)' }}
        >
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
