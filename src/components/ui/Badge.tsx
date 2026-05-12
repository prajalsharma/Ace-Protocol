'use client';
import { cn } from '@/lib/utils';

type Variant =
  | 'fire'
  | 'gold'
  | 'success'
  | 'danger'
  | 'muted'
  | 'ocean'
  | 'live'
  | 'autopilot'
  | 'safe'
  | 'private'
  | 'local';

const variantStyles: Record<Variant, React.CSSProperties> = {
  fire:      { color: 'var(--amber)',        background: 'var(--amber-dim)',     borderColor: 'rgba(245,158,11,0.22)' },
  gold:      { color: '#fbbf24',             background: 'rgba(251,191,36,0.09)',borderColor: 'rgba(251,191,36,0.22)' },
  success:   { color: 'var(--teal)',         background: 'var(--teal-dim)',      borderColor: 'rgba(45,212,191,0.22)' },
  danger:    { color: 'var(--red)',          background: 'var(--red-dim)',       borderColor: 'rgba(244,63,94,0.22)' },
  muted:     { color: 'var(--text-tertiary)',background: 'rgba(255,255,255,0.04)',borderColor: 'var(--border-base)' },
  ocean:     { color: 'var(--teal-bright)', background: 'var(--teal-dim)',      borderColor: 'rgba(45,212,191,0.22)' },
  live:      { color: 'var(--teal-bright)', background: 'var(--teal-dim)',      borderColor: 'rgba(45,212,191,0.22)' },
  autopilot: { color: 'var(--violet-bright)',background: 'var(--violet-dim)',   borderColor: 'rgba(168,85,247,0.22)' },
  safe:      { color: 'var(--teal)',         background: 'var(--teal-dim)',      borderColor: 'rgba(45,212,191,0.18)' },
  private:   { color: 'var(--violet-bright)',background: 'var(--violet-dim)',   borderColor: 'rgba(168,85,247,0.22)' },
  local:     { color: 'var(--amber)',        background: 'var(--amber-dim)',     borderColor: 'rgba(245,158,11,0.18)' },
};

export function Badge({
  children,
  variant = 'muted',
  className,
  dot,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-[2px] text-[10px] font-semibold tracking-wide leading-none border',
        className,
      )}
      style={{ borderRadius: '4px', ...variantStyles[variant] }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: 'currentColor', opacity: 0.8 }}
        />
      )}
      {children}
    </span>
  );
}
