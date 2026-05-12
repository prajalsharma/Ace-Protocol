'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, RefreshCw, Loader2, AlertTriangle,
  TrendingDown, Repeat2, ShieldCheck, Cpu,
  Tag, ChevronRight, ExternalLink, Sparkles,
  BarChart3, ArrowDownLeft, ArrowUpRight,
  Clock, Check, Info, Search, Zap, Lock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { useTreasury, RANGE_OPTIONS } from '@/components/treasury/useTreasury';
import type { TreasuryRange } from '@/components/treasury/useTreasury';
import { TagModal } from '@/components/treasury/TagModal';
import type { MainnetTransaction, RecurringPattern, TreasuryAnalysis } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell, CartesianGrid, AreaChart, Area,
} from 'recharts';

// ── Formatters ─────────────────────────────────────────────────────────────────

function fmtUsd(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(2)}`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateShort(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtAddr(addr?: string) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  payroll:            '#f4a622',
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

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.045 } } },
  item: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } },
  },
};

// ── Timeline aggregation ───────────────────────────────────────────────────────

function buildTimeline(txs: MainnetTransaction[], range: TreasuryRange) {
  if (!txs.length) return [];
  const now = Math.floor(Date.now() / 1000);

  let bucketDays: number, numBuckets: number;
  if (range === '30d')       { bucketDays = 1;  numBuckets = 30; }
  else if (range === '90d')  { bucketDays = 7;  numBuckets = 13; }
  else if (range === '180d') { bucketDays = 14; numBuckets = 13; }
  else if (range === '1y')   { bucketDays = 30; numBuckets = 12; }
  else {
    const oldest = txs[txs.length - 1]?.blockTime ?? now - 86400 * 30;
    const spanDays = Math.max(1, (now - oldest) / 86400);
    bucketDays = Math.max(1, Math.ceil(spanDays / 20));
    numBuckets = Math.ceil(spanDays / bucketDays);
  }

  const buckets = Array.from({ length: numBuckets }, (_, i) => {
    const t = now - (numBuckets - i) * bucketDays * 86400;
    return {
      label: new Date(t * 1000).toLocaleDateString('en-US', {
        month: 'short', day: bucketDays <= 1 ? 'numeric' : undefined,
      }),
      spend: 0,
    };
  });

  for (const tx of txs) {
    const age = now - tx.blockTime;
    const idx = numBuckets - 1 - Math.floor(age / (bucketDays * 86400));
    if (idx >= 0 && idx < numBuckets && tx.amountUsd) {
      buckets[idx].spend += tx.amountUsd;
    }
  }
  return buckets;
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-1.5 h-1.5 rounded-full skeleton shrink-0" style={{ width: 6, height: 6 }} />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-2.5 rounded w-3/5" />
        <div className="skeleton h-2 rounded w-2/5" />
      </div>
      <div className="skeleton h-3 rounded w-14" />
    </div>
  );
}

// ── Range selector ─────────────────────────────────────────────────────────────

function RangeSelector({
  value, onChange, disabled,
}: { value: TreasuryRange; onChange: (r: TreasuryRange) => void; disabled?: boolean }) {
  return (
    <div
      className="flex items-center gap-px p-1 rounded-xl"
      style={{ border: '1px solid var(--border-base)', background: 'var(--bg-overlay)' }}
    >
      {RANGE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          title={opt.label}
          className="relative px-3.5 py-2 rounded-lg text-[12.5px] font-semibold transition-all duration-150 disabled:cursor-not-allowed select-none"
          style={{
            color: value === opt.value ? 'var(--text-primary)' : 'var(--text-tertiary)',
            borderRadius: '8px',
          }}
        >
          {value === opt.value && (
            <motion.span
              layoutId="range-bg"
              className="absolute inset-0 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-hi)' }}
              transition={{ type: 'spring', stiffness: 480, damping: 36 }}
            />
          )}
          <span className="relative z-10">{opt.short}</span>
        </button>
      ))}
    </div>
  );
}

// ── KPI stat ───────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent = 'var(--amber)', icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  return (
    <div className="card-base p-6 flex flex-col gap-5" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="pointer-events-none absolute inset-0 rounded-[var(--r-xl)]"
        style={{ background: `radial-gradient(ellipse at 80% -20%, color-mix(in srgb, ${accent} 8%, transparent) 0%, transparent 60%)` }} />
      <div className="flex items-center justify-between relative">
        <span className="label-metric">{label}</span>
        <div
          className="w-9 h-9 flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${accent} 13%, transparent)`, borderRadius: '10px', border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: accent, width: 18, height: 18 }} />
        </div>
      </div>
      <div className="relative">
        <p className="value-md" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && <p className="text-[12.5px] mt-2.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Insight card ───────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: TreasuryAnalysis['insights'][0] }) {
  const palette: Record<string, string> = {
    summary: 'var(--violet-bright)',
    recurring: 'var(--teal)',
    reserve: 'var(--red)',
    forecast: 'var(--green)',
    risk: '#f97316',
    idle_capital: 'var(--blue)',
  };
  const color = palette[insight.type] ?? 'var(--blue)';
  const conf = Math.round(insight.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="p-5 rounded-[14px] transition-all"
      style={{ border: '1px solid var(--border-lo)', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.012)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-lo)';
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[14px]"
        style={{ background: `radial-gradient(ellipse at 0% 0%, color-mix(in srgb, ${color} 6%, transparent) 0%, transparent 60%)` }} />
      <div className="flex items-start gap-4 relative">
        <div
          className="w-9 h-9 shrink-0 flex items-center justify-center mt-0.5"
          style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, borderRadius: '10px', border: `1px solid color-mix(in srgb, ${color} 22%, transparent)` }}
        >
          <Sparkles className="w-4 h-4" style={{ color, width: 16, height: 16 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em]" style={{ color: 'var(--text-primary)' }}>
              {insight.title}
            </p>
            {/* Animated confidence bar */}
            <div className="shrink-0 flex flex-col items-end gap-1">
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color }}
              >
                {conf}%
              </span>
              <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${conf}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: color }}
                />
              </div>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {insight.body}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{insight.model}</span>
            <span className="text-[11px]" style={{ color: 'var(--border-hi)' }}>·</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtDateShort(insight.generatedAt)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Transaction row ────────────────────────────────────────────────────────────

