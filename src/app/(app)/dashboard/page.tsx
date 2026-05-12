'use client';
import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CashflowSummary } from '@/components/dashboard/CashflowSummary';
import { InsightsFeed } from '@/components/dashboard/InsightsFeed';
import { ExecutionQuality } from '@/components/dashboard/ExecutionQuality';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { OperationModePanel } from '@/components/dashboard/OperationModePanel';
import { AllocationChart } from '@/components/charts/AllocationChart';
import { YieldChart } from '@/components/charts/YieldChart';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { getExplorerAddressUrl } from '@/lib/rpc';
import { estimateQuickFee } from '@/lib/feeEngine';
import {
  Loader2, Plus, RefreshCw, Anchor, TrendingUp,
  ShieldCheck, AlertTriangle, ExternalLink,
  BrainCircuit, ChevronRight, Zap, DollarSign,
  Sparkles, ArrowRight, BarChart3, Activity,
} from 'lucide-react';
import { formatUsd, formatPercent } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const PROGRAM_ID = 'DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY';

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } },
  item: {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
  },
};

// ── Skeleton loader ────────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="max-w-[1440px] mx-auto space-y-8">
      <div className="h-11 skeleton rounded-[var(--r-xl)] opacity-60" />
      <div className="card-hero p-10" style={{ minHeight: 200 }}>
        <div className="space-y-4">
          <div className="skeleton-line w-20" />
          <div className="skeleton-value w-64" />
          <div className="skeleton-line w-48" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card-base p-8 space-y-4" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="skeleton-line w-28" />
            <div className="skeleton-value w-36" />
            <div className="skeleton-line-sm w-24" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card-base p-8 skeleton-chart" style={{ height: 300 }} />
          <div className="card-base p-8 skeleton-chart" style={{ height: 260 }} />
        </div>
        <div className="space-y-6">
          <div className="card-base p-8 skeleton-chart" style={{ height: 240 }} />
          <div className="card-base p-8 skeleton-chart" style={{ height: 180 }} />
        </div>
      </div>
    </div>
  );
}

// ── Reserve Health ─────────────────────────────────────────────────────────────
function ReserveHealthBar({ reserveBalance, totalDeposited }: { reserveBalance: number; totalDeposited: number }) {
  const ratio = totalDeposited > 0 ? (reserveBalance / totalDeposited) * 100 : 0;
  const isHealthy = ratio >= 15;
  const isWarning = ratio >= 8 && ratio < 15;
  const isCritical = ratio < 8;

  const color = isHealthy ? 'var(--green)' : isWarning ? 'var(--amber)' : 'var(--red)';
  const label = isHealthy ? 'Healthy' : isWarning ? 'Warning' : 'Critical';
  const StatusIcon = isCritical ? AlertTriangle : ShieldCheck;

  return (
    <div className="card-base p-7" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow matching health state */}
      <div className="pointer-events-none absolute inset-0 rounded-[var(--r-xl)]"
        style={{ background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, ${color} 7%, transparent) 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-6 relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center rounded-[10px]"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 22%, transparent)` }}>
            <StatusIcon className="w-4.5 h-4.5" style={{ color, width: 18, height: 18 }} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--text-primary)' }}>
            Reserve Health
          </span>
        </div>
        <span
          className="chip"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
          }}
        >
          {label}
        </span>
      </div>

      <div className="flex items-baseline justify-between mb-4 relative">
        <span className="value-xs tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {ratio.toFixed(1)}%
        </span>
        <span className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>Min 15%</span>
      </div>

      <div className="progress-track relative" style={{ height: 7 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, ratio)}%` }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="progress-fill"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 10px ${color}44`, height: '100%' }}
        />
      </div>
      <div className="relative mt-1.5 h-4">
        <div className="absolute top-0 w-px h-3" style={{ left: '15%', background: 'var(--text-muted)', opacity: 0.35 }} />
        <span className="absolute text-[10px]" style={{ left: 'calc(15% + 5px)', top: '2px', color: 'var(--text-muted)' }}>
          15%
        </span>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed relative" style={{ color: 'var(--text-muted)' }}>
        {isHealthy
          ? 'Reserve above minimum. Capital is safe to deploy.'
          : isWarning
          ? 'Reserve approaching minimum threshold. Reduce discretionary spend.'
          : 'Critical — halt optional deployments immediately.'}
      </p>
    </div>
  );
}

