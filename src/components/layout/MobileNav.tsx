'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Vault, CreditCard,
  BrainCircuit, Settings, ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Overview',  icon: LayoutDashboard },
  { href: '/vault',     label: 'Vault',      icon: Vault },
  { href: '/payments',  label: 'Payments',   icon: CreditCard },
  { href: '/treasury',  label: 'Intel',      icon: BrainCircuit },
  { href: '/jupiter',   label: 'Jupiter',    icon: ArrowRightLeft },
  { href: '/settings',  label: 'Settings',   icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50"
      style={{
        background: 'rgba(8,11,18,0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-base)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-all"
            >
              <div
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                style={{
                  background: active ? 'rgba(45,212,191,0.10)' : 'transparent',
                }}
              >
                <Icon
                  className="w-[15px] h-[15px]"
                  style={{ color: active ? 'var(--teal)' : 'var(--text-muted)' }}
                />
              </div>
              <span
                className="text-[9px] font-semibold tracking-wide"
                style={{ color: active ? 'var(--teal)' : 'var(--text-muted)' }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
