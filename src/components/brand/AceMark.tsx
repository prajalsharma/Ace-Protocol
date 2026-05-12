'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AceMarkProps {
  className?: string;
  glow?: boolean;
  /** unused — kept for backward compat */
  iconOnly?: boolean;
}

/**
 * ACE Protocol icon mark — the standalone symbol, no text.
 * Source: Ace-Protocol-1 (icon only, no wordmark).
 * Sized generously so it reads at every scale.
 */
export function AceMark({ className, glow = false }: AceMarkProps) {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center flex-shrink-0',
        glow && 'drop-shadow-[0_0_28px_rgba(139,92,246,0.55)]',
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/ace-logo-mark.jpg"
        alt="ACE Protocol"
        fill
        className="object-cover rounded-xl"
        priority
        sizes="(max-width: 768px) 56px, 80px"
      />
    </div>
  );
}

/**
 * Full ACE Protocol wordmark lockup (icon + text).
 * Used in sidebar, topbar, landing nav.
 */
export function AceWordmark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 'h-9 w-9',   title: 'text-[15px]', sub: 'text-[8.5px]' },
    md: { icon: 'h-11 w-11', title: 'text-[17px]',  sub: 'text-[9px]' },
    lg: { icon: 'h-14 w-14', title: 'text-[21px]',  sub: 'text-[10.5px]' },
  };
  const s = sizes[size];

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <AceMark className={s.icon} glow />
      <div className="leading-none">
        <div
          className={cn(s.title, 'font-bold tracking-tight text-white')}
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.038em', lineHeight: 1 }}
        >
          <span style={{ color: '#ffffff' }}>ACE</span>
          <span style={{ color: 'rgba(255,255,255,0.68)', fontWeight: 400 }}> Protocol</span>
        </div>
        <div
          className={cn(s.sub, 'mt-1.5 tracking-[0.18em] uppercase')}
          style={{ color: '#5EEAD4', fontFamily: 'var(--font-body)', lineHeight: 1, opacity: 0.8 }}
        >
          Treasury Autopilot · Solana
        </div>
      </div>
    </div>
  );
}
