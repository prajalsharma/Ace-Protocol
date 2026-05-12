'use client';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, DollarSign, Sprout, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatUsd, formatTimestamp } from '@/lib/utils';
import type { TransactionRecord } from '@/types';
import Link from 'next/link';

const typeConfig: Record<string, {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  color: string;
}> = {
  deposit:       { icon: ArrowDownLeft, label: 'Deposit',   color: 'var(--green)' },
  withdraw:      { icon: ArrowUpRight,  label: 'Withdraw',  color: 'var(--teal)' },
  rebalance:     { icon: RefreshCw,     label: 'Rebalance', color: 'var(--blue)' },
  payout:        { icon: DollarSign,    label: 'Payout',    color: 'var(--teal)' },
  yield_harvest: { icon: Sprout,        label: 'Yield',     color: 'var(--green)' },
  fee:           { icon: Coins,         label: 'Fee',       color: 'var(--text-tertiary)' },
};

export function RecentActivity({ transactions }: { transactions: TransactionRecord[] }) {
  const recent = transactions.slice(0, 6);

  return (
    <div className="card-base overflow-hidden" style={{ padding: 0 }}>
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border-base)' }}
      >
        <h3 className="label-metric">Recent Activity</h3>
        <Link
          href="/activity"
          className="text-[10px] font-medium transition-colors"
          style={{ color: 'var(--teal)', opacity: 0.7 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; }}
        >
          View all
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            No recent activity. Interact with the vault to see transactions.
          </p>
        </div>
      ) : (
        <div>
          {recent.map((tx) => {
            const cfg = typeConfig[tx.type] ?? typeConfig.fee;
            const Icon = cfg.icon;
            const isCredit = tx.type === 'deposit' || tx.type === 'yield_harvest';
            return (
              <div
                key={tx.id}
                className="ledger-row"
              >
                {/* Type indicator */}
                <div
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0 mr-3"
                  style={{
                    background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
                    borderRadius: '5px',
                  }}
                >
                  <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                </div>

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {tx.description}
                  </p>
                  <p className="text-[10px] mt-0.5"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    {formatTimestamp(tx.timestamp)}
                  </p>
                </div>

                {/* Amount + status */}
                <div className="text-right shrink-0 ml-3">
                  <p
                    className="text-[12px] font-semibold tabular-nums leading-snug"
                    style={{
                      color: isCredit ? 'var(--green)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {isCredit ? '+' : ''}{formatUsd(tx.amountUsd)}
                  </p>
                  <div className="flex justify-end mt-1">
                    <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'failed' ? 'danger' : 'muted'}>
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