// ── KPI Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, accentColor, icon: Icon, onClick,
}: {
  label: string;
  value: string;
  sub: string;
  accentColor: string;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className="card-base p-7 text-left w-full group"
      style={{
        transition: 'border-color 0.22s var(--ease-out), transform 0.22s var(--ease-out), box-shadow 0.22s var(--ease-out)',
        cursor: onClick ? 'pointer' : undefined,
      }}
      onMouseEnter={onClick ? e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `color-mix(in srgb, ${accentColor} 28%, transparent)`;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = 'var(--shadow-md)';
      } : undefined}
      onMouseLeave={onClick ? e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = '';
        el.style.transform = '';
        el.style.boxShadow = '';
      } : undefined}
    >
      <div className="flex items-start justify-between mb-5">
        <p className="label-metric">{label}</p>
        <div
          className="w-11 h-11 flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, borderRadius: 'var(--r-md)' }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor, width: 20, height: 20 }} />
        </div>
      </div>
      <p className="value-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="text-[13px] mt-3 leading-snug" style={{ color: 'var(--text-muted)' }}>
        {sub}
      </p>
      {onClick && (
        <div
          className="flex items-center gap-1.5 mt-5 text-[12.5px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ color: accentColor }}
        >
          View details <ArrowRight className="w-3.5 h-3.5" />
        </div>
      )}
    </Tag>
  );
}

interface QueueSummary {
  total: number;
  readyCount: number;
  readySoonCount: number;
  totalCommittedUsd: number;
  totalFeesUsd: number;
  reserveHealthy: boolean;
}

