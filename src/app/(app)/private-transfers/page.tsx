'use client';
import { useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd, formatTimestamp, formatShortAddress } from '@/lib/utils';
import {
  LockKeyhole, Eye, EyeOff, ShieldCheck, Copy, CheckCircle2,
  AlertTriangle, Loader2, Plus, Key, Send, History, ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrivateTransfer {
  id: string;
  recipient: string;
  amountUsd: number;
  token: string;
  label: string;
  viewingKey: string;
  status: 'pending' | 'shielding' | 'complete' | 'failed';
  createdAt: number;
  note?: string;
}

interface ViewingKeyRecord {
  id: string;
  label: string;
  key: string;
  createdAt: number;
  transferCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateViewingKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `vk_${Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 52)}`;
}

function generateTransferId(): string {
  return `ptx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const _NOW_SEC = Math.floor(Date.now() / 1000);
const DEMO_TRANSFERS: PrivateTransfer[] = [
  {
    id: 'ptx_demo1',
    recipient: 'GfS9hKuU8ZY4vDxEtVXmrNLaWqpyMbPAQjK3T7cN2Rh',
    amountUsd: 2500,
    token: 'USDC',
    label: 'Contractor payroll — May',
    viewingKey: generateViewingKey(),
    status: 'complete',
    createdAt: _NOW_SEC - 86400 * 2,
    note: 'Monthly dev contractor payout',
  },
  {
    id: 'ptx_demo2',
    recipient: '7mN6PqYvXwZtHrSjK2LdQbFcUeAp8VgWnD4Mx5CR9Tk',
    amountUsd: 750,
    token: 'USDC',
    label: 'Shielded infra payment',
    viewingKey: generateViewingKey(),
    status: 'complete',
    createdAt: _NOW_SEC - 86400 * 5,
  },
];

const DEMO_VIEWING_KEYS: ViewingKeyRecord[] = [
  {
    id: 'vk_01',
    label: 'Payroll auditor key',
    key: generateViewingKey(),
    createdAt: _NOW_SEC - 86400 * 10,
    transferCount: 3,
  },
  {
    id: 'vk_02',
    label: 'Treasury oversight key',
    key: generateViewingKey(),
    createdAt: _NOW_SEC - 86400 * 3,
    transferCount: 1,
  },
];

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: 'var(--teal)' },
  shielding: { label: 'Shielding', color: '#a78bfa' },
  complete:  { label: 'Complete',  color: 'var(--green)' },
  failed:    { label: 'Failed',    color: 'var(--red)' },
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ViewingKeyCard({ record, onCopy }: { record: ViewingKeyRecord; onCopy: (key: string) => void }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="ledger-row">
      <div
        className="w-7 h-7 shrink-0 flex items-center justify-center mr-3"
        style={{ background: 'rgba(167,139,250,0.10)', borderRadius: '6px' }}
      >
        <Key className="w-3 h-3" style={{ color: '#a78bfa' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{record.label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {formatTimestamp(record.createdAt)} · {record.transferCount} transfer{record.transferCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div
        className="flex-1 min-w-0 mx-3 px-3 py-2 rounded-lg text-[10px] overflow-hidden"
        style={{
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-lo)',
          fontFamily: 'var(--font-mono)',
          color: revealed ? '#a78bfa' : 'var(--text-muted)',
        }}
      >
        {revealed ? record.key : '•'.repeat(20) + record.key.slice(-8)}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setRevealed(!revealed)}
          className="p-2 rounded-lg transition-colors"
          style={{ border: '1px solid var(--border-base)', color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
        >
          {revealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
        <button
          onClick={() => onCopy(record.key)}
          className="p-2 rounded-lg transition-colors"
          style={{ border: '1px solid var(--border-base)', color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#a78bfa'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(167,139,250,0.3)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function TransferRow({ transfer }: { transfer: PrivateTransfer }) {
  const [showKey, setShowKey] = useState(false);
  const cfg = STATUS_CFG[transfer.status];

  return (
    <div>
      <div className="ledger-row group">
        <div
          className="w-7 h-7 shrink-0 flex items-center justify-center mr-3"
          style={{ background: 'rgba(167,139,250,0.10)', borderRadius: '6px' }}
        >
          <LockKeyhole className="w-3 h-3" style={{ color: '#a78bfa' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
            {transfer.label}
          </p>
          <p className="text-[10px] mt-0.5"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {formatShortAddress(transfer.recipient)} · {transfer.token}
          </p>
        </div>
        <div className="text-right shrink-0 mx-3">
          <p className="text-[12px] font-semibold tabular-nums"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {formatUsd(transfer.amountUsd)}
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {formatTimestamp(transfer.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: `color-mix(in srgb, ${cfg.color} 10%, transparent)`,
              color: cfg.color,
              border: `1px solid color-mix(in srgb, ${cfg.color} 20%, transparent)`,
              borderRadius: '4px',
            }}
          >
            {cfg.label}
          </span>
          <button
            onClick={() => setShowKey(!showKey)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded"
            title="View audit key"
            style={{ border: '1px solid var(--border-base)', color: 'var(--text-muted)' }}
          >
            <Key className="w-3 h-3" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showKey && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="mx-4 mb-2 px-4 py-3 rounded-lg"
              style={{ border: '1px solid rgba(167,139,250,0.15)', background: 'rgba(167,139,250,0.04)' }}
            >
              <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Viewing key — share to grant audit access:
              </p>
              <p
                className="text-[10px] break-all"
                style={{ color: '#a78bfa', fontFamily: 'var(--font-mono)' }}
              >
                {transfer.viewingKey}
              </p>
              <p className="text-[9px] mt-1.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                Allows authorized viewers to verify amount and recipient without revealing your full history.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrivateTransfersPage() {
  const { vault, walletAddress } = useApp();
  const [tab, setTab] = useState<'send' | 'keys' | 'history'>('send');
  const [copied, setCopied] = useState<string | null>(null);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [token, setToken] = useState<'USDC' | 'USDT' | 'SOL'>('USDC');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [transfers, setTransfers] = useState<PrivateTransfer[]>(DEMO_TRANSFERS);
  const [viewingKeys, setViewingKeys] = useState<ViewingKeyRecord[]>(DEMO_VIEWING_KEYS);

  const handleCopy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const handleGenerateKey = () => {
    const key: ViewingKeyRecord = {
      id: `vk_${Date.now().toString(36)}`,
      label: `Key ${viewingKeys.length + 1} — ${new Date().toLocaleDateString()}`,
      key: generateViewingKey(),
      createdAt: Math.floor(Date.now() / 1000),
      transferCount: 0,
    };
    setViewingKeys(prev => [key, ...prev]);
  };

  const handleSend = async () => {
    const amt = parseFloat(amount);
    if (!recipient.trim() || recipient.length < 32) { setFeedback({ type: 'error', msg: 'Enter a valid Solana address.' }); return; }
    if (!amt || amt <= 0) { setFeedback({ type: 'error', msg: 'Enter a valid amount.' }); return; }
    if (!label.trim()) { setFeedback({ type: 'error', msg: 'Label is required.' }); return; }
    if (vault && amt > vault.liquidBalance) {
      setFeedback({ type: 'error', msg: `Insufficient liquid balance ($${vault.liquidBalance.toFixed(2)} available).` }); return;
    }

    setProcessing(true);
    setFeedback(null);

    const vk = generateViewingKey();
    const transferId = generateTransferId();

    const newTransfer: PrivateTransfer = {
      id: transferId,
      recipient: recipient.trim(),
      amountUsd: amt,
      token,
      label: label.trim(),
      viewingKey: vk,
      status: 'shielding',
      createdAt: Math.floor(Date.now() / 1000),
      note: note.trim() || undefined,
    };

    setTransfers(prev => [newTransfer, ...prev]);

    try {
      const res = await fetch('/api/protocol/private-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: recipient.trim(),
          amountUsd: amt,
          token,
          label: label.trim(),
          note: note.trim() || undefined,
          viewingKey: vk,
          wallet: walletAddress,
        }),
      });

      const data = await res.json() as { ok?: boolean; viewingKey?: string; txId?: string; error?: string };

      if (res.ok && data.ok) {
        setTransfers(prev =>
          prev.map(t => t.id === transferId ? { ...t, status: 'complete', viewingKey: data.viewingKey ?? vk } : t)
        );
        setFeedback({ type: 'success', msg: `Private transfer of ${formatUsd(amt)} initiated. Viewing key generated.` });
        setRecipient(''); setAmount(''); setLabel(''); setNote('');
        setTab('history');
      } else {
        setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'failed' } : t));
        setFeedback({ type: 'error', msg: data.error ?? 'Transfer failed.' });
      }
    } catch {
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'failed' } : t));
      setFeedback({ type: 'error', msg: 'Network error. Transfer could not be submitted.' });
    } finally {
      setProcessing(false);
    }
  };

  const completedTransfers = transfers.filter(t => t.status === 'complete');
  const completedTotal = completedTransfers.reduce((s, t) => s + t.amountUsd, 0);

  return (
    <AppShell>
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-4"
      >

        {/* ── Header ── */}
        <motion.div variants={stagger.item}>
          <div
            className="p-5 rounded-xl"
            style={{
              border: '1px solid rgba(167,139,250,0.18)',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.06) 0%, var(--bg-card) 60%)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-10 h-10 shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(167,139,250,0.12)', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.20)' }}
              >
                <LockKeyhole className="w-5 h-5" style={{ color: '#a78bfa' }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <h1 className="text-[15px] font-semibold tracking-tight font-display"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Private Transfers
                  </h1>
                  <Badge variant="private">Cloak SDK</Badge>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Shielded payments with cryptographic viewing keys. Amounts and recipients are hidden from public observers while remaining auditable to authorized parties.
                </p>
                <div className="flex items-center gap-4 mt-3 text-[10px]">
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--green)' }}>
                    <ShieldCheck className="w-3 h-3" />
                    Zero-knowledge shielded transfers
                  </span>
                  <span className="flex items-center gap-1.5" style={{ color: '#a78bfa' }}>
                    <Key className="w-3 h-3" />
                    Viewing key audit trail
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── KPI row ── */}
        <motion.div variants={stagger.item}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Transfers',       value: transfers.length.toString(),           sub: 'All time', color: '#a78bfa' },
              { label: 'Completed',             value: completedTransfers.length.toString(),  sub: `${formatUsd(completedTotal)} sent`, color: 'var(--green)' },
              { label: 'Active Viewing Keys',   value: viewingKeys.length.toString(),         sub: 'For audit access', color: 'var(--teal)' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="card-base p-4">
                <p className="label-metric mb-2">{label}</p>
                <p className="value-lg" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {value}
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                <div className="mt-3 h-px" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Feedback + copied ── */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-[11px]"
                style={
                  feedback.type === 'success'
                    ? { border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.04)', color: 'var(--green)' }
                    : { border: '1px solid rgba(244,63,94,0.18)', background: 'rgba(244,63,94,0.05)', color: 'var(--red)' }
                }
              >
                {feedback.type === 'success'
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                }
                <span className="flex-1">{feedback.msg}</span>
                <button onClick={() => setFeedback(null)} style={{ color: 'var(--text-muted)' }}>×</button>
              </div>
            </motion.div>
          )}
          {copied && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px]"
                style={{ border: '1px solid rgba(167,139,250,0.22)', background: 'rgba(167,139,250,0.06)', color: '#a78bfa' }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Viewing key copied to clipboard
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Tab bar ── */}
        <motion.div variants={stagger.item}>
          <div
            className="flex items-center gap-px p-0.5 rounded-lg w-fit"
            style={{ border: '1px solid var(--border-base)', background: 'var(--bg-overlay)' }}
          >
            {([
              { id: 'send', label: 'Send Private', icon: Send },
              { id: 'keys', label: 'Viewing Keys', icon: Key },
              { id: 'history', label: 'History', icon: History },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 select-none"
                style={{
                  color: tab === id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  background: tab === id ? 'rgba(167,139,250,0.08)' : 'transparent',
                  border: tab === id ? '1px solid rgba(167,139,250,0.16)' : '1px solid transparent',
                  borderRadius: '6px',
                }}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Send form ── */}
        {tab === 'send' && (
          <motion.div variants={stagger.item}>
            <div className="card-base p-5">
              <div className="flex items-center gap-2 mb-4">
                <LockKeyhole className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
                <h2 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Initiate Private Transfer
                </h2>
                <span className="text-[10px]" style={{ color: 'rgba(167,139,250,0.6)' }}>Shielded via Cloak SDK</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label-metric block mb-1.5">Recipient Address</label>
                  <input
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="Solana address (base58)"
                    className="input-base w-full"
                    style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div>
                  <label className="label-metric block mb-1.5">Label</label>
                  <input
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Contractor payroll May"
                    className="input-base w-full"
                    style={{ fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label className="label-metric block mb-1.5">Amount</label>
                  <input
                    type="number"
                    min="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="input-base w-full"
                    style={{ fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label className="label-metric block mb-1.5">Token</label>
                  <select
                    value={token}
                    onChange={e => setToken(e.target.value as 'USDC' | 'USDT' | 'SOL')}
                    className="input-base w-full"
                    style={{ fontSize: '12px' }}
                  >
                    <option value="USDC">USDC</option>
                    <option value="USDT">USDT</option>
                    <option value="SOL">SOL</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label-metric block mb-1.5">Note (optional — encrypted in memo)</label>
                  <input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Internal reference note"
                    className="input-base w-full"
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>

              <div
                className="flex items-start gap-3 mt-4 p-3 rounded-lg text-[11px]"
                style={{
                  border: '1px solid rgba(167,139,250,0.15)',
                  background: 'rgba(167,139,250,0.04)',
                  color: 'var(--text-secondary)',
                }}
              >
                <LockKeyhole className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#a78bfa' }} />
                <span>
                  <strong style={{ color: '#a78bfa' }}>Shielded transfer</strong> — The amount and recipient are hidden from public blockchain observers. A cryptographic viewing key is generated automatically. Share it to grant audit access to specific parties.
                </span>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-4"
                style={{ borderTop: '1px solid var(--border-lo)' }}
              >
                <button
                  onClick={() => void handleSend()}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(167,139,250,0.12)',
                    border: '1px solid rgba(167,139,250,0.25)',
                    color: '#c4b5fd',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.18)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.12)'; }}
                >
                  {processing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Shielding…</>
                    : <><LockKeyhole className="w-3.5 h-3.5" /> Send Privately</>
                  }
                </button>
                <button
                  onClick={() => { setRecipient(''); setAmount(''); setLabel(''); setNote(''); setFeedback(null); }}
                  className="text-[11px] transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Viewing keys ── */}
        {tab === 'keys' && (
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Viewing Keys</h3>
                <button
                  onClick={handleGenerateKey}
                  className="flex items-center gap-1.5 btn-secondary"
                  style={{ fontSize: '11px', padding: '5px 10px' }}
                >
                  <Plus className="w-3 h-3" />
                  Generate Key
                </button>
              </div>

              <div
                className="px-5 py-3 text-[10px]"
                style={{ borderBottom: '1px solid var(--border-lo)', background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
              >
                <Eye className="w-3 h-3 inline mr-1.5" style={{ color: '#a78bfa' }} />
                Viewing keys allow designated auditors to verify transfer amounts and recipients without exposing your full transaction history.
              </div>

              {viewingKeys.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    No viewing keys yet. Generate one to enable audit access.
                  </p>
                </div>
              ) : (
                <div>
                  {viewingKeys.map(record => (
                    <ViewingKeyCard key={record.id} record={record} onCopy={handleCopy} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── History ── */}
        {tab === 'history' && (
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Private Transfer History</h3>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(167,139,250,0.08)',
                    color: '#a78bfa',
                    border: '1px solid rgba(167,139,250,0.18)',
                    borderRadius: '4px',
                  }}
                >
                  {transfers.length} transfers
                </span>
              </div>
              {transfers.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>No private transfers yet.</p>
                </div>
              ) : (
                <div>
                  {transfers.map(t => <TransferRow key={t.id} transfer={t} />)}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Footer info ── */}
        <motion.div variants={stagger.item}>
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-lg text-[10px]"
            style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
          >
            <ShieldCheck className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#a78bfa' }} />
            <span>
              <strong style={{ color: 'var(--text-secondary)' }}>Cloak SDK Integration</strong> — Private transfers use shielded transaction construction. Viewing keys use a derive-on-demand scheme — keys can be issued to auditors without exposing unrelated history. All transfers are logged on-chain with encrypted amounts.{' '}
              <a
                href="https://docs.cloak.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 transition-colors"
                style={{ color: '#a78bfa' }}
              >
                Cloak docs <ExternalLink className="w-3 h-3" />
              </a>
            </span>
          </div>
        </motion.div>

      </motion.div>
    </AppShell>
  );
}
