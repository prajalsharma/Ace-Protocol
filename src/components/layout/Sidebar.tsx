'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Vault, CreditCard,
  BrainCircuit, LockKeyhole, Cpu,
  MonitorSpeaker, ArrowRightLeft,
  Activity, Settings, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { motion } from 'framer-motion';
import { AceMark } from '@/components/brand/AceMark';

const NAV_GROUPS = [
  {
    label: 'Treasury',
    items: [
      { href: '/dashboard',  label: 'Overview',        icon: LayoutDashboard },
      { href: '/vault',      label: 'Vault',            icon: Vault },
      { href: '/payments',   label: 'Payments',         icon: CreditCard },
      { href: '/staking',    label: 'Staking',          icon: TrendingUp, tag: 'YIELD' as const },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/treasury',          label: 'Treasury Intel',  icon: BrainCircuit,   tag: 'LIVE' as const },
      { href: '/qvac',              label: 'QVAC',             icon: MonitorSpeaker, tag: 'LOCAL' as const },
      { href: '/private-transfers', label: 'Private',          icon: LockKeyhole,   tag: 'CLOAK' as const },
      { href: '/ai',                label: 'AI Crew',          icon: Cpu },
      { href: '/jupiter',           label: 'Jupiter',          icon: ArrowRightLeft },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/activity', label: 'Activity',  icon: Activity },
      { href: '/settings', label: 'Settings',  icon: Settings },
    ],
  },
];

const TAG_STYLES: Record<string, string> = {
  LIVE:  'bg-[rgba(45,212,191,0.08)] text-[#5eead4] border-[rgba(45,212,191,0.20)]',
  LOCAL: 'bg-[rgba(245,158,11,0.08)] text-[#fbbf24] border-[rgba(245,158,11,0.20)]',
  CLOAK: 'bg-[rgba(168,85,247,0.08)] text-[#c084fc] border-[rgba(168,85,247,0.18)]',
  YIELD: 'bg-[rgba(59,130,246,0.08)] text-[#93c5fd] border-[rgba(59,130,246,0.18)]',
};

const sidebarVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.028, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] } },
};

export function Sidebar() {
  const pathname = usePathname();
  const { isWalletConnected } = useApp();

  return (
    <aside
      className="hidden lg:flex flex-col w-[268px] shrink-0 min-h-screen"
      style={{
        background: 'var(--bg-void)',
        borderRight: '1px solid var(--border-base)',
      }}
    >
      {/* ── Logo lockup ── */}
      <div
        className="flex items-center gap-3.5 px-5 h-[76px] shrink-0"
        style={{ borderBottom: '1px solid var(--border-base)' }}
      >
        <AceMark className="h-11 w-11 shrink-0" glow />
        <div className="min-w-0 leading-none">
          <div
            className="text-[15.5px] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.038em', lineHeight: 1 }}
          >
            <span style={{ color: '#fff' }}>ACE</span>
            <span style={{ color: 'rgba(255,255,255,0.62)', fontWeight: 400 }}> Protocol</span>
          </div>
          <div
            className="text-[8.5px] leading-none mt-[7px] tracking-[0.22em] uppercase"
            style={{ color: 'var(--teal)', opacity: 0.75 }}
          >
            Treasury Autopilot
          </div>
        </div>
      </div>

      {/* ── Nav groups ── */}
      <motion.nav
        variants={sidebarVariants}
        initial="hidden"
        animate="show"
        className="flex-1 px-3 py-7 space-y-7 overflow-y-auto"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-3 label-section">{group.label}</p>
            <div className="space-y-[2px]">
              {group.items.map(({ href, label, icon: Icon, tag }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <motion.div key={href} variants={itemVariants}>
                    <Link
                      href={href}
                      className={cn('nav-item', active && 'active')}
                    >
                      {/* Active background indicator */}
                      {active && (
                        <motion.div
                          layoutId="sidebar-active-bg"
                          className="absolute inset-0 rounded-[var(--r-md)]"
                          style={{
                            background: 'rgba(45,212,191,0.07)',
                            border: '1px solid rgba(45,212,191,0.14)',
                          }}
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      {/* Active left bar */}
                      {active && (
                        <span
                          className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full"
                          style={{
                            background: 'linear-gradient(180deg, var(--teal-bright), var(--teal))',
                            boxShadow: '0 0 8px rgba(45,212,191,0.5)',
                          }}
                        />
                      )}

                      <Icon
                        className="nav-icon relative z-10"
                        style={active ? { color: 'var(--teal)', width: 16, height: 16 } : { width: 16, height: 16 }}
                      />
                      <span
                        className="flex-1 relative z-10 text-[13.5px] leading-none"
                        style={active ? { color: 'var(--text-primary)', fontWeight: 600 } : undefined}
                      >
                        {label}
                      </span>
                      {tag && (
                        <span
                          className={cn('relative z-10 chip', TAG_STYLES[tag])}
                          style={{ fontSize: '9px', padding: '2px 7px', letterSpacing: '0.07em' }}
                        >
                          {tag}
                        </span>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </motion.nav>

      {/* ── Status footer ── */}
      <div
        className="px-5 py-5 shrink-0"
        style={{ borderTop: '1px solid var(--border-base)' }}
      >
        {/* Connection status */}
        <div className="flex items-center gap-2.5 mb-2">
          {isWalletConnected ? (
            <>
              <span className="status-live" style={{ width: 6, height: 6 }} />
              <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                Wallet connected
              </span>
            </>
          ) : (
            <>
              <span className="status-idle" />
              <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                No wallet
              </span>
            </>
          )}
        </div>

        {/* Version */}
        <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.45 }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--teal)', opacity: 0.5 }} />
          <span>ACE Protocol · v0.1.0</span>
        </div>
      </div>
    </aside>
  );
}
