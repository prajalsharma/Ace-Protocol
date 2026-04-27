'use client';
import { Zap, Clock, CheckCircle2, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ExecutionQualityMetric } from '@/types';

export function ExecutionQuality({ metrics }: { metrics: ExecutionQualityMetric }) {
  const stats = [
    { label: 'Avg slippage',     value: `${metrics.avgSlippage.toFixed(1)} bps`, icon: TrendingDown, color: 'text-emerald-400' },
    { label: 'Exec time',         value: `${metrics.avgExecutionTime.toFixed(1)}s`, icon: Clock,        color: 'text-sky-400' },
    { label: 'Success rate',      value: `${metrics.successRate.toFixed(1)}%`,    icon: CheckCircle2,  color: 'text-emerald-400' },
    { label: 'Saved vs baseline', value: `$${metrics.savedVsBaseline.toFixed(2)}`,icon: Zap,           color: 'text-yellow-400' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Execution Quality</CardTitle></CardHeader>
      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
            <Icon className={`w-4 h-4 shrink-0 ${color}`} />
            <div>
              <p className="text-xs text-gray-600">{label}</p>
              <p className="text-sm font-semibold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
