'use client';
import { cn } from '@/lib/utils';

export function ProgressBar({
  value,
  max = 100,
  color = 'fire',
  className,
  showLabel,
}: {
  value: number;
  max?: number;
  color?: 'fire' | 'green' | 'ocean' | 'gold' | 'muted';
  className?: string;
  showLabel?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const colorStyles: Record<string, string> = {
    fire:  '#f4a622',
    green: '#22c55e',
    ocean: '#38bdf8',
    gold:  '#eab308',
    muted: 'var(--text-muted)',
  };
  const fillColor = colorStyles[color] ?? colorStyles.fire;

  return (
    <div className={cn('relative', className)}>
      {showLabel && (
        <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-tertiary)' }}>
          <span>{value.toFixed(0)}%</span>
          <span>{max}%</span>
        </div>
      )}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: fillColor }}
        />
      </div>
    </div>
  );
}
