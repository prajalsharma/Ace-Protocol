'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Search, Loader2, ArrowRight, AlertTriangle,
  TrendingDown, Repeat2, Clock, ShieldCheck,
  BarChart3, Zap, Lock, ChevronRight,
  ArrowUpRight, ArrowDownLeft, Sparkles,
} from 'lucide-react';
import type { TreasuryAnalysis } from '@/types';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUsd(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

function fmtAddr(addr?: string) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isValidSolanaAddress(addr: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

// ── Category colors ───────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  payroll:            'var(--teal)',
  infrastructure:     '#6366f1',
  subscription:       '#8b5cf6',
  saas:               '#a78bfa',
  contractor:         '#f59e0b',
  trading:            '#3b82f6',
  treasury_transfer:  '#d97706',
  exchange_deposit:   '#f43f5e',
  ai_infrastructure:  '#7c3aed',
  protocol_operation: '#14b8a6',
  recurring_bill:     '#f97316',
  stablecoin_transfer:'#22c55e',
  sol_transfer:       '#64748b',
  swap:               '#38bdf8',
  nft:                '#c026d3',
  unknown:            '#374151',
};

const CAT_LABELS: Record<string, string> = {
  payroll:            'Payroll',
  infrastructure:     'Infrastructure',
  subscription:       'Subscription',
  saas:               'SaaS',
  contractor:         'Contractor',
  trading:            'Trading',
  treasury_transfer:  'Treasury Transfer',
  exchange_deposit:   'Exchange Deposit',
  ai_infrastructure:  'AI Infrastructure',
  protocol_operation: 'Protocol Ops',
  recurring_bill:     'Recurring Bill',
  stablecoin_transfer:'Stablecoin',
  sol_transfer:       'SOL Transfer',
  swap:               'Swap',
  nft:                'NFT',
  unknown:            'Unclassified',
};

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBadge({ step, label }: { step: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{ background: 'rgba(45,212,191,0.15)', color: 'var(--teal)', border: '1px solid rgba(45,212,191,0.25)' }}
      >
        {step}
      </div>
      <span>{label}</span>
      <div className="w-8 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
    </div>
  );
}

// ── Metric tile ───────────────────────────────────────────────────────────────

function MetricTile({
  icon: Icon, label, value, sub, accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2.5"
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {label}
        </span>
        <div
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ background: `${accent}18` }}
        >
          <Icon className="w-3 h-3" style={{ color: accent }} />
        </div>
      </div>
      <p
        className="text-[1.5rem] font-semibold leading-none tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', color: '#fff', letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] leading-tight" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
    </div>
  );
}

// ── Upcoming bill row ─────────────────────────────────────────────────────────

