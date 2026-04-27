'use client';
import { cn } from '@/lib/utils';

type Variant = 'fire' | 'gold' | 'success' | 'danger' | 'muted' | 'ocean';

const variants: Record<Variant, string> = {
  fire: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  gold: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30',
  muted: 'bg-white/5 text-gray-400 border border-white/10',
  ocean: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
};

export function Badge({ children, variant = 'muted', className }: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}
