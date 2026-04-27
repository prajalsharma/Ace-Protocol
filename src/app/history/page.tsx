'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd, formatTimestamp, formatShortAddress } from '@/lib/utils';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, DollarSign, Sprout, Coins, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TransactionRecord } from '@/types';

const typeConfig: Record<string, { icon: React.ElementType; label: string; color: string; amtColor: string }> = {
  deposit:       { icon: ArrowDownLeft, label: 'Deposit',       color: 'text-emerald-400 bg-emerald-500/10', amtColor: 'text-emerald-400' },
  withdraw:      { icon: ArrowUpRight,  label: 'Withdraw',      color: 'text-orange-400 bg-orange-500/10',   amtColor: 'text-orange-400' },
  rebalance:     { icon: RefreshCw,     label: 'Rebalance',     color: 'text-sky-400 bg-sky-500/10',         amtColor: 'text-white' },
  payout:        { icon: DollarSign,    label: 'Auto-Payout',   color: 'text-yellow-400 bg-yellow-500/10',   amtColor: 'text-yellow-400' },
  yield_harvest: { icon: Sprout,        label: 'Yield Harvest', color: 'text-emerald-400 bg-emerald-500/10', amtColor: 'text-emerald-400' },
  fee:           { icon: Coins,         label: 'Protocol Fee',  color: 'text-gray-400 bg-gray-500/10',       amtColor: 'text-gray-400' },
};

const TYPE_FILTERS = ['all', 'deposit', 'withdraw', 'payout', 'yield_harvest', 'rebalance'];

export default function HistoryPage() {
  const { transactions, isLoading } = useApp();
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? transactions : transactions.filter(tx => tx.type === filter);

  const totalDeposited = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amountUsd, 0);
  const totalYield = transactions.filter(t => t.type === 'yield_harvest').reduce((s, t) => s + t.amountUsd, 0);
  const totalPayouts = transactions.filter(t => t.type === 'payout').reduce((s, t) => s + t.amountUsd, 0);

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total deposited', value: formatUsd(totalDeposited), color: 'text-emerald-400' },
            { label: 'Yield earned',    value: formatUsd(totalYield),     color: 'text-emerald-400' },
            { label: 'Payouts sent',    value: formatUsd(totalPayouts),   color: 'text-yellow-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-[#2a2a3a] bg-[#13131a] p-4">
              <p className="text-xs text-gray-600 uppercase tracking-wider">{label}</p>
              <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all border',
                filter === f
                  ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                  : 'text-gray-500 border-[#2a2a3a] hover:text-gray-300 hover:border-[#3a3a4a]',
              )}>
              {f === 'all' ? 'All' : typeConfig[f]?.label ?? f}
            </button>
          ))}
        </div>

        {/* Transaction list */}
        <Card>
          <CardHeader>
            <CardTitle>Voyage Log</CardTitle>
            <span className="text-xs text-gray-600">{filtered.length} transactions</span>
          </CardHeader>
          <div className="space-y-1">
            {filtered.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-8">No transactions found.</p>
            )}
            {filtered.map(tx => <TxRow key={tx.id} tx={tx} />)}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function TxRow({ tx }: { tx: TransactionRecord }) {
  const cfg = typeConfig[tx.type] ?? typeConfig.fee;
  const Icon = cfg.icon;
  const isPositive = tx.type === 'deposit' || tx.type === 'yield_harvest';

  return (
    <div className="flex items-center gap-4 py-3 px-2 border-b border-[#1a1a24] last:border-0 hover:bg-white/2 rounded-lg transition-all group">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs', cfg.color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{tx.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-600">{formatTimestamp(tx.timestamp)}</span>
          {tx.txHash && (
            <span className="text-[10px] font-mono text-gray-700">{formatShortAddress(tx.txHash)}</span>
          )}
          {tx.slippage !== undefined && (
            <span className="text-[10px] text-gray-700">slippage: {tx.slippage} bps</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <p className={cn('text-sm font-semibold', cfg.amtColor)}>
          {isPositive ? '+' : ''}{formatUsd(tx.amountUsd)}
        </p>
        <Badge variant={tx.status === 'confirmed' ? 'success' : tx.status === 'failed' ? 'danger' : 'muted'} className="text-[10px]">
          {tx.status}
        </Badge>
      </div>
      {tx.txHash && (
        <a href={`https://solscan.io/tx/${tx.txHash}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-gray-400">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}
