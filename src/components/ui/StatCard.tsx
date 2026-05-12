'use client';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  subValue,
  icon,
  accent = 'amber',
  className,
  delta,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  accent?: 'amber' | 'green' | 'red' | 'blue' | 'muted';
  className?: string;
  delta?: { label: string; positive?: boolean };
  delay?: number;
}) {
  const accentColor: Record<string, string> = {
    amber: 'var(--amber)',
    green: 'var(--green)',
    red:   'var(--red)',
    blue:  'var(--blue)',
    muted: 'var(--text-tertiary)',
  };
  const accentBg: Record<string, string> = {
    amber: 'rgba(244,166,34,0.10)',
    green: 'rgba(34,197,94,0.10)',
    red:   'rgba(244,63,94,0.10)',
    blue:  'rgba(59,130,246,0.10)',
    muted: 'rgba(255,255,255,0.05)',
  };
  const color = accentColor[accent] ?? accentColor.amber;
  const bg = accentBg[accent] ?? accentBg.amber;

  return (
    <div className={cn('card-base p-4 flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="label-metric">{label}</span>
        {icon && (
          <div
            className="w-6 h-6 flex items-center justify-center"
            style={{ background: bg, borderRadius: '6px', color }}
          >
            <span className="[&>svg]:w-3 [&>svg]:h-3">{icon}</span>
          </div>
        )}
      </div>
      <div>
        <p className="value-lg" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {subValue && (
            <p className="text-[10px] leading-none" style={{ color: 'var(--text-muted)' }}>{subValue}</p>
          )}
          {delta && (
            <span
              className="text-[10px] font-semibold leading-none"
              style={{ color: delta.positive ? 'var(--green)' : 'var(--red)' }}
            >
              {delta.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
