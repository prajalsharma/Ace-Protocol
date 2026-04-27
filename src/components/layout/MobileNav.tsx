'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Wallet, CreditCard, History, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Bridge',    icon: LayoutDashboard },
  { href: '/vault',     label: 'Vault',     icon: Wallet },
  { href: '/payments',  label: 'Payments',  icon: CreditCard },
  { href: '/history',   label: 'Log',       icon: History },
  { href: '/ai',        label: 'AI Crew',   icon: Cpu },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-[#0c0c13]/95 backdrop-blur-md border-t border-[#2a2a3a] z-50">
      <div className="flex">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] transition-all',
                active ? 'text-orange-400' : 'text-gray-600',
              )}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
