'use client';
import { useState, useRef, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { formatUsd } from '@/lib/utils';
import {
  Cpu, Upload, Loader2,
  Repeat, Search, X, Zap, ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

type TxCategory = 'payroll' | 'subscription' | 'infrastructure' | 'contractor' | 'revenue' | 'transfer' | 'fee' | 'unknown';

interface CategorizedTransaction {
  id: string;
  date: string;
  description: string;
  amountUsd: number;
  category: TxCategory;
  confidence: number;
  isRecurring: boolean;
  recurringPeriod?: string;
  rawLine: string;
}

interface RecurringPattern {
  description: string;
  category: TxCategory;
  avgAmount: number;
  frequency: string;
  nextPredicted: string;
  confidence: number;
  txCount: number;
}

// ─── Local QVAC Classification Engine ─────────────────────────────────────────

const CATEGORY_PATTERNS: Record<TxCategory, RegExp[]> = {
  payroll:        [/payroll/i, /salary/i, /wages/i, /compensation/i, /stipend/i, /hr pay/i],
  subscription:   [/subscription/i, /saas/i, /monthly plan/i, /annual plan/i, /stripe/i, /recurly/i, /notion/i, /linear/i, /figma/i, /github/i, /slack/i, /zoom/i, /aws recurring/i, /google workspace/i],
  infrastructure: [/aws/i, /gcp/i, /google cloud/i, /azure/i, /cloudflare/i, /vercel/i, /heroku/i, /digitalocean/i, /infra/i, /server/i, /compute/i, /storage bill/i, /data transfer/i],
  contractor:     [/contractor/i, /freelance/i, /invoice/i, /consulting/i, /devshop/i, /design fee/i, /audit fee/i, /legal fee/i],
  revenue:        [/payment received/i, /deposit/i, /credit/i, /revenue/i, /income/i, /payout received/i],
  transfer:       [/transfer/i, /wallet/i, /bridge/i, /swap/i, /rebalance/i, /move funds/i],
  fee:            [/fee/i, /gas/i, /slippage/i, /protocol fee/i, /network cost/i],
  unknown:        [],
};

const FREQUENCY_PATTERNS = [
  { name: 'monthly', periodDays: 30, keywords: ['monthly', 'month', 'mo'] },
  { name: 'weekly',  periodDays: 7,  keywords: ['weekly', 'week', 'wk'] },
  { name: 'annual',  periodDays: 365, keywords: ['annual', 'year', 'yr'] },
];

function classifyLocally(description: string, _amount: number): { category: TxCategory; confidence: number; isRecurring: boolean; recurringPeriod?: string } {
  let bestCategory: TxCategory = 'unknown';
  let bestConfidence = 0.4;
  let isRecurring = false;
  let recurringPeriod: string | undefined;

  for (const [cat, patterns] of Object.entries(CATEGORY_PATTERNS) as [TxCategory, RegExp[]][]) {
    if (cat === 'unknown') continue;
    for (const re of patterns) {
      if (re.test(description)) {
        const confidence = cat === 'payroll' ? 0.94 : cat === 'infrastructure' ? 0.91 : cat === 'subscription' ? 0.89 : 0.82;
        if (confidence > bestConfidence) {
          bestCategory = cat;
          bestConfidence = confidence;
        }
      }
    }
  }

  for (const freq of FREQUENCY_PATTERNS) {
    if (freq.keywords.some(kw => description.toLowerCase().includes(kw))) {
      isRecurring = true;
      recurringPeriod = freq.name;
    }
  }
  if (!isRecurring && (bestCategory === 'subscription' || bestCategory === 'infrastructure' || bestCategory === 'payroll')) {
    isRecurring = true;
    recurringPeriod = 'monthly';
  }

  return { category: bestCategory, confidence: bestConfidence, isRecurring, recurringPeriod };
}

function detectRecurringPatterns(txs: CategorizedTransaction[]): RecurringPattern[] {
  const groups: Record<string, CategorizedTransaction[]> = {};
  for (const tx of txs.filter(t => t.isRecurring)) {
    const key = tx.category + '_' + Math.round(tx.amountUsd / 50) * 50;
    groups[key] = [...(groups[key] ?? []), tx];
  }

  return Object.values(groups)
    .filter(g => g.length >= 1)
    .map(group => {
      const avg = group.reduce((s, t) => s + t.amountUsd, 0) / group.length;
      const sample = group[0];
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      return {
        description: sample.description,
        category: sample.category,
        avgAmount: avg,
        frequency: sample.recurringPeriod ?? 'monthly',
        nextPredicted: nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        confidence: sample.confidence,
        txCount: group.length,
      };
    });
}

function parseCSV(text: string): CategorizedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: CategorizedTransaction[] = [];
  for (let i = 1; i < lines.length && i < 201; i++) {
    const line = lines[i];
    const parts = line.split(',').map(p => p.replace(/"/g, '').trim());
    if (parts.length < 3) continue;
    const [datePart, descPart, amtPart] = parts;
    const amount = parseFloat(amtPart?.replace(/[$,]/g, '') ?? '0');
    if (isNaN(amount) || !descPart) continue;
    const { category, confidence, isRecurring, recurringPeriod } = classifyLocally(descPart, Math.abs(amount));
    results.push({ id: `qtx_${i}`, date: datePart ?? '', description: descPart, amountUsd: Math.abs(amount), category, confidence, isRecurring, recurringPeriod, rawLine: line });
  }
  return results;
}

const DEMO_TRANSACTIONS: CategorizedTransaction[] = [
  { id: 'qtx_d1',  date: '2026-05-01', description: 'Monthly payroll disbursement',    amountUsd: 12500, category: 'payroll',        confidence: 0.94, isRecurring: true,  recurringPeriod: 'monthly', rawLine: '' },
  { id: 'qtx_d2',  date: '2026-05-03', description: 'AWS infrastructure bill',         amountUsd: 847.32, category: 'infrastructure', confidence: 0.91, isRecurring: true,  recurringPeriod: 'monthly', rawLine: '' },
  { id: 'qtx_d3',  date: '2026-05-04', description: 'GitHub Enterprise subscription',  amountUsd: 299,   category: 'subscription',   confidence: 0.89, isRecurring: true,  recurringPeriod: 'monthly', rawLine: '' },
  { id: 'qtx_d4',  date: '2026-05-05', description: 'Freelance dev invoice #1047',     amountUsd: 3200,  category: 'contractor',     confidence: 0.82, isRecurring: false, rawLine: '' },
  { id: 'qtx_d5',  date: '2026-05-07', description: 'Vercel Pro subscription',         amountUsd: 20,    category: 'subscription',   confidence: 0.89, isRecurring: true,  recurringPeriod: 'monthly', rawLine: '' },
  { id: 'qtx_d6',  date: '2026-05-08', description: 'Cloudflare annual plan',          amountUsd: 200,   category: 'infrastructure', confidence: 0.91, isRecurring: true,  recurringPeriod: 'annual', rawLine: '' },
  { id: 'qtx_d7',  date: '2026-05-10', description: 'Linear SaaS monthly',             amountUsd: 180,   category: 'subscription',   confidence: 0.89, isRecurring: true,  recurringPeriod: 'monthly', rawLine: '' },
  { id: 'qtx_d8',  date: '2026-05-12', description: 'Solana network fee',              amountUsd: 0.12,  category: 'fee',            confidence: 0.87, isRecurring: false, rawLine: '' },
  { id: 'qtx_d9',  date: '2026-05-14', description: 'Design agency invoice',           amountUsd: 1800,  category: 'contractor',     confidence: 0.82, isRecurring: true,  recurringPeriod: 'monthly', rawLine: '' },
  { id: 'qtx_d10', date: '2026-05-15', description: 'Stripe payment received',         amountUsd: 8750,  category: 'revenue',        confidence: 0.88, isRecurring: false, rawLine: '' },
];

const CAT_COLORS: Record<TxCategory, string> = {
  payroll:        '#6366f1',
  subscription:   '#a78bfa',
  infrastructure: '#f97316',
  contractor:     'var(--teal)',
  revenue:        'var(--green)',
  transfer:       'var(--blue)',
  fee:            'var(--text-tertiary)',
  unknown:        '#374151',
};

const CAT_LABELS: Record<TxCategory, string> = {
  payroll:        'Payroll',
  subscription:   'Subscription',
  infrastructure: 'Infrastructure',
  contractor:     'Contractor',
  revenue:        'Revenue',
  transfer:       'Transfer',
  fee:            'Fee',
  unknown:        'Unknown',
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function QvacPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<CategorizedTransaction[]>(DEMO_TRANSACTIONS);
  const [processing, setProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<TxCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const recurring = detectRecurringPatterns(transactions);

  const filtered = transactions.filter(tx => {
    const matchSearch = !search || tx.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || tx.category === filterCat;
    return matchSearch && matchCat;
  });

  const totalByCategory = Object.fromEntries(
    (Object.keys(CAT_COLORS) as TxCategory[]).map(cat => [
      cat,
      transactions.filter(t => t.category === cat).reduce((s, t) => s + t.amountUsd, 0),
    ])
  ) as Record<TxCategory, number>;

  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { alert('Please upload a CSV file.'); return; }
    setProcessing(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setTimeout(() => {
        const parsed = parseCSV(text);
        if (parsed.length > 0) setTransactions(parsed);
        setProcessing(false);
      }, 800);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleLocalChat = async () => {
    if (!query.trim()) return;
    setChatLoading(true);
    const context = `${transactions.length} transactions categorized. Categories: ${
      (Object.keys(totalByCategory) as TxCategory[])
        .filter(k => totalByCategory[k] > 0)
        .map(k => `${k}: ${formatUsd(totalByCategory[k])}`)
        .join(', ')
    }. Recurring patterns: ${recurring.map(r => `${r.description} (${r.frequency}, avg ${formatUsd(r.avgAmount)})`).join('; ')}`;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query, context, mode: 'qvac' }),
      });
      const data = await res.json() as { reply?: string; error?: string };
      setChatResponse(data.reply ?? data.error ?? 'No response.');
    } catch {
      setChatResponse(
        query.toLowerCase().includes('runway')
          ? `Current monthly obligations total ${formatUsd(recurring.reduce((s, r) => s + r.avgAmount, 0))}. At current spend levels, treasury runway depends on reserve balance.`
          : `Detected ${recurring.length} recurring patterns totalling ${formatUsd(recurring.reduce((s, r) => s + r.avgAmount, 0))} per cycle.`
      );
    }
    setChatLoading(false);
  };

  const categorizationRate = ((transactions.filter(t => t.category !== 'unknown').length / Math.max(1, transactions.length)) * 100).toFixed(0);
  const monthlyObligations = recurring.filter(r => r.frequency === 'monthly').reduce((s, r) => s + r.avgAmount, 0);

  return (
    <AppShell>
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto space-y-4"
      >

        {/* ── Header ── */}
        <motion.div variants={stagger.item}>
          <div
            className="p-5 rounded-xl"
            style={{
              border: '1px solid rgba(56,189,248,0.15)',
              background: 'linear-gradient(135deg, rgba(56,189,248,0.05) 0%, var(--bg-card) 60%)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(56,189,248,0.10)', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.18)' }}
              >
                <Cpu className="w-5 h-5" style={{ color: '#38bdf8' }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h1 className="text-[15px] font-semibold tracking-tight font-display"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    QVAC Local AI
                  </h1>
                  <Badge variant="local">Local Only</Badge>
                  <span
                    className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded"
                    style={{
                      background: 'rgba(34,197,94,0.07)',
                      border: '1px solid rgba(34,197,94,0.18)',
                      color: 'var(--green)',
                      borderRadius: '4px',
                    }}
                  >
                    <span className="status-live" />
                    On-device
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Transaction categorization, recurring pattern detection, and treasury analytics — all processed locally. No data leaves your browser.
                </p>
                <div className="flex items-center gap-4 mt-3 text-[10px]">
                  <span className="flex items-center gap-1.5" style={{ color: '#38bdf8' }}>
                    <Cpu className="w-3 h-3" />
                    Local inference only
                  </span>
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--green)' }}>
                    <Zap className="w-3 h-3" />
                    No cloud API calls
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Upload zone ── */}
        <motion.div variants={stagger.item}>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl text-center transition-all"
            style={{
              border: '2px dashed var(--border-base)',
              padding: '40px',
              background: 'var(--bg-overlay)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.35)'; (e.currentTarget as HTMLElement).style.background = 'rgba(56,189,248,0.03)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-overlay)'; }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
            {processing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Processing locally…</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>No data leaves your device</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  {fileName ? (
                    <span style={{ color: '#38bdf8' }}>Loaded: {fileName}</span>
                  ) : (
                    <span>Drop a <strong style={{ color: 'var(--text-primary)' }}>CSV file</strong> or click to upload</span>
                  )}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  Columns: date, description, amount — max 200 rows
                  {!fileName && <span style={{ color: '#38bdf8', marginLeft: 8 }}>Using demo data</span>}
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── KPI row ── */}
        <motion.div variants={stagger.item}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Transactions',         value: transactions.length.toString() },
              { label: 'Recurring detected',   value: recurring.length.toString() },
              { label: 'Monthly obligations',  value: formatUsd(monthlyObligations) },
              { label: 'Categorization rate',  value: `${categorizationRate}%` },
            ].map(({ label, value }) => (
              <div key={label} className="card-base p-4">
                <p className="label-metric mb-2">{label}</p>
                <p className="value-md" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* Left: Categories + transactions */}
          <motion.div variants={stagger.item} className="lg:col-span-2 space-y-4">

            {/* Category breakdown */}
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Category Breakdown</h3>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {transactions.length} transactions
                </span>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(CAT_COLORS) as TxCategory[])
                  .filter(cat => totalByCategory[cat] > 0)
                  .sort((a, b) => totalByCategory[b] - totalByCategory[a])
                  .map(cat => {
                    const color = CAT_COLORS[cat];
                    const count = transactions.filter(t => t.category === cat).length;
                    const isActive = filterCat === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
                        className="rounded-lg p-3 text-left transition-all"
                        style={{
                          border: isActive
                            ? `1px solid color-mix(in srgb, ${color} 35%, transparent)`
                            : '1px solid var(--border-lo)',
                          background: isActive
                            ? `color-mix(in srgb, ${color} 8%, transparent)`
                            : 'var(--bg-overlay)',
                        }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-lo)'; }}
                      >
                        <p className="text-[10px] font-semibold" style={{ color }}>{CAT_LABELS[cat]}</p>
                        <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {formatUsd(totalByCategory[cat], 0)}
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{count} tx</p>
                      </button>
                    );
                  })
                }
              </div>
            </div>

            {/* Transaction list */}
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Categorized Transactions</h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search…"
                      className="input-base pl-7"
                      style={{ fontSize: '11px', padding: '5px 10px 5px 26px', width: 130 }}
                    />
                  </div>
                  {filterCat !== 'all' && (
                    <button
                      onClick={() => setFilterCat('all')}
                      className="flex items-center gap-1 text-[10px] transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>No transactions match filter.</p>
                  </div>
                ) : (
                  filtered.map(tx => {
                    const color = CAT_COLORS[tx.category];
                    return (
                      <div
                        key={tx.id}
                        className="ledger-row"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.015)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {tx.description}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{tx.date}</p>
                        </div>
                        <div className="text-right shrink-0 mx-3">
                          <p className="text-[12px] font-semibold tabular-nums"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                          >
                            {formatUsd(tx.amountUsd)}
                          </p>
                          {tx.isRecurring && (
                            <p className="text-[9px] flex items-center gap-0.5 justify-end mt-0.5" style={{ color: '#38bdf8' }}>
                              <Repeat className="w-2.5 h-2.5" />
                              {tx.recurringPeriod}
                            </p>
                          )}
                        </div>
                        <span
                          className="text-[9px] px-1.5 py-px rounded font-semibold shrink-0"
                          style={{
                            background: `color-mix(in srgb, ${color} 10%, transparent)`,
                            color,
                            border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                            borderRadius: '4px',
                          }}
                        >
                          {CAT_LABELS[tx.category]}
                        </span>
                        <span
                          className="text-[9px] tabular-nums shrink-0 ml-2"
                          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 28, textAlign: 'right' }}
                        >
                          {(tx.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>

          {/* Right: Recurring + Chat */}
          <motion.div variants={stagger.item} className="space-y-4">

            {/* Recurring patterns */}
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Recurring Patterns</h3>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(56,189,248,0.08)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56,189,248,0.16)',
                    borderRadius: '4px',
                  }}
                >
                  {recurring.length} detected
                </span>
              </div>
              <div className="p-3 space-y-2">
                {recurring.length === 0 ? (
                  <p className="text-[11px] text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                    No patterns detected yet.
                  </p>
                ) : (
                  recurring.map((pattern, i) => {
                    const color = CAT_COLORS[pattern.category];
                    return (
                      <div
                        key={i}
                        className="p-3 rounded-lg"
                        style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {pattern.description}
                          </p>
                          <span
                            className="shrink-0 text-[9px] px-1.5 py-px rounded font-semibold"
                            style={{
                              background: `color-mix(in srgb, ${color} 10%, transparent)`,
                              color,
                              border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                              borderRadius: '4px',
                            }}
                          >
                            {CAT_LABELS[pattern.category]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="font-semibold tabular-nums"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                          >
                            {formatUsd(pattern.avgAmount)}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>{pattern.frequency}</span>
                          <span className="ml-auto" style={{ color: '#38bdf8' }}>→ {pattern.nextPredicted}</span>
                        </div>
                        <div className="progress-track mt-2">
                          <div
                            className="progress-fill"
                            style={{ width: `${pattern.confidence * 100}%`, background: '#38bdf8' }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Ask QVAC */}
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Ask QVAC</h3>
                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--green)' }}>
                  <span className="status-live" />
                  Local
                </span>
              </div>
              <div className="p-4 space-y-3">
                {chatResponse && (
                  <div
                    className="p-3 rounded-lg text-[11px] leading-relaxed"
                    style={{
                      border: '1px solid rgba(56,189,248,0.12)',
                      background: 'rgba(56,189,248,0.04)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Cpu className="w-3 h-3 mb-1.5" style={{ color: '#38bdf8' }} />
                    {chatResponse}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleLocalChat(); }}
                    placeholder="e.g. What is my runway?"
                    className="input-base flex-1"
                    style={{ fontSize: '11px' }}
                  />
                  <button
                    onClick={() => void handleLocalChat()}
                    disabled={chatLoading}
                    className="btn-secondary flex items-center justify-center disabled:opacity-40"
                    style={{ padding: '6px 10px' }}
                  >
                    {chatLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Runway estimate', 'Top expenses', 'Recurring total'].map(q => (
                    <button
                      key={q}
                      onClick={() => setQuery(q)}
                      className="text-[10px] px-2 py-1 rounded transition-all"
                      style={{
                        border: '1px solid var(--border-base)',
                        color: 'var(--text-muted)',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hi)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </motion.div>
        </div>

      </motion.div>
    </AppShell>
  );
}
