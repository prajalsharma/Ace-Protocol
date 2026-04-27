'use client';
import { AppShell } from '@/components/layout/AppShell';
import { CashflowSummary } from '@/components/dashboard/CashflowSummary';
import { InsightsFeed } from '@/components/dashboard/InsightsFeed';
import { ExecutionQuality } from '@/components/dashboard/ExecutionQuality';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { AllocationChart } from '@/components/charts/AllocationChart';
import { YieldChart } from '@/components/charts/YieldChart';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { Loader2, Plus, RefreshCw, Anchor } from 'lucide-react';
import { formatUsd, formatPercent } from '@/lib/utils';

export default function DashboardPage() {
  const { vault, summary, transactions, isLoading, refreshVault } = useApp();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
            <p className="text-sm text-gray-500">Charting your course…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!vault || !summary) return null;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Vault hero banner */}
        <div className="relative rounded-2xl overflow-hidden border border-orange-500/20 bg-gradient-to-br from-orange-900/20 via-[#13131a] to-[#0c0c13] p-6">
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, #ff6b2b 0%, transparent 60%), radial-gradient(circle at 80% 50%, #f4a935 0%, transparent 60%)',
          }} />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Anchor className="w-4 h-4 text-orange-400" />
                <Badge variant="success">Active Vault</Badge>
                <Badge variant="muted">Devnet</Badge>
              </div>
              <h2 className="text-3xl font-bold text-white">{formatUsd(vault.totalDeposited)}</h2>
              <p className="text-gray-400 text-sm mt-0.5">Total capital under management</p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="text-emerald-400 font-semibold">{formatPercent(vault.apy)} APY</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-400">Risk: {vault.riskLevel}</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-400">Voyage #{vault.id.slice(-3)}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={refreshVault}>
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
              <Button size="sm">
                <Plus className="w-3.5 h-3.5" />
                Deposit
              </Button>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <CashflowSummary summary={summary} />

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-5">

          {/* Left column: allocation + insights */}
          <div className="lg:col-span-2 space-y-5">
            <InsightsFeed />

            {/* Yield chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cumulative Yield (30 days)</CardTitle>
                <span className="text-xs text-emerald-400 font-medium">+$312.80</span>
              </CardHeader>
              <YieldChart />
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Allocation donut */}
            <Card>
              <CardHeader>
                <CardTitle>Capital Allocation</CardTitle>
              </CardHeader>
              <AllocationChart vault={vault} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { label: 'Yield',      value: vault.yieldBalance,    color: '#10b981' },
                  { label: 'Reserve',    value: vault.reserveBalance,   color: '#f4a935' },
                  { label: 'Liquid',     value: vault.liquidBalance,    color: '#ff6b2b' },
                  { label: 'Payments',   value: vault.paymentsBalance,  color: '#0ea5e9' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="text-gray-500">{label}</span>
                    <span className="ml-auto text-gray-300 font-medium">{formatUsd(value, 0)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <ExecutionQuality metrics={summary.executionQuality} />
          </div>
        </div>

        {/* Recent activity */}
        <RecentActivity transactions={transactions} />
      </div>
    </AppShell>
  );
}
