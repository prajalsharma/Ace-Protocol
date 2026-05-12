'use client';
import { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { getLog, subscribeLog } from '@/lib/activityLog';
import type { LogEntry } from '@/lib/activityLog';
import { useApp } from '@/context/AppContext';
import { formatUsd } from '@/lib/utils';
import type { InsightRequest, InsightResponse } from '@/app/api/insights/route';
import {
  ArrowDownLeft, Zap, ShieldCheck, TrendingUp, AlertCircle,
  Settings, ArrowUpRight, Clock, Cpu, RefreshCw, Loader2,
  Sparkles, DollarSign, BarChart3, ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { estimateQuickFee } from '@/lib/feeEngine';

const typeConfig: Record<LogEntry['type'], {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  label: string;
}> = {
  deposit:            { icon: ArrowDownLeft, color: 'var(--green)',         label: 'Deposit' },
  withdraw:           { icon: ArrowUpRight,  color: 'var(--teal)',         label: 'Withdraw' },
  payment:            { icon: Zap,           color: 'var(--teal)',         label: 'Payment' },
  execution_decision: { icon: Clock,         color: 'var(--blue)',          label: 'Execution' },
  policy:             { icon: Settings,      color: 'var(--text-tertiary)', label: 'Policy' },
  yield:              { icon: TrendingUp,    color: 'var(--green)',         label: 'Yield / Stake' },
  reserve:            { icon: ShieldCheck,   color: 'var(--blue)',          label: 'Reserve' },
  error:              { icon: AlertCircle,   color: 'var(--red)',           label: 'Error' },
};

function formatTs(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function ActivityPage() {
  const { vault, payments, transactions, summary } = useApp();
  const [entries, setEntries] = useState<LogEntry[]>(getLog);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    const unsub = subscribeLog(() => setEntries(getLog()));
    return unsub;
  }, []);

  const fetchInsight = useCallback(async () => {
    if (!vault) return;
    setLoadingInsight(true);
    const now = Math.floor(Date.now() / 1000);
    const safetyWindow = 7 * 86400;
    const upcoming = payments.filter(p => p.status === 'scheduled' && p.nextDue < now + safetyWindow);
    const totalUpcomingUsd = upcoming.reduce((s, p) => s + p.amountUsd, 0);
    const reserveRatio = vault.totalDeposited > 0
      ? Math.round((vault.reserveBalance / vault.totalDeposited) * 100)
      : 0;
    const reserveCoverage: InsightRequest['reserveCoverage'] =
      reserveRatio >= 15 ? 'healthy' : reserveRatio >= 8 ? 'warning' : 'critical';
    const body: InsightRequest = {
      reserveCoverage,
      upcomingPayments: upcoming.length,
      totalUpcomingUsd,
      executionUrgency: upcoming.some(p => p.nextDue < now + 86400) ? 'high'
        : upcoming.some(p => p.nextDue < now + 3 * 86400) ? 'medium' : 'low',
      estimatedFee: 0.000045,
      reserveRatio,
      freeBalance: vault.liquidBalance,
      investableBalance: vault.yieldBalance,
    };
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) setInsight(await res.json());
    } catch { /* silent */ }
    setLoadingInsight(false);
  }, [vault, payments]);

  useEffect(() => {
    if (!vault) return;
    const timer = setTimeout(() => void fetchInsight(), 0);
    return () => clearTimeout(timer);
  }, [vault]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  // ── Revenue metrics from real transaction ledger ─────────────────────────
  const paymentTxs = transactions.filter(tx => tx.type === 'payout' || tx.type === 'fee');
  const totalProtocolRevenue = paymentTxs.reduce((s, tx) => {
    const fee = estimateQuickFee(tx.amountUsd, 72);
    return s + fee.feeUsd;
  }, 0);
  const last30TxCount = paymentTxs.filter(tx => tx.timestamp > Math.floor(Date.now() / 1000) - 30 * 86400).length;
  const avgFeeUsd = paymentTxs.length > 0 ? totalProtocolRevenue / paymentTxs.length : 0;
  const protocolFeePaid = summary?.protocolFeePaid ?? 0;
  const currentFee = vault ? estimateQuickFee(100, 72) : null;

  return (
    <AppShell>
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto space-y-5"
      >

        {/* ── Header ── */}
        <motion.div variants={stagger.item}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[20px] font-semibold tracking-tight font-display"
                style={{ color: 'var(--text-primary)' }}
              >
                Activity & Revenue
              </h1>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Execution log, protocol fee collection, and revenue analytics
              </p>
            </div>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {entries.length} events
            </span>
          </div>
        </motion.div>

        {/* ── Revenue KPI row ── */}
        <motion.div variants={stagger.item}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Protocol Revenue',
                value: formatUsd(totalProtocolRevenue),
                sub: 'Total fees earned by ACE',
                color: 'var(--teal)',
                icon: DollarSign,
              },
              {
                label: 'Fees Paid',
                value: formatUsd(protocolFeePaid),
                sub: 'Your total fee contributions',
                color: '#a78bfa',
                icon: BarChart3,
              },
              {
                label: 'Avg Fee / Execution',
                value: formatUsd(avgFeeUsd),
                sub: `Over ${paymentTxs.length} executed payments`,
                color: 'var(--blue)',
                icon: Zap,
              },
              {
                label: 'Current Fee Rate',
                value: currentFee ? currentFee.label : '—',
                sub: 'Dynamic 25–200 bps · market conditions',
                color: 'var(--green)',
                icon: TrendingUp,
              },
            ].map(({ label, value, sub, color, icon: Icon }) => (
              <div key={label} className="card-base p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="label-metric">{label}</p>
                  <div className="w-7 h-7 flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, borderRadius: '7px' }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                </div>
                <p className="text-[16px] font-semibold tabular-nums"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                >
                  {value}
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Fee model explainer ── */}
        <motion.div variants={stagger.item}>
          <div className="rounded-xl p-4"
            style={{ border: '1px solid rgba(45,212,191,0.16)', background: 'rgba(45,212,191,0.04)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-3.5 h-3.5" style={{ color: 'var(--teal)' }} />
              <span className="text-[12px] font-semibold" style={{ color: 'var(--teal)' }}>
                ACE Protocol Fee Model
              </span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 text-[11px]">
              {[
                { label: 'Base fee', value: '40 bps (0.40%)', note: 'Calm market baseline' },
                { label: 'Minimum', value: '25 bps (0.25%)', note: 'Best conditions' },
                { label: 'Maximum', value: '200 bps (2.00%)', note: 'High congestion + urgency' },
              ].map(({ label, value, note }) => (
                <div key={label} className="p-3 rounded-lg"
                  style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.12)' }}
                >
                  <p style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="font-semibold mt-1 tabular-nums" style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>
                    {value}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{note}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
              Fee is dynamic and computed from: network congestion, SOL volatility, urgency window, payment size, and recurring-payment discount. Recurring automated payments receive −10 bps discount.
            </p>
          </div>
        </motion.div>

        {/* ── Type summary chips ── */}
        {Object.entries(counts).length > 0 && (
          <motion.div variants={stagger.item}>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(counts).map(([type, count]) => {
                const cfg = typeConfig[type as LogEntry['type']];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <span key={type} className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium"
                    style={{
                      background: `color-mix(in srgb, ${cfg.color} 8%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${cfg.color} 16%, transparent)`,
                      color: cfg.color,
                      borderRadius: '5px',
                    }}
                  >
                    <Icon className="w-2.5 h-2.5" />
                    {cfg.label}: {count}
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── AI Insight Panel ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-base)' }}
            >
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5" style={{ color: 'rgba(45,212,191,0.6)' }} />
                <span className="label-metric">AI Execution Insight</span>
                <Badge variant="local">Local AI</Badge>
                {insight && (
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    · {insight.generatedBy}
                  </span>
                )}
              </div>
              <button onClick={() => void fetchInsight()} disabled={loadingInsight || !vault}
                className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
                style={{ fontSize: '10px', padding: '5px 10px' }}
              >
                {loadingInsight
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />
                }
                Refresh
              </button>
            </div>

            <div className="p-4">
              {loadingInsight && !insight && (
                <div className="flex items-center gap-3 py-6 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--teal)' }} />
                  Generating insight from vault state…
                </div>
              )}
              {!loadingInsight && !vault && (
                <p className="text-[11px] py-4" style={{ color: 'var(--text-tertiary)' }}>
                  Connect a wallet to generate insights.
                </p>
              )}
              {insight && (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg"
                    style={{ border: '1px solid rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.04)' }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3 h-3" style={{ color: 'var(--blue)' }} />
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--blue)' }}>Summary</p>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {insight.summary}
                    </p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg"
                      style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ShieldCheck className="w-3 h-3" style={{ color: 'var(--teal)' }} />
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--teal)' }}>Reserve Logic</p>
                      </div>
                      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {insight.reserveExplanation}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg"
                      style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Clock className="w-3 h-3" style={{ color: 'var(--blue)' }} />
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--blue)' }}>Execution Timing</p>
                      </div>
                      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {insight.executionExplanation}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg"
                    style={{ border: '1px solid rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.04)' }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp className="w-3 h-3" style={{ color: 'var(--green)' }} />
                      <p className="text-[10px] font-semibold" style={{ color: 'var(--green)' }}>Recommendation</p>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {insight.recommendation}
                    </p>
                  </div>
                  <p className="text-[9px] italic" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                    AI provides explanations only. Fund movements require explicit user action.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Transaction ledger with fee column ── */}
        {transactions.length > 0 && (
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Executed Payments + Protocol Revenue</h3>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {transactions.length} records
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {transactions.map(tx => {
                  const fee = estimateQuickFee(tx.amountUsd, 72);
                  const isPayment = tx.type === 'payout' || tx.type === 'fee';
                  return (
                    <div key={tx.id} className="ledger-row group">
                      <div className="w-6 h-6 shrink-0 flex items-center justify-center mr-3"
                        style={{
                          background: isPayment ? 'rgba(45,212,191,0.10)' : 'rgba(34,197,94,0.08)',
                          borderRadius: '6px',
                        }}
                      >
                        {isPayment
                          ? <Zap className="w-3 h-3" style={{ color: 'var(--teal)' }} />
                          : <ArrowDownLeft className="w-3 h-3" style={{ color: 'var(--green)' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {formatDate(tx.timestamp)}
                          </span>
                          {tx.txHash && (
                            <>
                              <span style={{ color: 'var(--border-base)' }}>·</span>
                              <a
                                href={`https://explorer.solana.com/tx/${tx.txHash}?cluster=devnet`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}
                              >
                                {tx.txHash.slice(0, 14)}… <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 mr-4">
                        <p className="text-[12px] font-semibold tabular-nums"
                          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                        >
                          {formatUsd(tx.amountUsd)}
                        </p>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {tx.type.replace(/_/g, ' ')}
                        </p>
                      </div>
                      {isPayment && (
                        <div className="text-right shrink-0 px-3 py-1 rounded"
                          style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.12)', borderRadius: '5px' }}
                        >
                          <p className="text-[10px] font-semibold tabular-nums"
                            style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}
                          >
                            {formatUsd(fee.feeUsd)} fee
                          </p>
                          <p className="text-[9px]" style={{ color: 'var(--teal)', opacity: 0.6 }}>
                            {fee.bps} bps
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Raw activity feed ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-base)' }}
            >
              <h3 className="label-metric">Execution Log</h3>
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {entries.length} events
              </span>
            </div>
            {entries.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  No activity yet. Interact with the vault to see logs.
                </p>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                {entries.map(entry => {
                  const cfg = typeConfig[entry.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={entry.id} className="ledger-row group">
                      <div className="w-7 h-7 shrink-0 flex items-center justify-center mr-3"
                        style={{ background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`, borderRadius: '6px' }}
                      >
                        <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                          {entry.message}
                        </p>
                        {entry.detail && (
                          <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            {entry.detail}
                          </p>
                        )}
                        {entry.txSig && (
                          <a href={`https://solscan.io/tx/${entry.txSig}?cluster=devnet`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[10px] mt-0.5 block transition-colors"
                            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--blue)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          >
                            tx: {entry.txSig.slice(0, 20)}…
                          </a>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {formatTs(entry.timestamp)}
                        </span>
                        <div className="flex justify-end mt-1">
                          <span className="text-[9px] px-1.5 py-px rounded font-medium"
                            style={{
                              background: `color-mix(in srgb, ${cfg.color} 8%, transparent)`,
                              color: cfg.color,
                              border: `1px solid color-mix(in srgb, ${cfg.color} 15%, transparent)`,
                              borderRadius: '4px',
                            }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

      </motion.div>
    </AppShell>
  );
}
