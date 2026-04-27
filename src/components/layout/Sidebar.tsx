'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Flame, LayoutDashboard, Wallet, CreditCard,
  History, Cpu, BookOpen, Anchor, ChevronRight, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';

const NAV = [
  { href: '/dashboard',    label: 'Bridge',      icon: LayoutDashboard, desc: 'Overview' },
  { href: '/vault',        label: 'Vault',        icon: Wallet,          desc: 'Your treasure' },
  { href: '/payments',     label: 'Payments',     icon: CreditCard,      desc: 'Scheduled' },
  { href: '/history',      label: 'Log',          icon: History,         desc: 'Voyage log' },
  { href: '/activity',     label: 'Activity',     icon: Activity,        desc: 'Engine decisions' },
  { href: '/ai',           label: 'AI Crew',      icon: Cpu,             desc: 'Insights', badge: 'new' },
  { href: '/architecture', label: 'Charts',       icon: BookOpen,        desc: 'Architecture' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSimulationMode, isWalletConnected } = useApp();
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-[#2a2a3a] bg-[#0c0c13] min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#2a2a3a]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff6b2b] to-[#f4a935] flex items-center justify-center fire-glow">
          <Anchor className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-white tracking-tight">ACE Protocol</span>
          <p className="text-[10px] text-gray-600 leading-none">Adaptive Cashflow Engine</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                active
                  ? 'bg-gradient-to-r from-orange-500/15 to-orange-500/5 text-white border border-orange-500/20'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/5',
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-orange-400' : 'text-gray-600 group-hover:text-gray-400')} />
              <span className="flex-1">{label}</span>
              {badge && <Badge variant="fire" className="text-[10px]">{badge}</Badge>}
              {active && <ChevronRight className="w-3 h-3 text-orange-400/50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 pb-5 border-t border-[#2a2a3a] pt-4">
        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <Flame className="w-3 h-3 text-orange-500/50" />
          <span>{isWalletConnected ? 'Live · Devnet' : 'Simulation Mode'}</span>
        </div>
        <p className="text-[10px] text-gray-700 mt-1">v0.1.0-alpha · Devnet</p>
      </div>
    </aside>
  );
}
