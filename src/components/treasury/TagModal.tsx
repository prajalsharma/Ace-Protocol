'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, CheckCircle2 } from 'lucide-react';
import type { MainnetTransaction, RecurringPattern, TagRequest, TxCategory, UserTag } from '@/types';

const TAG_OPTIONS: Array<{ value: UserTag['tag']; label: string; color: string }> = [
  { value: 'payroll',           label: 'Payroll',              color: '#10b981' },
  { value: 'infrastructure',    label: 'Infrastructure',       color: '#6366f1' },
  { value: 'subscription',      label: 'Subscription',         color: '#8b5cf6' },
  { value: 'saas',              label: 'SaaS',                 color: '#a78bfa' },
  { value: 'contractor',        label: 'Contractor Payment',   color: '#f59e0b' },
  { value: 'trading',           label: 'Trading',              color: '#0ea5e9' },
  { value: 'treasury_transfer', label: 'Treasury Transfer',    color: '#f4a935' },
  { value: 'exchange_deposit',  label: 'Exchange Deposit',     color: '#fb7185' },
  { value: 'ai_infrastructure', label: 'AI Infrastructure',    color: '#9d5cff' },
  { value: 'protocol_operation',label: 'Protocol Operation',   color: '#2dd4bf' },
  { value: 'recurring_bill',    label: 'Recurring Bill',       color: '#f97316' },
  { value: 'internal',          label: 'Internal Transfer',    color: '#64748b' },
  { value: 'ignore',            label: 'Ignore / Noise',       color: '#374151' },
];

interface TagModalProps {
  item: MainnetTransaction | RecurringPattern | null;
  onClose: () => void;
  onSubmit: (req: TagRequest) => Promise<void>;
}

export function TagModal({ item, onClose, onSubmit }: TagModalProps) {
  const [selected, setSelected] = useState<UserTag['tag'] | null>(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!item) return null;

  const isTx = 'signature' in item;
  const displayAddress = isTx
    ? (item.counterparty?.slice(0, 8) + '...' + item.counterparty?.slice(-4))
    : (item.counterpartyAddress?.slice(0, 8) + '...' + item.counterpartyAddress?.slice(-4));

  const amountText = isTx
    ? (item.amountUsd ? `$${item.amountUsd.toFixed(2)}` : item.amountSol ? `${item.amountSol.toFixed(4)} SOL` : '')
    : `avg $${item.avgAmountUsd.toFixed(2)} every ${item.frequencyDays.toFixed(0)}d`;

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const req: TagRequest = {
        tag: selected,
        label: label || undefined,
        note: note || undefined,
      };
      if (isTx) req.txSignature = item.signature;
      else req.targetAddress = item.counterpartyAddress;

      await onSubmit(req);
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md rounded-2xl border border-[#1c1d2e] bg-[#0a0b15] p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-[#9d5cff]" />
                <span className="text-[13px] font-semibold text-white">What was this payment for?</span>
              </div>
              <p className="text-[11px] text-[#54566e]">
                {displayAddress} · {amountText}
              </p>
              {!isTx && (
                <p className="text-[11px] text-amber-400/70 mt-1">
                  This will tag all {item.sampleCount} transactions from this address.
                </p>
              )}
            </div>
            <button onClick={onClose} className="text-[#3a3c55] hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-sm text-white font-medium">Tag saved</p>
              <p className="text-[11px] text-[#54566e]">Future predictions will improve with this label.</p>
            </div>
          ) : (
            <>
              {/* Tag grid */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {TAG_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelected(opt.value)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: selected === opt.value ? opt.color + '60' : '#1c1d2e',
                      background: selected === opt.value ? opt.color + '14' : 'transparent',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: opt.color }}
                    />
                    <span className="text-[11px] font-medium" style={{ color: selected === opt.value ? opt.color : '#54566e' }}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Label + Note */}
              {selected && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 mb-4"
                >
                  <input
                    type="text"
                    placeholder="Friendly name (e.g. Netlify hosting)"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#1c1d2e] bg-[#0e0f1a] text-[12px] text-white placeholder:text-[#3a3c55] focus:outline-none focus:border-[#9d5cff]/50"
                  />
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#1c1d2e] bg-[#0e0f1a] text-[12px] text-white placeholder:text-[#3a3c55] focus:outline-none focus:border-[#9d5cff]/50"
                  />
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-xl border border-[#1c1d2e] text-[12px] text-[#54566e] hover:text-white hover:border-[#2a2c40] transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selected || submitting}
                  className="flex-1 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-40"
                  style={{
                    background: selected ? '#9d5cff22' : '#1c1d2e',
                    color: selected ? '#c4a8ff' : '#3a3c55',
                    border: `1px solid ${selected ? '#9d5cff40' : '#1c1d2e'}`,
                  }}
                >
                  {submitting ? 'Saving…' : 'Save Tag'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
