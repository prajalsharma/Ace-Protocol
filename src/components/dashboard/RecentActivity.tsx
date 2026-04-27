'use client';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, DollarSign, Sprout, Coins } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatUsd, formatTimestamp, formatShortAddress } from '@/lib/utils';
import type { TransactionRecord } from '@/types';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const typeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  deposit:       { icon: ArrowDownLeft, label: 'Deposit',       color: 'text-emerald-400' },
  withdraw:      { icon: ArrowUpRight,  label: 'Withdraw',      color: 'text-orange-400' },
  rebalance:     { icon: RefreshCw,     label: 'Rebalance',     color: 'text-sky-400' },
  payout:        { icon: DollarSign,    label: 'Payout',        color: 'text-yellow-400' },
  yield_harvest: { icon: Sprout,        label: 'Yield Harvest', color: 'text-emerald-400' },
  fee:           { icon: Coins,         label: 'Fee',           color: 'text-gray-400' },
};

export function RecentActivity({ transactions }: { transactions: TransactionRecord[] }) {
  const recent = transactions.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <Link href="/history" className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
          View all →
        </Link>
      </CardHeader>
      <div className="space-y-2">
        {recent.map(tx => {
          const cfg = typeConfig[tx.type] ?? typeConfig.fee;
          const Icon = cfg.icon;
          return (
            <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-[#1f1f2e] last:border-0">
              <div className={cn('w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0', cfg.color)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{tx.description}</p>
                <p className="text-xs text-gray-600">{formatTimestamp(tx.timestamp)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn('text-sm font-medium', tx.type === 'deposit' ? 'text-emerald-400' : 'text-white')}>
                  {tx.type === 'deposit' ? '+' : ''}{formatUsd(tx.amountUsd)}
                </p>
                <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'failed' ? 'danger' : 'muted'} className="text-[10px]">
                  {tx.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
