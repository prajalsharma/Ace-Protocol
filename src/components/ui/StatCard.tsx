'use client';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  subValue,
  icon,
  accent = 'fire',
  className,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
  accent?: 'fire' | 'gold' | 'green' | 'ocean' | 'muted';
  className?: string;
}) {
  const accentColors: Record<string, string> = {
    fire:  'from-orange-500/20 to-orange-500/0 border-orange-500/20',
    gold:  'from-yellow-500/20 to-yellow-500/0 border-yellow-500/20',
    green: 'from-emerald-500/20 to-emerald-500/0 border-emerald-500/20',
    ocean: 'from-sky-500/20 to-sky-500/0 border-sky-500/20',
    muted: 'from-white/5 to-white/0 border-white/10',
  };
  const iconColors: Record<string, string> = {
    fire:  'text-orange-400',
    gold:  'text-yellow-400',
    green: 'text-emerald-400',
    ocean: 'text-sky-400',
    muted: 'text-gray-400',
  };

  return (
    <div className={cn(
      'relative rounded-xl border bg-gradient-to-br p-5 overflow-hidden',
      accentColors[accent],
      className,
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
        </div>
        {icon && (
          <div className={cn('text-xl', iconColors[accent])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
