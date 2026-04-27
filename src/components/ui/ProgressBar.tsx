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
  const colors: Record<string, string> = {
    fire:  'bg-gradient-to-r from-[#ff6b2b] to-[#f4a935]',
    green: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    ocean: 'bg-gradient-to-r from-sky-500 to-cyan-400',
    gold:  'bg-gradient-to-r from-yellow-500 to-amber-400',
    muted: 'bg-gray-600',
  };

  return (
    <div className={cn('relative', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{value.toFixed(0)}%</span>
          <span>{max}%</span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', colors[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