export default function DashboardPage() {
  const { vault, summary, transactions, isLoading, refreshVault, sessionToken, network } = useApp();
  const explorerUrl = getExplorerAddressUrl(PROGRAM_ID, network);
  const router = useRouter();
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);

  const fetchQueueSummary = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch('/api/protocol/queue', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json() as { summary: QueueSummary };
        setQueueSummary(data.summary);
      }
    } catch { /* silent */ }
  }, [sessionToken]);

  useEffect(() => { void fetchQueueSummary(); }, [fetchQueueSummary]);

  const paymentTxs = transactions.filter(tx => tx.type === 'payout' || tx.type === 'fee');
  const totalProtocolRevenue = paymentTxs.reduce((s, tx) => {
    const fee = estimateQuickFee(tx.amountUsd, 72);
    return s + fee.feeUsd;
  }, 0);
  const avgFeeUsd = paymentTxs.length > 0 ? totalProtocolRevenue / paymentTxs.length : 0;

  if (isLoading) {
    return <AppShell><DashboardSkeleton /></AppShell>;
  }

  if (!vault || !summary) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-sm w-full text-center space-y-7">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center"
              style={{ borderRadius: 'var(--r-xl)', border: '1px solid var(--border-base)', background: 'rgba(255,255,255,0.02)' }}
            >
              <Anchor className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <div>
              <h2
                className="text-[22px] font-bold tracking-tight mb-3"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}
              >
                Vault initializing
              </h2>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                Your on-chain balance is being read. Connect a funded Solana wallet to load your treasury state.
              </p>
            </div>
            <button onClick={refreshVault} className="btn-secondary inline-flex mx-auto">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh vault state
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-[1440px] mx-auto space-y-8"
      >

        {/* ── Status strip ── */}
        <motion.div variants={stagger.item} className="space-y-3">
          {/* On-chain proof */}
          <div
            className="flex items-center gap-4 px-5 py-3.5 rounded-[var(--r-xl)]"
            style={{ border: '1px solid var(--border-base)', background: 'rgba(5,9,20,0.7)' }}
          >
            <div className="flex items-center gap-2.5 font-semibold shrink-0 text-[13px]"
              style={{ color: network === 'devnet' ? 'var(--green)' : 'var(--teal)' }}>
              <span className="status-live" />
              On-chain · {network}
            </div>
            <span
              className="hidden sm:block text-[11.5px] ml-1 truncate"
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {PROGRAM_ID}
            </span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 shrink-0 text-[12px] font-medium transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
            >
              Explorer <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Treasury Intel CTA */}
          <button
            onClick={() => router.push('/treasury')}
            className="flex items-center gap-4 px-5 py-4 rounded-[var(--r-xl)] transition-all group w-full text-left"
            style={{ border: '1px solid var(--border-base)', background: 'rgba(5,9,20,0.4)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.04)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168,85,247,0.18)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(5,9,20,0.4)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)';
            }}
          >
            <BrainCircuit className="w-4.5 h-4.5 shrink-0" style={{ color: 'var(--violet)', opacity: 0.78, width: 18, height: 18 }} />
            <span className="text-[14px] flex-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
              Treasury Intelligence — analyze your {network === 'devnet' ? 'Devnet' : 'Mainnet'} wallet history with AI
            </span>
            <ChevronRight
              className="w-4.5 h-4.5 shrink-0 transition-transform group-hover:translate-x-0.5"
              style={{ color: 'var(--text-muted)', width: 18, height: 18 }}
            />
          </button>
        </motion.div>

        {/* ── Vault hero ── */}
        <motion.div variants={stagger.item}>
          <div className="card-hero p-10">
            <div className="glow-violet-top" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-7">
              <div>
                <div className="flex items-center gap-2.5 mb-6">
                  <div
                    className="w-9 h-9 flex items-center justify-center"
                    style={{ background: 'var(--violet-dim)', borderRadius: 'var(--r-md)', border: '1px solid rgba(168,85,247,0.22)' }}
                  >
                    <Anchor className="w-4 h-4" style={{ color: 'var(--violet-bright)' }} />
                  </div>
                  <Badge variant="success">Active</Badge>
                  <Badge variant={network === 'devnet' ? 'success' : 'muted'}>
                    {network === 'devnet' ? 'Devnet · Sandbox' : 'Mainnet'}
                  </Badge>
                </div>
                <p className="value-xl tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {formatUsd(vault.totalDeposited)}
                </p>
                <p className="text-[15px] mt-3" style={{ color: 'var(--text-muted)' }}>
                  Total capital under management
                </p>
                <div className="flex items-center gap-5 mt-5 text-[14px]">
                  <span className="flex items-center gap-2 font-semibold" style={{ color: 'var(--green)' }}>
                    <TrendingUp className="w-4 h-4" />
                    {formatPercent(vault.apy)} APY
                  </span>
                  <span style={{ color: 'var(--border-hi)' }}>·</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{vault.riskLevel} risk</span>
                  <span style={{ color: 'var(--border-hi)' }}>·</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                    #{vault.id.slice(-6)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2.5 shrink-0">
                <Button variant="secondary" size="sm" onClick={refreshVault}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
                <Button variant="primary" size="sm" onClick={() => router.push('/vault')}>
                  <Plus className="w-3.5 h-3.5" /> Deposit
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── KPI row ── */}
        <motion.div variants={stagger.item}>
          <CashflowSummary summary={summary} />
        </motion.div>

        {/* ── Protocol stats row ── */}
        <motion.div variants={stagger.item}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              label="Protocol Revenue"
              value={formatUsd(totalProtocolRevenue)}
              sub={`${paymentTxs.length} payments processed`}
              accentColor="var(--violet)"
              icon={DollarSign}
              onClick={() => router.push('/activity')}
            />
            <StatCard
              label="Avg Fee / Execution"
              value={formatUsd(avgFeeUsd)}
              sub="25–200 bps dynamic range"
              accentColor="var(--blue)"
              icon={BarChart3}
            />
            <StatCard
              label="Payment Queue"
              value={queueSummary ? String(queueSummary.readyCount) : '—'}
              sub={queueSummary
                ? `${queueSummary.total} total · ${formatUsd(queueSummary.totalCommittedUsd)}`
                : 'Loading queue…'}
              accentColor="var(--green)"
              icon={Zap}
              onClick={() => router.push('/payments')}
            />
            <StatCard
              label="Idle Yield Capital"
              value={formatUsd(vault.yieldBalance)}
              sub={vault.yieldBalance > 0 ? 'Deploy with Jito or Hylo' : 'No idle capital'}
              accentColor="var(--teal)"
              icon={TrendingUp}
              onClick={() => router.push('/staking')}
            />
          </div>
        </motion.div>

        {/* ── Alert banners ── */}
        <AnimatePresence mode="popLayout">
          {vault.yieldBalance > 100 && (
            <motion.div
              key="staking-banner"
              variants={stagger.item}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -6 }}
            >
              <button
                onClick={() => router.push('/staking')}
                className="w-full flex items-center gap-5 px-7 py-5 rounded-[var(--r-xl)] text-left transition-all group"
                style={{ border: '1px solid rgba(45,212,191,0.18)', background: 'rgba(45,212,191,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(45,212,191,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(45,212,191,0.04)'; }}
              >
                <div
                  className="w-11 h-11 flex items-center justify-center shrink-0"
                  style={{ background: 'var(--teal-dim)', borderRadius: 'var(--r-md)', border: '1px solid rgba(45,212,191,0.22)' }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--teal-bright)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatUsd(vault.yieldBalance)} sitting idle — ACE recommends deploying to Jito or Hylo
                  </p>
                  <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Earn up to 11.4% APY with liquid staking · No lockup required · Sign once
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[12.5px] font-semibold" style={{ color: 'var(--teal)' }}>
                  Deploy <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </motion.div>
          )}

          {queueSummary && queueSummary.readyCount > 0 && (
            <motion.div
              key="payment-banner"
              variants={stagger.item}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: -6 }}
            >
              <button
                onClick={() => router.push('/payments')}
                className="w-full flex items-center gap-5 px-7 py-5 rounded-[var(--r-xl)] text-left transition-all group"
                style={{ border: '1px solid rgba(16,217,140,0.20)', background: 'rgba(16,217,140,0.04)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,217,140,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,217,140,0.04)'; }}
              >
                <div className="flex items-center gap-3 shrink-0">
                  <span className="status-live" style={{ width: 9, height: 9 }} />
                  <span
                    className="text-[12px] font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(16,217,140,0.14)', color: 'var(--green)' }}
                  >
                    {queueSummary.readyCount} ready
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {queueSummary.readyCount} payment{queueSummary.readyCount > 1 ? 's' : ''} ready to execute
                  </p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {formatUsd(queueSummary.totalCommittedUsd)} committed · sign to release
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[12.5px] font-bold" style={{ color: 'var(--green)' }}>
                  Pay Now <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main dashboard grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Left 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div variants={stagger.item}>
              <InsightsFeed />
            </motion.div>
            <motion.div variants={stagger.item}>
              <Card>
                <CardHeader>
                  <CardTitle>Cumulative Yield — 30 Days</CardTitle>
                  <div className="flex items-center gap-2.5">
                    <Activity className="w-4 h-4" style={{ color: 'var(--green)', opacity: 0.8 }} />
                    <span
                      className="text-[15px] font-semibold tabular-nums"
                      style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}
                    >
                      +{formatUsd(summary.totalEarnedYield)}
                    </span>
                  </div>
                </CardHeader>
                <YieldChart />
              </Card>
            </motion.div>
          </div>

          {/* Right 1/3 */}
          <div className="space-y-6">
            <motion.div variants={stagger.item}>
              <Card>
                <CardHeader>
                  <CardTitle>Capital Allocation</CardTitle>
                </CardHeader>
                <AllocationChart vault={vault} />
                <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 mt-5">
                  {[
                    { label: 'Yield',    value: vault.yieldBalance,    color: 'var(--green)' },
                    { label: 'Reserve',  value: vault.reserveBalance,  color: 'var(--amber)' },
                    { label: 'Liquid',   value: vault.liquidBalance,   color: 'var(--orange)' },
                    { label: 'Payments', value: vault.paymentsBalance, color: 'var(--blue)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center gap-2.5 text-[13px]">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                      <span
                        className="ml-auto font-medium tabular-nums"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                      >
                        {formatUsd(value, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>

            <motion.div variants={stagger.item}>
              <ReserveHealthBar
                reserveBalance={vault.reserveBalance}
                totalDeposited={vault.totalDeposited}
              />
            </motion.div>
            <motion.div variants={stagger.item}>
              <OperationModePanel />
            </motion.div>
            <motion.div variants={stagger.item}>
              <ExecutionQuality metrics={summary.executionQuality} />
            </motion.div>
          </div>
        </div>

        {/* ── Activity ledger ── */}
        <motion.div variants={stagger.item}>
          <RecentActivity transactions={transactions} />
        </motion.div>

      </motion.div>
    </AppShell>
  );
}
