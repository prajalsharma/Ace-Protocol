'use client';
import { Wallet, Shield, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { formatUsd, formatRelativeTime } from '@/lib/utils';
import type { DashboardSummary } from '@/types';

export function CashflowSummary({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Safe to spend"
        value={formatUsd(summary.safeToSpend)}
        subValue="Liquid balance"
        icon={<Wallet className="w-5 h-5" />}
        accent="fire"
      />
      <StatCard
        label="Reserved"
        value={formatUsd(summary.reserved)}
        subValue="Harbor buffer"
        icon={<Shield className="w-5 h-5" />}
        accent="ocean"
      />
      <StatCard
        label="Earning yield"
        value={formatUsd(summary.earningYield)}
        subValue={`+$${summary.totalEarnedYield.toFixed(2)} earned`}
        icon={<TrendingUp className="w-5 h-5" />}
        accent="green"
      />
      <StatCard
        label="Next payment"
        value={formatUsd(summary.nextPaymentAmount)}
        subValue={`Due in ${formatRelativeTime(summary.nextPaymentDate)}`}
        icon={<Calendar className="w-5 h-5" />}
        accent="gold"
      />
    </div>
  );
}
