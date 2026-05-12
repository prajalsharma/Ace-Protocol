'use client';
import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd, formatShortAddress } from '@/lib/utils';
import { computeProtocolFee } from '@/lib/feeEngine';
import { appendLog } from '@/lib/activityLog';
import {
  Zap, Calendar, CheckCircle2, Clock, XCircle, Loader2,
  Repeat, Play, AlertTriangle, ChevronDown, ShieldCheck,
  DollarSign, TrendingUp, ExternalLink, RefreshCw,
  Sparkles, ArrowUpRight, Info, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Connection, PublicKey, SystemProgram, Transaction,
  LAMPORTS_PER_SOL, clusterApiUrl,
} from '@solana/web3.js';
import { useSolanaWallets } from '@privy-io/react-auth';
import type { QueueItem } from '@/app/api/protocol/queue/route';

const PROGRAM_ID = 'DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY';
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl('devnet');
const EXPLORER = 'https://explorer.solana.com';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  ready_to_pay:     { label: 'Ready to Pay',    color: 'var(--green)',  bg: 'rgba(34,197,94,0.08)' },
  ready_soon:       { label: 'Ready Soon',       color: 'var(--amber)',  bg: 'rgba(244,166,34,0.08)' },
  scheduled:        { label: 'Scheduled',        color: 'var(--blue)',   bg: 'rgba(99,102,241,0.08)' },
  predicted:        { label: 'Predicted',        color: '#a78bfa',       bg: 'rgba(167,139,250,0.08)' },
  detected:         { label: 'Detected',         color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.04)' },
  waiting_approval: { label: 'Waiting Approval', color: '#f97316',       bg: 'rgba(249,115,22,0.08)' },
  paid:             { label: 'Paid',             color: 'var(--green)',  bg: 'rgba(34,197,94,0.06)' },
  blocked_by_policy:{ label: 'Blocked',          color: 'var(--red)',    bg: 'rgba(244,63,94,0.08)' },
};

