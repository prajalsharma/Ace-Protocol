'use client';
import { Zap, Clock, CheckCircle2, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ExecutionQualityMetric } from '@/types';

export function ExecutionQuality({ metrics }: { metrics: ExecutionQualityMetric }) {
  const stats = [
    { label: 'Avg slippage',      value: `${metrics.avgSlippage.toFixed(1)} bps`,  icon: TrendingDown,  color: 'var(--green)' },
    { label: 'Exec time',         value: `${metrics.avgExecutionTime.toFixed(1)}s`, icon: Clock,         color: 'var(--blue)' },
    { label: 'Success rate',      value: `${metrics.successRate.toFixed(1)}%`,      icon: CheckCircle2,  color: 'var(--green)' },
    { label: 'Saved vs baseline', value: `$${metrics.savedVsBaseline.toFixed(2)}`,  icon: Zap,           color: 'var(--teal)' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Execution Quality</CardTitle></CardHeader>
      <div className="space-y-px">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="flex items-center gap-3 py-2.5"
            style={{ borderBottom: '1px solid var(--border-lo)' }}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
            <span className="text-[11px] flex-1" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
            <span className="text-[12px] font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
