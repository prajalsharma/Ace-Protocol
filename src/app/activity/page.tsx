'use client';
// ============================================================
// ACE Protocol — Activity Log Page
// Every protocol decision is logged with human explanation.
// ============================================================

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getLog, subscribeLog } from '@/lib/activityLog';
import type { LogEntry } from '@/lib/activityLog';
import {
  ArrowDownLeft, Zap, ShieldCheck, TrendingUp, AlertCircle,
  Settings, ArrowUpRight, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const typeConfig: Record<LogEntry['type'], { icon: React.ElementType; color: string; label: string }> = {
  deposit:            { icon: ArrowDownLeft, color: 'text-emerald-400 bg-emerald-500/10', label: 'Deposit' },
  withdraw:           { icon: ArrowUpRight,  color: 'text-orange-400 bg-orange-500/10',  label: 'Withdraw' },
  payment:            { icon: Zap,           color: 'text-yellow-400 bg-yellow-500/10',  label: 'Payment' },
  execution_decision: { icon: Clock,         color: 'text-sky-400 bg-sky-500/10',         label: 'Execution' },
  policy:             { icon: Settings,      color: 'text-purple-400 bg-purple-500/10',   label: 'Policy' },
  yield:              { icon: TrendingUp,    color: 'text-emerald-400 bg-emerald-500/10', label: 'Yield' },
  reserve:            { icon: ShieldCheck,   color: 'text-blue-400 bg-blue-500/10',       label: 'Reserve' },
  error:              { icon: AlertCircle,   color: 'text-red-400 bg-red-500/10',          label: 'Error' },
};

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    setEntries(getLog());
    const unsub = subscribeLog(() => setEntries(getLog()));
    return unsub;
  }, []);

  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-900/15 via-[#13131a] to-[#0c0c13] p-5">
          <h2 className="text-lg font-bold text-white">Execution Activity Log</h2>
          <p className="text-sm text-gray-400 mt-1">
            Every decision the ACE engine makes is recorded here with its reason.
            No black-box behavior.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(counts).map(([type, count]) => {
              const cfg = typeConfig[type as LogEntry['type']];
              return (
                <span key={type} className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium', cfg.color)}>
                  <cfg.icon className="w-2.5 h-2.5" />
                  {cfg.label}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Log */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <span className="text-xs text-gray-600">{entries.length} events</span>
          </CardHeader>
          <div className="space-y-1">
            {entries.length === 0 && (
              <p className="text-sm text-gray-600 py-8 text-center">No activity yet. Interact with the vault to see logs.</p>
            )}
            {entries.map(entry => {
              const cfg = typeConfig[entry.type];
              const Icon = cfg.icon;
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-3 px-2 border-b border-[#1a1a24] last:border-0 hover:bg-white/2 rounded-lg transition-all group"
                >
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{entry.message}</p>
                    {entry.detail && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.detail}</p>
                    )}
                    {entry.txSig && (
                      <a
                        href={`https://solscan.io/tx/${entry.txSig}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-gray-700 hover:text-sky-400 transition-colors mt-0.5 block"
                      >
                        tx: {entry.txSig.slice(0, 20)}…
                      </a>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-gray-700 font-mono">{formatTs(entry.timestamp)}</span>
                    <div className="mt-1">
                      <Badge variant="muted" className="text-[9px]">{cfg.label}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