const CAT_LABELS: Record<string, string> = {
  payroll: 'Payroll', infrastructure: 'Infra', subscription: 'Subscription',
  saas: 'SaaS', contractor: 'Contractor', ai_infrastructure: 'AI Infra',
  recurring_bill: 'Recurring Bill', treasury_payout: 'Treasury', x402: 'x402',
  bill: 'Bill', unknown: 'Unclassified',
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

interface QueueResponse {
  queue: QueueItem[];
  summary: {
    total: number;
    readyCount: number;
    readySoonCount: number;
    totalCommittedUsd: number;
    totalFeesUsd: number;
    reserveHealthy: boolean;
    reserveRatioPct: number;
  };
  generatedAt: number;
}

// ── Payment Confirmation Modal ────────────────────────────────────────────────

function PayConfirmModal({
  item,
  onClose,
  onConfirm,
  isExecuting,
  txResult,
}: {
  item: QueueItem;
  onClose: () => void;
  onConfirm: () => void;
  isExecuting: boolean;
  txResult: { ok: boolean; txSig?: string; reason?: string } | null;
}) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.scheduled;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
        style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-base)', borderRadius: '16px', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-base)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center"
              style={{ background: 'rgba(244,166,34,0.12)', borderRadius: '8px' }}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: 'var(--amber)' }} />
            </div>
            <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Confirm Payment
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* Payment summary */}
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-lo)' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {item.label}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {CAT_LABELS[item.category] ?? item.category}
                  {item.source === 'paysh' && (
                    <span className="ml-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(244,166,34,0.12)', color: 'var(--amber)', borderRadius: '4px' }}
                    >
                      pay.sh
                    </span>
                  )}
                </p>
              </div>
              <span className="text-[9px] font-semibold px-2 py-1 rounded"
                style={{ background: cfg.bg, color: cfg.color, borderRadius: '5px' }}
              >
                {cfg.label}
              </span>
            </div>

            {/* Amount */}
            <div className="flex items-baseline justify-between pt-2"
              style={{ borderTop: '1px solid var(--border-lo)' }}
            >
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Amount</span>
              <span className="text-[20px] font-semibold tabular-nums"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
              >
                {formatUsd(item.estimatedAmountUsd)}
              </span>
            </div>

            {/* Due */}
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Due</span>
              <span className="text-[12px] font-medium"
                style={{ color: item.daysUntilDue <= 3 ? 'var(--red)' : 'var(--text-secondary)' }}
              >
                {item.dueDateLabel}
              </span>
            </div>

            {/* Confidence */}
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>AI Confidence</span>
              <span className="text-[12px] font-medium tabular-nums"
                style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}
              >
                {Math.round(item.confidenceScore * 100)}%
              </span>
            </div>

            {item.counterparty && (
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Recipient</span>
                <span className="text-[11px] tabular-nums"
                  style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
                >
                  {formatShortAddress(item.counterparty)}
                </span>
              </div>
            )}
          </div>

          {/* Protocol fee breakdown */}
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: 'rgba(244,166,34,0.04)', border: '1px solid rgba(244,166,34,0.15)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5" style={{ color: 'var(--amber)' }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--amber)' }}>
                ACE Protocol Fee
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Fee rate</span>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                {item.protocolFeeBps} bps · {(item.protocolFeeBps / 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Fee amount</span>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                {formatUsd(item.protocolFeeUsd)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>You pay</span>
              <span className="text-[13px] font-bold tabular-nums"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
              >
                {formatUsd(item.estimatedAmountUsd + item.protocolFeeUsd)}
              </span>
            </div>
            <p className="text-[9px] leading-relaxed mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              {item.protocolFeeLabel} — dynamic fee 25–200 bps based on network & market conditions.
            </p>
          </div>

          {/* Reserve impact */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg"
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-lo)' }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--blue)' }} />
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Reserve impact</span>
            </div>
            <span className="text-[12px] font-semibold tabular-nums"
              style={{ color: item.reserveImpactPct > 15 ? 'var(--red)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}
            >
              −{item.reserveImpactPct.toFixed(1)}%
            </span>
          </div>

          {/* TX result */}
          {txResult && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-[11px]"
              style={
                txResult.ok
                  ? { border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.06)', color: 'var(--green)' }
                  : { border: '1px solid rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.06)', color: 'var(--red)' }
              }
            >
              {txResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <p>{txResult.ok ? 'Payment executed successfully.' : (txResult.reason ?? 'Execution failed.')}</p>
                {txResult.txSig && (
                  <a href={`${EXPLORER}/tx/${txResult.txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 underline underline-offset-2 hover:opacity-80"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}
                  >
                    {txResult.txSig.slice(0, 24)}… <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!txResult && (
          <div className="px-6 pb-6 flex items-center gap-3">
            <button onClick={onClose} className="btn-secondary flex-1"
              style={{ fontSize: '12px', padding: '10px' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isExecuting}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontSize: '12px', padding: '10px' }}
            >
              {isExecuting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing…</>
                : <><Zap className="w-3.5 h-3.5" /> Pay Now</>
              }
            </button>
          </div>
        )}
        {txResult && (
          <div className="px-6 pb-6">
            <button onClick={onClose} className="btn-secondary w-full" style={{ fontSize: '12px', padding: '10px' }}>
              Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Queue Item Row ────────────────────────────────────────────────────────────

function QueueRow({
  item,
  onPayNow,
}: {
  item: QueueItem;
  onPayNow: (item: QueueItem) => void;
}) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.detected;
  const isReady = item.status === 'ready_to_pay';
  const isSoon = item.status === 'ready_soon';

  return (
    <div className="ledger-row group">
      {/* Category dot */}
      <div className="w-1.5 h-1.5 rounded-full shrink-0 mr-3 mt-1"
        style={{ background: cfg.color, boxShadow: isReady ? `0 0 6px ${cfg.color}` : 'none' }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {item.label}
          </p>
          {item.source === 'paysh' && (
            <span className="text-[9px] font-semibold px-1.5 py-px rounded"
              style={{ background: 'rgba(244,166,34,0.12)', color: 'var(--amber)', borderRadius: '4px' }}
            >
              pay.sh
            </span>
          )}
          {item.source === 'ai_detected' && (
            <span className="text-[9px] font-semibold px-1.5 py-px rounded flex items-center gap-0.5"
              style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', borderRadius: '4px' }}
            >
              <Sparkles className="w-2 h-2" /> AI
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {CAT_LABELS[item.category] ?? item.category}
          </span>
          {item.counterparty && (
            <>
              <span style={{ color: 'var(--border-base)' }}>·</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {formatShortAddress(item.counterparty)}
              </span>
            </>
          )}
          {item.frequencyDays && (
            <>
              <span style={{ color: 'var(--border-base)' }}>·</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                every {item.frequencyDays}d
              </span>
            </>
          )}
          {item.sampleCount && (
            <>
              <span style={{ color: 'var(--border-base)' }}>·</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {item.sampleCount} occurrences
              </span>
            </>
          )}
        </div>
      </div>

      {/* Amount + due */}
      <div className="text-right shrink-0 mr-3">
        <p className="text-[13px] font-semibold tabular-nums"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatUsd(item.estimatedAmountUsd)}
        </p>
        <p className="text-[10px] mt-0.5"
          style={{ color: item.daysUntilDue <= 3 ? 'var(--red)' : 'var(--text-muted)' }}
        >
          {item.dueDateLabel}
        </p>
      </div>

      {/* Confidence + fee */}
      <div className="text-right shrink-0 mr-3 hidden md:block">
        <p className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
          {Math.round(item.confidenceScore * 100)}%
        </p>
        <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          fee {item.protocolFeeBps} bps
        </p>
      </div>

      {/* Status + action */}
      <div className="shrink-0 flex items-center gap-2">
        <span className="text-[10px] font-semibold px-2 py-1 rounded"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}22`, borderRadius: '5px', whiteSpace: 'nowrap' }}
        >
          {cfg.label}
        </span>

        {isReady && (
          <button
            onClick={() => onPayNow(item)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-all"
            style={{
              background: 'var(--green)',
              color: '#000',
              borderRadius: '6px',
              boxShadow: '0 0 12px rgba(34,197,94,0.3)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            <Zap className="w-3 h-3" />
            Pay Now
          </button>
        )}

        {isSoon && (
          <button
            onClick={() => onPayNow(item)}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded text-[10px]"
            style={{ border: '1px solid rgba(244,166,34,0.22)', background: 'rgba(244,166,34,0.06)', color: 'var(--amber)', borderRadius: '5px' }}
          >
            <Play className="w-2.5 h-2.5" />
            Preview
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { sessionToken, vault, refreshVault } = useApp();
  const { wallets: solanaWallets } = useSolanaWallets();
  const solanaWallet = solanaWallets[0] ?? null;

  const [queueData, setQueueData] = useState<QueueResponse | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState('');

  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [txResult, setTxResult] = useState<{ ok: boolean; txSig?: string; reason?: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!sessionToken) return;
    setIsLoadingQueue(true);
    setQueueError('');
    try {
      const res = await fetch('/api/protocol/queue', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error('Failed to load payment queue');
      setQueueData(await res.json() as QueueResponse);
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : 'Queue load failed');
    } finally {
      setIsLoadingQueue(false);
    }
  }, [sessionToken]);

  useEffect(() => { void fetchQueue(); }, [fetchQueue]);

  // ── Execute payment: real devnet SOL transfer + backend record ──────────
  const handlePayNow = useCallback(async () => {
    if (!selectedItem || !solanaWallet || !sessionToken) return;
    setIsExecuting(true);
    setTxResult(null);

    try {
      const connection = new Connection(RPC, 'confirmed');
      const ownerPubkey = new PublicKey(solanaWallet.address);

      // Fetch SOL price
      let solPrice = 148;
      try {
        const pr = await fetch('/api/sol-price');
        if (pr.ok) { const d = await pr.json() as { price?: number }; solPrice = d.price ?? 148; }
      } catch { /* fallback */ }

      const totalUsd = selectedItem.estimatedAmountUsd + selectedItem.protocolFeeUsd;
      const lamports = Math.ceil((totalUsd / solPrice) * LAMPORTS_PER_SOL);

      // Recipient: either the known counterparty or the program vault PDA
      let recipientPubkey: PublicKey;
      try {
        recipientPubkey = new PublicKey(selectedItem.counterparty ?? PROGRAM_ID);
      } catch {
        // Derive vault PDA as fallback recipient for protocol payments
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), ownerPubkey.toBuffer()],
          new PublicKey(PROGRAM_ID),
        );
        recipientPubkey = vaultPda;
      }

      const balance = await connection.getBalance(ownerPubkey);
      if (balance < lamports + 10_000) {
        setTxResult({ ok: false, reason: `Insufficient devnet SOL. Need ≈${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.` });
        return;
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: ownerPubkey })
        .add(SystemProgram.transfer({ fromPubkey: ownerPubkey, toPubkey: recipientPubkey, lamports }));

      const txSig = await solanaWallet.sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');

      // Record execution in backend if it's a DB-backed payment
      if (selectedItem.patternId && selectedItem.source === 'manual') {
        await fetch(`/api/protocol/payments/${selectedItem.patternId}/execute`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      }

      appendLog({
        type: 'payment',
        message: `Payment executed: ${selectedItem.label}`,
        detail: `${formatUsd(selectedItem.estimatedAmountUsd)} + ${formatUsd(selectedItem.protocolFeeUsd)} fee · ${txSig.slice(0, 20)}…`,
      });

      setTxResult({ ok: true, txSig });
      refreshVault();
      void fetchQueue();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      const isRejected = msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('cancelled');
      setTxResult({ ok: false, reason: isRejected ? 'Transaction cancelled.' : msg });
    } finally {
      setIsExecuting(false);
    }
  }, [selectedItem, solanaWallet, sessionToken, refreshVault, fetchQueue]);

  const openModal = (item: QueueItem) => {
    setSelectedItem(item);
    setTxResult(null);
  };
  const closeModal = () => {
    setSelectedItem(null);
    setTxResult(null);
  };

  const queue = queueData?.queue ?? [];
  const summary = queueData?.summary;

  const readyItems = queue.filter(q => q.status === 'ready_to_pay');
  const soonItems = queue.filter(q => q.status === 'ready_soon');
  const otherItems = queue.filter(q => !['ready_to_pay', 'ready_soon'].includes(q.status));

  return (
    <AppShell>
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="max-w-5xl mx-auto space-y-5">

        {/* ── Header ── */}
        <motion.div variants={stagger.item}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-[20px] font-semibold tracking-tight font-display"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Payment Queue
                </h1>
                {summary && (
                  <>
                    {summary.readyCount > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)' }}
                      >
                        {summary.readyCount} ready
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                ACE detected recurring obligations from wallet history and prepared them for approval
              </p>
            </div>
            <button onClick={fetchQueue} disabled={isLoadingQueue} className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {isLoadingQueue ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          </div>
        </motion.div>

        {/* ── KPI row ── */}
        {summary && (
          <motion.div variants={stagger.item}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Ready to Pay', value: summary.readyCount.toString(), sub: 'High confidence + due soon', color: 'var(--green)', icon: Zap },
                { label: 'Ready Soon', value: summary.readySoonCount.toString(), sub: 'Due within 14 days', color: 'var(--amber)', icon: Clock },
                { label: 'Total Committed', value: formatUsd(summary.totalCommittedUsd), sub: `${summary.total} obligations`, color: 'var(--blue)', icon: DollarSign },
                { label: 'Protocol Fees', value: formatUsd(summary.totalFeesUsd), sub: '25–200 bps dynamic', color: '#a78bfa', icon: TrendingUp },
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
                  <p className="text-[18px] font-semibold tabular-nums" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {value}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Reserve warning */}
        {summary && !summary.reserveHealthy && (
          <motion.div variants={stagger.item}>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-[11px]"
              style={{ border: '1px solid rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.05)', color: 'var(--red)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Reserve below minimum ({summary.reserveRatioPct.toFixed(1)}% — min 8%). Some payments are blocked until reserve is restored.
            </div>
          </motion.div>
        )}

        {queueError && (
          <motion.div variants={stagger.item}>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-[11px]"
              style={{ border: '1px solid rgba(244,63,94,0.18)', background: 'rgba(244,63,94,0.05)', color: 'var(--red)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {queueError}
            </div>
          </motion.div>
        )}

        {isLoadingQueue && !queueData && (
          <motion.div variants={stagger.item}>
            <div className="flex items-center gap-3 px-4 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--teal)' }} />
              <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                ACE is analyzing wallet history and building payment queue…
              </span>
            </div>
          </motion.div>
        )}

        {/* ── Ready to Pay ── */}
        {readyItems.length > 0 && (
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)', background: 'rgba(34,197,94,0.03)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="status-live" />
                  <h3 className="text-[12px] font-semibold" style={{ color: 'var(--green)' }}>Ready to Pay</h3>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
                    style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--green)', borderRadius: '4px' }}
                  >
                    {readyItems.length}
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  High confidence · sign to execute
                </span>
              </div>
              {readyItems.map(item => (
                <QueueRow key={item.id} item={item} onPayNow={openModal} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Ready Soon ── */}
        {soonItems.length > 0 && (
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <div className="flex items-center gap-2">
                  <h3 className="label-metric">Ready Soon</h3>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded tabular-nums"
                    style={{ background: 'rgba(244,166,34,0.10)', color: 'var(--amber)', borderRadius: '4px' }}
                  >
                    {soonItems.length}
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Due within 14 days</span>
              </div>
              {soonItems.map(item => (
                <QueueRow key={item.id} item={item} onPayNow={openModal} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Other scheduled / predicted ── */}
        {otherItems.length > 0 && (
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Upcoming Obligations</h3>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {otherItems.length} items
                </span>
              </div>
              {otherItems.map(item => (
                <QueueRow key={item.id} item={item} onPayNow={openModal} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Empty state ── */}
        {!isLoadingQueue && queue.length === 0 && !queueError && (
          <motion.div variants={stagger.item}>
            <div className="card-base py-16 text-center space-y-4">
              <div className="w-12 h-12 mx-auto flex items-center justify-center"
                style={{ borderRadius: '12px', border: '1px solid var(--border-base)', background: 'var(--bg-overlay)' }}
              >
                <Sparkles className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div>
                <p className="text-[13px] font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  No recurring payments detected yet
                </p>
                <p className="text-[12px] max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  ACE will automatically detect recurring obligations from your wallet history. Go to{' '}
                  <span style={{ color: 'var(--teal)' }}>Treasury Intelligence</span> to analyze your mainnet history first.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── pay.sh info ── */}
        <motion.div variants={stagger.item}>
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-[10px]"
            style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
          >
            <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
            <span>
              Payments tagged <strong style={{ color: 'var(--amber)' }}>pay.sh</strong> are agentic machine-to-machine recurring billings
              (AI infra, API subscriptions). They are automatically detected and scheduled by ACE using the{' '}
              <strong>pay.sh</strong> recurring billing protocol.
            </span>
          </div>
        </motion.div>

      </motion.div>

      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {selectedItem && (
          <PayConfirmModal
            item={selectedItem}
            onClose={closeModal}
            onConfirm={() => void handlePayNow()}
            isExecuting={isExecuting}
            txResult={txResult}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