function BillRow({ pattern }: { pattern: TreasuryAnalysis['recurringPatterns'][0] }) {
  const color = CAT_COLORS[pattern.category] ?? '#374151';
  const label = CAT_LABELS[pattern.category] ?? pattern.category;
  const daysUntil = pattern.nextPredicted
    ? Math.round((pattern.nextPredicted - Date.now() / 1000) / 86400)
    : null;
  const isDue = daysUntil !== null && daysUntil <= 7;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <Repeat2 className="w-3 h-3" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {pattern.label ?? fmtAddr(pattern.counterpartyAddress)}
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Every {pattern.frequencyDays.toFixed(0)}d · {label}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>
          {fmtUsd(pattern.avgAmountUsd)}
        </p>
        {daysUntil !== null && (
          <p className="text-[10px]" style={{ color: isDue ? '#f43f5e' : 'rgba(255,255,255,0.3)' }}>
            {daysUntil <= 0 ? 'Overdue' : `Due in ${daysUntil}d`}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Transaction preview row ───────────────────────────────────────────────────

function TxPreviewRow({ tx }: { tx: TreasuryAnalysis['transactions'][0] }) {
  const color = CAT_COLORS[tx.category] ?? '#374151';
  const label = CAT_LABELS[tx.category] ?? tx.category;
  const isOut = tx.isOutgoing;

  return (
    <div className="flex items-center gap-3 py-2 px-1">
      <div className="shrink-0">
        {isOut
          ? <ArrowUpRight className="w-3.5 h-3.5" style={{ color }} />
          : <ArrowDownLeft className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {tx.description ?? label}
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>
          {fmtAddr(tx.counterparty)} · {fmtDate(tx.blockTime)}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        <span className="text-[12px] font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>
          {tx.amountUsd ? fmtUsd(tx.amountUsd) : tx.amountSol ? `${tx.amountSol.toFixed(3)} SOL` : '—'}
        </span>
        <span
          className="text-[9px] px-1.5 py-px rounded font-medium"
          style={{ background: `${color}18`, color, borderRadius: '4px' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Gated CTA ─────────────────────────────────────────────────────────────────

function GatedCTA({ wallet, onLogin }: { wallet: string; onLogin: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(157,92,255,0.12) 0%, rgba(45,212,191,0.08) 100%)',
        border: '1px solid rgba(157,92,255,0.22)',
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-32 rounded-2xl"
          style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(157,92,255,0.15), transparent 60%)' }}
        />
      </div>

      <div className="relative">
        <div
          className="mx-auto mb-4 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)' }}
        >
          <Zap className="w-5 h-5" style={{ color: 'var(--teal)' }} />
        </div>

        <h3
          className="text-[16px] font-semibold mb-2"
          style={{ fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.03em' }}
        >
          Want ACE to automate this for you?
        </h3>
        <p className="text-[12px] leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Connect your wallet and let the AI agent handle recurring payments, earn yield on idle assets,
          and keep your treasury healthy — automatically.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: 'var(--teal)', color: '#0a0700' }}
          >
            <Zap className="w-3.5 h-3.5" />
            Connect & automate
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <a
            href={`/treasury?wallet=${wallet}`}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium transition-all"
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            Full analysis
            <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Feature tags */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {[
            { icon: ShieldCheck, text: 'Reserve-aware execution' },
            { icon: Lock, text: 'Policy enforced' },
            { icon: Sparkles, text: 'AI insights' },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px]"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Icon className="w-3 h-3" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main WalletScanner ────────────────────────────────────────────────────────

interface WalletScannerProps {
  onLogin: () => void;
  compact?: boolean; // for embedding in hero vs standalone
}

type ScanPhase = 'idle' | 'ingesting' | 'analyzing' | 'done' | 'error';

export function WalletScanner({ onLogin, compact = false }: WalletScannerProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<TreasuryAnalysis | null>(null);
  const [scannedWallet, setScannedWallet] = useState('');

  const isValid = isValidSolanaAddress(input);

  const runScan = useCallback(async () => {
    const wallet = input.trim();
    if (!isValidSolanaAddress(wallet)) return;

    setError('');
    setAnalysis(null);
    setScannedWallet(wallet);
    setPhase('ingesting');

    try {
      // Step 1: Ingest
      const ingestRes = await fetch('/api/public/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, range: '90d' }),
      });
      if (!ingestRes.ok) {
        const body = await ingestRes.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to fetch wallet data');
      }

      // Step 2: Analyze
      setPhase('analyzing');
      const analysisRes = await fetch(`/api/public/analyze?wallet=${encodeURIComponent(wallet)}&range=90d`);
      if (!analysisRes.ok) {
        const body = await analysisRes.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to analyze wallet');
      }

      const data = await analysisRes.json() as TreasuryAnalysis;
      setAnalysis(data);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setPhase('error');
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid && phase === 'idle') void runScan();
  };

  const reset = () => {
    setPhase('idle');
    setError('');
    setAnalysis(null);
    setInput('');
  };

  // ── Top spend categories ──
  const topCategories = analysis
    ? Object.entries(analysis.spendByCategory)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 4)
    : [];

  const totalSpend = topCategories.reduce((s, [, v]) => s + v, 0);

  return (
    <div className={compact ? 'w-full' : 'w-full max-w-2xl mx-auto'}>

      {/* ── Input bar ── */}
      <div
        className="relative flex items-center gap-2 rounded-2xl p-1.5"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${phase === 'done' ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.10)'}`,
          transition: 'border-color 0.2s ease',
        }}
      >
        <div className="flex items-center gap-2 flex-1 px-3">
          {phase === 'ingesting' || phase === 'analyzing'
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--teal)' }} />
            : <Search className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
          }
          <input
            value={input}
            onChange={e => { setInput(e.target.value); if (phase !== 'idle') reset(); }}
            onKeyDown={handleKeyDown}
            placeholder="Paste any Solana wallet address…"
            disabled={phase === 'ingesting' || phase === 'analyzing'}
            className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-[rgba(255,255,255,0.22)] disabled:opacity-60"
            style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        <button
          onClick={() => void runScan()}
          disabled={!isValid || phase === 'ingesting' || phase === 'analyzing'}
          className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5"
          style={{ background: 'var(--teal)', color: '#0a0700' }}
        >
          {phase === 'ingesting'
            ? 'Fetching…'
            : phase === 'analyzing'
            ? 'Analyzing…'
            : 'Analyze'
          }
          {phase !== 'ingesting' && phase !== 'analyzing' && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── Loading state ── */}
      <AnimatePresence>
        {(phase === 'ingesting' || phase === 'analyzing') && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-4 flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.14)' }}
          >
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--teal)' }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <p className="text-[12px]" style={{ color: 'rgba(45,212,191,0.8)' }}>
              {phase === 'ingesting'
                ? `Reading on-chain history for ${fmtAddr(scannedWallet)}…`
                : 'Running AI treasury analysis…'
              }
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      <AnimatePresence>
        {phase === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-[12px]"
            style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.18)', color: '#f43f5e' }}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ── */}
      <AnimatePresence>
        {phase === 'done' && analysis && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 space-y-4"
          >
            {/* Wallet header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
                <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {scannedWallet.slice(0, 10)}…{scannedWallet.slice(-6)}
                </span>
                <span
                  className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  {analysis.transactionCount} txns · 90D
                </span>
              </div>
              <button
                onClick={reset}
                className="text-[10px] transition-colors"
                style={{ color: 'rgba(255,255,255,0.3)' }}
                onMouseEnter={e => { (e.currentTarget).style.color = 'rgba(255,255,255,0.6)'; }}
                onMouseLeave={e => { (e.currentTarget).style.color = 'rgba(255,255,255,0.3)'; }}
              >
                Scan different wallet
              </button>
            </div>

            {/* KPI row */}
            {analysis.transactionCount > 0 && analysis.monthlyBurnUsd === 0 && analysis.recurringPatterns.length === 0 && totalSpend === 0 ? (
              /* Transactions found but zero USD amounts — likely a mint/program address or no priced tokens */
              <div
                className="rounded-xl p-5"
                style={{ background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.18)' }}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--teal)' }} />
                  <div>
                    <p className="text-[13px] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      This looks like a program or mint address
                    </p>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {analysis.transactionCount} transactions were found, but no outflows could be attributed to a personal wallet.
                      This address may be a token mint, protocol contract, or treasury multisig.
                      Try pasting your own wallet address (the one you sign transactions from) for a personal treasury analysis.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['Your personal Solana wallet', 'DAO treasury wallet', 'Team hot wallet'].map(ex => (
                    <span
                      key={ex}
                      className="text-[10px] px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      Try: {ex}
                    </span>
                  ))}
                </div>
              </div>
            ) : analysis.transactionCount > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <MetricTile
                    icon={TrendingDown}
                    label="Monthly Burn"
                    value={fmtUsd(analysis.monthlyBurnUsd)}
                    sub="Normalized from 90D"
                    accent="#f43f5e"
                  />
                  <MetricTile
                    icon={Repeat2}
                    label="Recurring"
                    value={`${analysis.recurringPatterns.length}`}
                    sub="Detected obligations"
                    accent="var(--teal)"
                  />
                  <MetricTile
                    icon={Clock}
                    label="Runway"
                    value={analysis.runwayDays ? `${Math.round(analysis.runwayDays)}d` : '—'}
                    sub="At current burn rate"
                    accent="#22c55e"
                  />
                  <MetricTile
                    icon={ShieldCheck}
                    label="Reserve Score"
                    value={`${Math.round(analysis.reserveHealthScore)}/100`}
                    sub="Based on obligations"
                    accent="#3b82f6"
                  />
                </div>

                {/* Spend by category */}
                {topCategories.length > 0 && (
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Spend by Category
                      </p>
                      <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {fmtUsd(totalSpend)} total
                      </span>
                    </div>
                    <div className="space-y-2">
                      {topCategories.map(([cat, val]) => {
                        const color = CAT_COLORS[cat] ?? '#374151';
                        const pct = totalSpend > 0 ? (val / totalSpend) * 100 : 0;
                        return (
                          <div key={cat} className="flex items-center gap-2.5">
                            <div className="w-16 shrink-0">
                              <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                {CAT_LABELS[cat] ?? cat}
                              </p>
                            </div>
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: color }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                              />
                            </div>
                            <span className="text-[10px] tabular-nums shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', width: '3rem', textAlign: 'right' }}>
                              {fmtUsd(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upcoming bills */}
                {analysis.recurringPatterns.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <BarChart3 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Detected Recurring Obligations
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {analysis.recurringPatterns.slice(0, 4).map(p => (
                        <BillRow key={p.id} pattern={p} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent transactions */}
                {analysis.transactions.length > 0 && (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Recent Activity
                      </p>
                      <a
                        href={`/treasury?wallet=${scannedWallet}`}
                        className="text-[10px] flex items-center gap-1 transition-colors"
                        style={{ color: 'rgba(45,212,191,0.6)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--teal)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(45,212,191,0.6)'; }}
                      >
                        See full history <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="px-3 divide-y divide-white/[0.04]">
                      {analysis.transactions.slice(0, 5).map(tx => (
                        <TxPreviewRow key={tx.id} tx={tx} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* No transactions found */
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <p className="text-[13px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  No meaningful activity found in 90 days
                </p>
                <p className="text-[11px] leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  This wallet may be new or inactive. Try connecting a wallet with more history for treasury analysis.
                </p>
              </div>
            )}

            {/* Gated CTA */}
            <GatedCTA wallet={scannedWallet} onLogin={onLogin} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper text */}
      {phase === 'idle' && (
        <p className="mt-2.5 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
          No login required · read-only Mainnet analysis · paste any Solana address
        </p>
      )}
    </div>
  );
}