function TxRow({ tx, onTag }: { tx: MainnetTransaction; onTag: (t: MainnetTransaction) => void }) {
  const color = CAT_COLORS[tx.category] ?? '#374151';
  const label = CAT_LABELS[tx.category] ?? tx.category;
  const isOut = tx.amountUsd !== undefined && tx.amountUsd > 0;

  return (
    <div className="ledger-row group">
      {/* Direction indicator */}
      <div className="mr-3 shrink-0">
        {isOut
          ? <ArrowUpRight className="w-3 h-3" style={{ color }} />
          : <ArrowDownLeft className="w-3 h-3" style={{ color: 'var(--green)' }} />
        }
      </div>

      {/* Description + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium truncate leading-snug"
          style={{ color: 'var(--text-primary)' }}
        >
          {tx.description ?? label}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px]"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {fmtAddr(tx.counterparty)}
          </span>
          <span className="text-[12px]" style={{ color: 'var(--border-base)' }}>·</span>
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{fmtDateShort(tx.blockTime)}</span>
        </div>
      </div>

      {/* Amount + category + actions */}
      <div className="flex items-center gap-2.5 shrink-0 ml-2">
        <span className="text-[14px] font-semibold tabular-nums"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {tx.amountUsd
            ? fmtUsd(tx.amountUsd)
            : tx.amountSol
            ? `${tx.amountSol.toFixed(4)} SOL`
            : '—'
          }
        </span>
        <span
          className="text-[11px] px-2.5 py-1 rounded-md font-medium"
          style={{ background: `${color}14`, color, borderRadius: '6px' }}
        >
          {label}
        </span>
        {tx.category === 'unknown' && (
          <button
            onClick={() => onTag(tx)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
            title="Classify transaction"
          >
            <Tag className="w-3 h-3" style={{ color: 'rgba(45,212,191,0.6)' }} />
          </button>
        )}
        <a
          href={`https://solscan.io/tx/${tx.signature}`}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
        >
          <ExternalLink className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
        </a>
      </div>
    </div>
  );
}

// ── Recurring row ──────────────────────────────────────────────────────────────

function RecurringRow({ pattern, onTag }: { pattern: RecurringPattern; onTag: (p: RecurringPattern) => void }) {
  const color = CAT_COLORS[pattern.category] ?? '#374151';
  const daysUntil = pattern.nextPredicted
    ? Math.round((pattern.nextPredicted - Date.now() / 1000) / 86400)
    : null;
  const isDue = daysUntil !== null && daysUntil <= 7;

  return (
    <div className="ledger-row group">
      <div
        className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mr-3"
        style={{ background: `${color}12`, borderRadius: '6px' }}
      >
        <Repeat2 className="w-3 h-3" style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-medium truncate tracking-[-0.01em]" style={{ color: 'var(--text-primary)' }}>
          {pattern.label ?? fmtAddr(pattern.counterpartyAddress)}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Every {pattern.frequencyDays.toFixed(0)}d
          </span>
          <span style={{ color: 'var(--border-base)' }}>·</span>
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            {pattern.sampleCount} occurrences
          </span>
          {!pattern.isConfirmed && (
            <>
              <span style={{ color: 'var(--border-base)' }}>·</span>
              <span className="text-[11px] font-medium" style={{ color: 'rgba(45,212,191,0.75)' }}>
                Needs review
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <p className="text-[14px] font-semibold tabular-nums"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {fmtUsd(pattern.avgAmountUsd)}
          </p>
          {daysUntil !== null && (
            <p className="text-[11px] mt-0.5 font-medium"
              style={{ color: isDue ? 'var(--red)' : 'var(--text-muted)' }}
            >
              {daysUntil <= 0 ? 'Overdue' : `Due in ${daysUntil}d`}
            </p>
          )}
        </div>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded tabular-nums"
          style={{
            background: `${color}12`, color, borderRadius: '5px',
          }}
        >
          {Math.round(pattern.confidence * 100)}%
        </span>
        {!pattern.isConfirmed && (
          <button
            onClick={() => onTag(pattern)}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded text-[10px]"
            style={{
              border: '1px solid rgba(45,212,191,0.20)',
              background: 'rgba(45,212,191,0.05)',
              color: 'rgba(45,212,191,0.8)',
              borderRadius: '5px',
            }}
          >
            <Tag className="w-2.5 h-2.5" />
            Classify
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({
  title, body, cta, onCta,
}: { title: string; body: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div
        className="w-8 h-8 flex items-center justify-center mb-3"
        style={{ border: '1px solid var(--border-base)', background: 'var(--bg-overlay)', borderRadius: '8px' }}
      >
        <Info className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="text-[12px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{title}</p>
      <p className="text-[11px] max-w-xs leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>{body}</p>
      {cta && onCta && (
        <button
          onClick={onCta}
          className="text-[10px] underline underline-offset-2 transition-colors"
          style={{ color: 'rgba(45,212,191,0.7)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--teal)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(45,212,191,0.7)'; }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

// ── Tooltip ────────────────────────────────────────────────────────────────────

const ChartTooltipStyle = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--border-base)',
  borderRadius: 8,
  fontSize: 11,
  color: 'var(--text-primary)',
};

// ── Public wallet scanner mode ────────────────────────────────────────────────

function PublicWalletMode({ urlWallet }: { urlWallet: string }) {
  const router = useRouter();
  const [input, setInput] = useState(urlWallet);
  const [phase, setPhase] = useState<'idle' | 'ingesting' | 'analyzing' | 'done' | 'error'>(
    urlWallet ? 'ingesting' : 'idle',
  );
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<TreasuryAnalysis | null>(null);
  const [scanned, setScanned] = useState(urlWallet);
  const [pubRange, setPubRange] = useState<TreasuryRange>('90d');

  const isValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input.trim());

  const runScan = useCallback(async (wallet: string, range: TreasuryRange) => {
    if (!wallet) return;
    setError('');
    setAnalysis(null);
    setScanned(wallet);
    setPhase('ingesting');

    try {
      const ingestRes = await fetch('/api/public/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, range }),
      });
      if (!ingestRes.ok) {
        const b = await ingestRes.json() as { error?: string };
        throw new Error(b.error ?? 'Failed to fetch wallet data');
      }
      setPhase('analyzing');
      const res = await fetch(`/api/public/analyze?wallet=${encodeURIComponent(wallet)}&range=${range}`);
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? 'Analysis failed');
      }
      const data = await res.json() as TreasuryAnalysis;
      setAnalysis(data);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setPhase('error');
    }
  }, []);

  // Auto-run if URL has wallet
  useEffect(() => {
    if (urlWallet && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(urlWallet)) {
      void runScan(urlWallet, pubRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRangeChange = (r: TreasuryRange) => {
    setPubRange(r);
    if (scanned) void runScan(scanned, r);
  };

  const isLoading = phase === 'ingesting' || phase === 'analyzing';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-[26px] font-bold tracking-[-0.04em]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
              Treasury Intelligence
            </h1>
            <Badge variant="muted">Public</Badge>
          </div>
          <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>
            Analyze any Solana wallet — no login required
          </p>
        </div>
      </div>

      {/* Wallet input */}
      <div
        className="flex items-center gap-2 p-1.5 rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-base)' }}
      >
        <div className="flex items-center gap-2 flex-1 px-3">
          {isLoading
            ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" style={{ color: 'var(--teal)' }} />
            : <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          }
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && isValid && !isLoading) void runScan(input.trim(), pubRange); }}
            placeholder="Paste a Solana wallet address…"
            disabled={isLoading}
            className="flex-1 bg-transparent outline-none text-[13px] disabled:opacity-60"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
            spellCheck={false}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RangeSelector value={pubRange} onChange={handleRangeChange} disabled={isLoading} />
          <button
            onClick={() => isValid && !isLoading && void runScan(input.trim(), pubRange)}
            disabled={!isValid || isLoading}
            className="btn-primary disabled:opacity-40"
            style={{ fontSize: '12px', padding: '7px 14px' }}
          >
            {isLoading ? (phase === 'ingesting' ? 'Fetching…' : 'Analyzing…') : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[12px]"
          style={{ background: 'var(--teal-dim)', border: '1px solid rgba(45,212,191,0.18)' }}
        >
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--teal)' }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
          <span style={{ color: 'var(--teal-bright)' }}>
            {phase === 'ingesting'
              ? `Reading on-chain history for ${fmtAddr(scanned)}…`
              : 'Running AI treasury analysis…'
            }
          </span>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-[12px]"
          style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.18)', color: 'var(--red)' }}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Results — reuse existing analysis display when done */}
      {phase === 'done' && analysis && (
        <PublicAnalysisResults
          analysis={analysis}
          wallet={scanned}
          range={pubRange}
          onRangeChange={handleRangeChange}
          onConnectWallet={() => router.push('/')}
        />
      )}

      {/* Idle prompt */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div
            className="w-14 h-14 flex items-center justify-center"
            style={{ borderRadius: '16px', border: '1px solid var(--border-base)', background: 'var(--bg-card)' }}
          >
            <Search className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div>
            <p className="text-[15px] font-semibold mb-1.5 font-display" style={{ color: 'var(--text-primary)' }}>
              Analyze any Solana treasury
            </p>
            <p className="text-[12px] max-w-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              Paste a wallet address above. We&apos;ll fetch real Mainnet history and surface spending patterns, recurring obligations, and reserve health.
            </p>
          </div>
          <div
            className="mt-4 px-5 py-3 rounded-xl text-[12px] leading-relaxed max-w-sm text-center"
            style={{ background: 'var(--teal-dim)', border: '1px solid rgba(45,212,191,0.14)', color: 'var(--teal-bright)' }}
          >
            <Zap className="w-3 h-3 inline mr-1.5" style={{ color: 'var(--teal)' }} />
            Connect your wallet for personalized automation, yield on idle assets, and AI-driven payment execution.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Public analysis results ────────────────────────────────────────────────────

function PublicAnalysisResults({
  analysis, wallet, range, onRangeChange, onConnectWallet,
}: {
  analysis: TreasuryAnalysis;
  wallet: string;
  range: TreasuryRange;
  onRangeChange: (r: TreasuryRange) => void;
  onConnectWallet: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'recurring' | 'insights'>('transactions');
  const rangeLabel = RANGE_OPTIONS.find(o => o.value === range)?.label ?? 'Last 90 Days';

  const chartData = Object.entries(analysis.spendByCategory)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([cat, val]) => ({ name: CAT_LABELS[cat] ?? cat, value: val, color: CAT_COLORS[cat] ?? '#374151' }));

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* Wallet badge */}
      <motion.div variants={stagger.item}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--green)', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            <span className="text-[12px] font-mono" style={{ color: 'var(--text-muted)' }}>
              {wallet.slice(0, 10)}…{wallet.slice(-6)}
            </span>
            <Badge variant="muted">{analysis.transactionCount} txns</Badge>
            <Badge variant="muted">{rangeLabel}</Badge>
          </div>
          <RangeSelector value={range} onChange={onRangeChange} />
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div variants={stagger.item}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Monthly Burn" value={fmtUsd(analysis.monthlyBurnUsd)}
            sub={`${rangeLabel} normalized`} accent="var(--red)" icon={TrendingDown} />
          <KpiCard label="Recurring Flows" value={`${analysis.recurringPatterns.length}`}
            sub={`${analysis.untaggedCount} unclassified`} accent="var(--teal)" icon={Repeat2} />
          <KpiCard label="Forecast Runway" value={analysis.runwayDays ? `${Math.round(analysis.runwayDays)}d` : '—'}
            sub="At current burn rate" accent="var(--green)" icon={Clock} />
          <KpiCard label="Reserve Score" value={`${Math.round(analysis.reserveHealthScore)}/100`}
            sub="Based on obligations" accent="var(--blue)" icon={ShieldCheck} />
        </div>
      </motion.div>

      {/* Main grid */}
      <motion.div variants={stagger.item}>
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Ledger */}
          <div className="lg:col-span-2">
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center px-1 pt-1" style={{ borderBottom: '1px solid var(--border-base)' }}>
                {([
                  { id: 'transactions', label: 'Transactions', count: analysis.transactions.length },
                  { id: 'recurring',    label: 'Recurring',    count: analysis.recurringPatterns.length },
                  { id: 'insights',     label: 'AI Insights',  count: analysis.insights.length },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="relative flex items-center gap-1.5 px-4 py-3 text-[11px] font-medium transition-colors"
                    style={{ color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                  >
                    {activeTab === tab.id && (
                      <motion.div layoutId="pub-tab" className="absolute bottom-0 left-0 right-0 h-px"
                        style={{ background: 'var(--teal)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="text-[9px] px-1.5 py-px rounded font-semibold tabular-nums"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', borderRadius: '4px' }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                <AnimatePresence mode="wait">
                  {activeTab === 'transactions' && (
                    <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {analysis.transactions.length === 0
                        ? <EmptyState title={`No transactions in ${rangeLabel.toLowerCase()}`}
                            body="Try expanding the range to surface older activity." />
                        : analysis.transactions.map(tx => <TxRow key={tx.id} tx={tx} onTag={() => {}} />)
                      }
                    </motion.div>
                  )}
                  {activeTab === 'recurring' && (
                    <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                      {analysis.recurringPatterns.length === 0
                        ? <EmptyState title="No recurring patterns detected"
                            body="We need more history. Try 180D or 1Y for better detection." />
                        : analysis.recurringPatterns.map(p => <RecurringRow key={p.id} pattern={p} onTag={() => {}} />)
                      }
                    </motion.div>
                  )}
                  {activeTab === 'insights' && (
                    <motion.div key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                      className="p-3 space-y-2"
                    >
                      {analysis.insights.length === 0
                        ? <EmptyState title="No insights yet" body="Connect your wallet to generate AI-powered treasury insights." />
                        : analysis.insights.map(i => <InsightCard key={i.id} insight={i} />)
                      }
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Category chart */}
            <div className="card-base p-6">
              <h3 className="label-metric mb-5">Spend by Category</h3>
              {chartData.length === 0 ? (
                <p className="text-[12px] py-6 text-center" style={{ color: 'var(--text-muted)' }}>No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={90}
                      tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickLine={false} axisLine={false} />
                    <RechartTooltip formatter={(v: unknown) => [fmtUsd(Number(v ?? 0)), 'Spend']}
                      contentStyle={ChartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} opacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Gated CTA */}
            <div
              className="card-insight p-5 text-center space-y-3"
            >
              <div className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center"
                style={{ background: 'var(--violet-dim)', border: '1px solid rgba(168,85,247,0.22)' }}
              >
                <Zap className="w-5 h-5" style={{ color: 'var(--violet-bright)' }} />
              </div>
              <div>
                <p className="text-[13px] font-semibold mb-1 font-display" style={{ color: 'var(--text-primary)' }}>
                  Automate this treasury
                </p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                  Connect your wallet and let ACE handle recurring payments, earn yield on idle assets, and keep reserves healthy — automatically.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={onConnectWallet}
                  className="btn-primary w-full justify-center"
                  style={{ fontSize: '12px' }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Connect & automate
                </button>
                {[
                  { icon: ShieldCheck, text: 'Reserve-aware execution' },
                  { icon: Lock, text: 'Policy enforced · no custody' },
                  { icon: Sparkles, text: 'AI-driven insights' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Icon className="w-3 h-3 shrink-0" style={{ color: 'var(--teal)', opacity: 0.6 }} />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function TreasuryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlRange = (searchParams.get('range') ?? '30d') as TreasuryRange;
  const validRange = RANGE_OPTIONS.some(o => o.value === urlRange) ? urlRange : '30d';

  const { sessionToken, walletAddress, isWalletConnected } = useApp();
  const {
    analysis, isIngesting, isAnalyzing, isGeneratingInsights,
    error, ingestResult, range, changeRange, runFullAnalysis, generateInsights, submitTag,
  } = useTreasury(sessionToken, validRange);

  const [tagTarget, setTagTarget] = useState<MainnetTransaction | RecurringPattern | null>(null);
  const [activeTab, setActiveTab] = useState<'transactions' | 'recurring' | 'insights'>('transactions');

  useEffect(() => {
    if (isWalletConnected && sessionToken && !analysis) {
      void runFullAnalysis(validRange);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, sessionToken]);

  const handleRangeChange = useCallback((newRange: TreasuryRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', newRange);
    router.replace(`?${params.toString()}`, { scroll: false });
    void changeRange(newRange);
  }, [router, searchParams, changeRange]);

  const isLoading = isIngesting || isAnalyzing;
  const rangeLabel = RANGE_OPTIONS.find(o => o.value === range)?.label ?? 'Last 30 Days';

  const chartData = analysis
    ? Object.entries(analysis.spendByCategory)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([cat, val]) => ({ name: CAT_LABELS[cat] ?? cat, value: val, color: CAT_COLORS[cat] ?? '#374151' }))
    : [];

  const timelineData = analysis ? buildTimeline(analysis.transactions, range) : [];
  const hasTimelineData = timelineData.some(d => d.spend > 0);
  const untagged = analysis?.recurringPatterns.filter(p => !p.isConfirmed && p.confidence >= 0.4) ?? [];

  // ── Not connected — public wallet scanner mode ────────────────────────────────

  if (!isWalletConnected) {
    return (
      <AppShell>
        <PublicWalletMode urlWallet={searchParams.get('wallet') ?? ''} />
      </AppShell>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-5"
      >

        {/* ── Page header ── */}
        <motion.div variants={stagger.item}>
          <div className="flex items-center justify-between gap-4 flex-wrap">

            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-[26px] font-bold tracking-[-0.04em]"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
                >
                  Treasury Intelligence
                </h1>
                <Badge variant="success" dot>Live</Badge>
                <Badge variant="muted">Mainnet</Badge>
              </div>
              <p className="text-[13.5px] mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {walletAddress
                  ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-4)}`
                  : ''
                }
                {analysis && !isLoading && (
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {' '}· {analysis.transactionCount} transactions · {rangeLabel}
                  </span>
                )}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <RangeSelector value={range} onChange={handleRangeChange} disabled={isLoading} />

              {analysis && (
                <button
                  onClick={() => void generateInsights()}
                  disabled={isGeneratingInsights}
                  className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
                  style={{ fontSize: '11px', padding: '6px 12px' }}
                >
                  {isGeneratingInsights
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />
                  }
                  AI Insights
                </button>
              )}

              <button
                onClick={() => void runFullAnalysis()}
                disabled={isLoading}
                className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                {isLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />
                }
                {isIngesting ? 'Fetching…' : isAnalyzing ? 'Analyzing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Status bar ── */}
        <motion.div variants={stagger.item}>
          <div
            className="flex items-center gap-4 px-4 py-2.5 rounded-lg"
            style={{ border: '1px solid var(--border-base)', background: 'var(--bg-overlay)' }}
          >
            <div className="flex items-center gap-1.5 text-[10px]">
              <Cpu className="w-3 h-3" style={{ color: 'rgba(45,212,191,0.5)' }} />
              <span style={{ color: 'var(--text-muted)' }}>QVAC</span>
              <Badge variant="local">Local AI</Badge>
            </div>
            <div className="w-px h-3" style={{ background: 'var(--border-base)' }} />
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="status-live" style={{ width: 5, height: 5 }} />
              <span style={{ color: 'var(--text-muted)' }}>Mainnet analysis</span>
              <span style={{ color: 'var(--border-base)' }}>·</span>
              <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Devnet execution</span>
            </div>
            {isLoading && (
              <>
                <div className="w-px h-3" style={{ background: 'var(--border-base)' }} />
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {isIngesting
                    ? `Fetching ${rangeLabel.toLowerCase()}…`
                    : 'Running analysis…'
                  }
                </span>
              </>
            )}
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div variants={stagger.item}>
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-[11px]"
              style={{ border: '1px solid rgba(244,63,94,0.18)', background: 'rgba(244,63,94,0.05)', color: 'var(--red)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          </motion.div>
        )}

        {/* Ingest result */}
        {ingestResult && !ingestResult.cached && (
          <motion.div variants={stagger.item}>
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px]"
              style={{ border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.04)' }}
            >
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--green)' }} />
              <span style={{ color: 'rgba(34,197,94,0.8)' }}>
                Ingested{' '}
                <strong style={{ color: 'var(--green)' }}>{ingestResult.ingested}</strong> transactions ·{' '}
                <strong style={{ color: 'var(--green)' }}>{ingestResult.meaningful}</strong> meaningful ·{' '}
                {ingestResult.filtered} noise-filtered
              </span>
            </div>
          </motion.div>
        )}

        {/* Loading skeleton */}
        {isLoading && !analysis && (
          <motion.div variants={stagger.item}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton rounded-xl h-24" />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Needs-tagging prompt ── */}
        {untagged.length > 0 && (
          <motion.div variants={stagger.item}>
            <div
              className="rounded-xl p-4"
              style={{ border: '1px solid rgba(45,212,191,0.18)', background: 'rgba(45,212,191,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-3.5 h-3.5" style={{ color: 'rgba(45,212,191,0.7)' }} />
                <span className="text-[11px] font-semibold" style={{ color: 'rgba(45,212,191,0.8)' }}>
                  {untagged.length} payment pattern{untagged.length > 1 ? 's' : ''} need classification
                </span>
                <span className="text-[10px]" style={{ color: 'rgba(45,212,191,0.4)' }}>
                  — improves forecast accuracy
                </span>
              </div>
              <div className="space-y-1.5">
                {untagged.slice(0, 3).map(p => (
                  <button
                    key={p.id}
                    onClick={() => setTagTarget(p)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-all text-left"
                    style={{
                      border: '1px solid rgba(45,212,191,0.10)',
                      background: 'rgba(45,212,191,0.03)',
                      borderRadius: '6px',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(45,212,191,0.25)'; (e.currentTarget as HTMLElement).style.background = 'rgba(45,212,191,0.06)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(45,212,191,0.10)'; (e.currentTarget as HTMLElement).style.background = 'rgba(45,212,191,0.03)'; }}
                  >
                    <div className="flex items-center gap-2">
                      <Repeat2 className="w-3 h-3" style={{ color: 'rgba(45,212,191,0.5)' }} />
                      <span className="text-[11px]" style={{ color: 'rgba(220,220,240,0.6)' }}>
                        {fmtAddr(p.counterpartyAddress)} · avg {fmtUsd(p.avgAmountUsd)} every {p.frequencyDays.toFixed(0)}d
                      </span>
                    </div>
                    <span className="text-[10px] flex items-center gap-1" style={{ color: 'rgba(45,212,191,0.6)' }}>
                      Classify <ChevronRight className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Main dashboard ── */}
        {analysis && (
          <>
            {/* KPI row */}
            <motion.div variants={stagger.item}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  label="Monthly Burn"
                  value={fmtUsd(analysis.monthlyBurnUsd)}
                  sub={range === '30d' ? 'Last 30 days' : `${rangeLabel} normalized`}
                  accent="var(--red)"
                  icon={TrendingDown}
                />
                <KpiCard
                  label="Recurring Flows"
                  value={`${analysis.recurringPatterns.length}`}
                  sub={`${analysis.untaggedCount} unclassified`}
                  accent="var(--teal)"
                  icon={Repeat2}
                />
                <KpiCard
                  label="Forecast Runway"
                  value={analysis.runwayDays ? `${Math.round(analysis.runwayDays)}d` : '—'}
                  sub="At current burn rate"
                  accent="var(--green)"
                  icon={Clock}
                />
                <KpiCard
                  label="Reserve Score"
                  value={`${Math.round(analysis.reserveHealthScore)}/100`}
                  sub={
                    analysis.predictions[0]?.reserveRecommendationUsd
                      ? `Rec. reserve ${fmtUsd(analysis.predictions[0].reserveRecommendationUsd)}`
                      : 'Based on forecast obligations'
                  }
                  accent="var(--blue)"
                  icon={ShieldCheck}
                />
              </div>
            </motion.div>

            {/* Forecast banner */}
            {analysis.predictions[0] && (
              <motion.div variants={stagger.item}>
                <div className="card-base px-7 py-6" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div className="pointer-events-none absolute inset-0 rounded-[var(--r-xl)]"
                    style={{ background: 'radial-gradient(ellipse at 0% 50%, rgba(59,130,246,0.06) 0%, transparent 60%)' }} />
                  <div className="flex items-start justify-between gap-6 flex-wrap relative">
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <BarChart3 className="w-4 h-4" style={{ color: 'var(--blue)', opacity: 0.75 }} />
                        <span className="label-metric">30-Day Forecast</span>
                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                          · based on {rangeLabel.toLowerCase()}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-4">
                        <p className="value-xl" style={{ color: 'var(--text-primary)' }}>
                          {fmtUsd(analysis.predictions[0].predictedSpendUsd)}
                        </p>
                        <div className="flex flex-col gap-1">
                          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--blue)' }}>
                            {Math.round(analysis.predictions[0].confidence * 100)}% confidence
                          </span>
                          {/* Animated confidence bar */}
                          <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round(analysis.predictions[0].confidence * 100)}%` }}
                              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                              className="h-full rounded-full"
                              style={{ background: 'var(--blue)' }}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="text-[13px] mt-2" style={{ color: 'var(--text-muted)' }}>
                        Predicted outflows over next 30 days
                      </p>
                    </div>
                    {analysis.predictions[0].reserveRecommendationUsd && (
                      <div className="pl-7" style={{ borderLeft: '1px solid var(--border-base)' }}>
                        <p className="label-metric mb-3">Recommended Reserve</p>
                        <p className="value-lg" style={{ color: 'var(--teal)' }}>
                          {fmtUsd(analysis.predictions[0].reserveRecommendationUsd)}
                        </p>
                        <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                          1.5× projected obligations
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Activity chart */}
            {hasTimelineData && (
              <motion.div variants={stagger.item}>
                <div className="card-base p-7" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div className="pointer-events-none absolute inset-0 rounded-[var(--r-xl)]"
                    style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(45,212,191,0.05) 0%, transparent 60%)' }} />
                  <div className="flex items-start justify-between mb-7 relative">
                    <div>
                      <p className="label-metric mb-2">Treasury Activity</p>
                      <div className="flex items-baseline gap-3">
                        <p className="value-lg" style={{ color: 'var(--text-primary)' }}>
                          {fmtUsd(timelineData.reduce((s, d) => s + d.spend, 0))}
                        </p>
                        <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>total outflows</span>
                      </div>
                      <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{rangeLabel}</p>
                    </div>
                    <Badge variant="muted">
                      {range === '30d' ? 'Daily' : range === '90d' ? 'Weekly' : range === '180d' ? 'Bi-weekly' : 'Monthly'}
                    </Badge>
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={timelineData} margin={{ left: 4, right: 4, top: 8, bottom: 4 }} barCategoryGap="28%">
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                        width={52}
                      />
                      <RechartTooltip
                        formatter={(v: unknown) => [fmtUsd(Number(v ?? 0)), 'Volume']}
                        contentStyle={ChartTooltipStyle}
                        cursor={{ fill: 'rgba(255,255,255,0.025)' }}
                      />
                      <Bar dataKey="spend" fill="url(#barGrad)" radius={[4, 4, 0, 0]} animationDuration={1200} animationEasing="ease-out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Main grid */}
            <motion.div variants={stagger.item}>
              <div className="grid lg:grid-cols-3 gap-4">

                {/* Ledger — 2/3 width */}
                <div className="lg:col-span-2">
                  <div className="card-base overflow-hidden" style={{ padding: 0 }}>

                    {/* Tab bar */}
                    <div
                      className="flex items-center px-1 pt-1"
                      style={{ borderBottom: '1px solid var(--border-base)' }}
                    >
                      {([
                        { id: 'transactions', label: 'Transactions', count: analysis.transactions.length },
                        { id: 'recurring',    label: 'Recurring',    count: analysis.recurringPatterns.length },
                        { id: 'insights',     label: 'AI Insights',  count: analysis.insights.length },
                      ] as const).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className="relative flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium transition-colors"
                          style={{
                            color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          }}
                          onMouseEnter={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                          onMouseLeave={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
                        >
                          {activeTab === tab.id && (
                            <motion.div
                              layoutId="tab-indicator"
                              className="absolute bottom-0 left-0 right-0 h-[2px]"
                              style={{ background: 'var(--teal)' }}
                              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                            />
                          )}
                          {tab.label}
                          {tab.count > 0 && (
                            <span
                              className="text-[11px] px-2 py-0.5 rounded font-semibold tabular-nums"
                              style={{
                                background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                color: activeTab === tab.id ? 'var(--text-secondary)' : 'var(--text-muted)',
                                borderRadius: '5px',
                              }}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="py-0 max-h-[480px] overflow-y-auto">
                      <AnimatePresence mode="wait">
                        {activeTab === 'transactions' && (
                          <motion.div
                            key="transactions"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            {isAnalyzing
                              ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                              : analysis.transactions.length === 0
                              ? (
                                <EmptyState
                                  title={`No transactions in ${rangeLabel.toLowerCase()}`}
                                  body="This wallet may have activity outside this window. Try expanding the range to surface older payment history."
                                  cta={range !== 'all' ? 'Expand to All History' : undefined}
                                  onCta={range !== 'all' ? () => handleRangeChange('all') : undefined}
                                />
                              )
                              : analysis.transactions.map(tx => (
                                <TxRow key={tx.id} tx={tx} onTag={setTagTarget} />
                              ))
                            }
                          </motion.div>
                        )}

                        {activeTab === 'recurring' && (
                          <motion.div
                            key="recurring"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            {analysis.recurringPatterns.length === 0
                              ? (
                                <EmptyState
                                  title="No recurring patterns detected"
                                  body={
                                    range === '30d' || range === '90d'
                                      ? "We need more history to detect recurring obligations. Monthly payroll won't appear in a 30-day window."
                                      : "No statistically recurring counterparties found. Patterns require at least 2 matching transactions."
                                  }
                                  cta={(range === '30d' || range === '90d') ? 'Try 180D or 1Y' : undefined}
                                  onCta={(range === '30d' || range === '90d') ? () => handleRangeChange('180d') : undefined}
                                />
                              )
                              : analysis.recurringPatterns.map(p => (
                                <RecurringRow key={p.id} pattern={p} onTag={setTagTarget} />
                              ))
                            }
                          </motion.div>
                        )}

                        {activeTab === 'insights' && (
                          <motion.div
                            key="insights"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="p-3 space-y-2"
                          >
                            {isGeneratingInsights
                              ? (
                                <div className="flex flex-col items-center gap-2 py-10">
                                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    Generating AI insights…
                                  </p>
                                </div>
                              )
                              : analysis.insights.length === 0
                              ? (
                                <div className="text-center py-10 space-y-3">
                                  <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                                    No insights generated yet
                                  </p>
                                  <button
                                    onClick={() => void generateInsights()}
                                    className="btn-secondary inline-flex"
                                    style={{ fontSize: '11px', padding: '6px 12px' }}
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    Generate AI Insights
                                  </button>
                                </div>
                              )
                              : analysis.insights.map(i => (
                                <InsightCard key={i.id} insight={i} />
                              ))
                            }
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">

                  {/* Spend by category */}
                  <div className="card-base p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="label-metric">Spend by Category</h3>
                      {chartData.length > 0 && (
                        <span className="text-[12px] tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
                          {chartData.length} categories
                        </span>
                      )}
                    </div>
                    {chartData.length === 0 ? (
                      <div className="py-8 text-center space-y-2">
                        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                          No categorized spend in {rangeLabel.toLowerCase()}.
                        </p>
                        {range !== 'all' && (
                          <button
                            onClick={() => handleRangeChange('all')}
                            className="text-[12px] underline underline-offset-2 transition-colors"
                            style={{ color: 'rgba(45,212,191,0.5)' }}
                          >
                            View all history
                          </button>
                        )}
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart
                          data={chartData}
                          layout="vertical"
                          margin={{ left: 0, right: 12, top: 0, bottom: 0 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={96}
                            tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <RechartTooltip
                            formatter={(v: unknown) => [fmtUsd(Number(v ?? 0)), 'Spend']}
                            contentStyle={ChartTooltipStyle}
                            cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                          />
                          <Bar dataKey="value" radius={[0, 5, 5, 0]} animationDuration={1100} animationEasing="ease-out">
                            {chartData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} opacity={0.88} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Top counterparties */}
                  <div className="card-base p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="label-metric">Top Counterparties</h3>
                    </div>
                    {analysis.counterparties.length === 0 ? (
                      <p className="text-[13px] text-center py-4" style={{ color: 'var(--text-muted)' }}>
                        No counterparty data yet.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {analysis.counterparties.slice(0, 6).map(cp => (
                          <div key={cp.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors"
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: CAT_COLORS[cp.category] ?? '#374151' }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {cp.label ?? fmtAddr(cp.address)}
                              </p>
                              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {cp.transactionCount} txns{cp.isRecurring && ' · recurring'}
                              </p>
                            </div>
                            <p className="text-[13px] font-semibold tabular-nums shrink-0"
                              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                            >
                              {fmtUsd(cp.totalSentUsd)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Footer meta */}
            <motion.div variants={stagger.item}>
              <div className="flex items-center gap-3 text-[10px] py-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                <Cpu className="w-3 h-3" />
                <span>Pattern analysis processed locally on-device</span>
                <span>·</span>
                <span>Last analyzed {fmtDate(analysis.lastAnalyzedAt)}</span>
                <span>·</span>
                <span>{analysis.transactionCount} transactions · {rangeLabel}</span>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      <TagModal
        item={tagTarget}
        onClose={() => setTagTarget(null)}
        onSubmit={async (req) => {
          await submitTag(req);
          setTagTarget(null);
        }}
      />
    </AppShell>
  );
}

export default function TreasuryPage() {
  return (
    <Suspense fallback={null}>
      <TreasuryPageInner />
    </Suspense>
  );
}
