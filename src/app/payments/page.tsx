'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd, formatTimestamp, formatShortAddress, formatRelativeTime } from '@/lib/utils';
import { Plus, Calendar, CheckCircle2, Clock, XCircle, Loader2, Repeat, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduledPayment } from '@/types';

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: 'success' | 'gold' | 'ocean' | 'danger' | 'muted' }> = {
  scheduled:  { label: 'Scheduled',  icon: Clock,         variant: 'ocean' },
  executing:  { label: 'Executing',  icon: Loader2,       variant: 'gold' },
  completed:  { label: 'Completed',  icon: CheckCircle2,  variant: 'success' },
  failed:     { label: 'Failed',     icon: XCircle,       variant: 'danger' },
};

const recurrenceLabel: Record<string, string> = {
  once: 'One-time', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
};

export default function PaymentsPage() {
  const { payments, isLoading } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newRecipient, setNewRecipient] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<'once' | 'monthly'>('monthly');

  const upcoming = payments.filter(p => p.status === 'scheduled');
  const completed = payments.filter(p => p.status === 'completed');
  const totalUpcoming = upcoming.reduce((s, p) => s + p.amountUsd, 0);

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Upcoming payments', value: upcoming.length.toString(), sub: `${formatUsd(totalUpcoming)} total` },
            { label: 'Completed this month', value: completed.length.toString(), sub: `${formatUsd(completed.reduce((s, p) => s + p.amountUsd, 0))} sent` },
            { label: 'Next due', value: upcoming.length > 0 ? formatRelativeTime(Math.min(...upcoming.map(p => p.nextDue))) : '—', sub: 'Earliest payment' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="rounded-xl border border-[#2a2a3a] bg-[#13131a] p-4">
              <p className="text-xs text-gray-600 uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold text-white mt-1">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* New payment */}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setShowNew(!showNew)}>
            <Plus className="w-3.5 h-3.5" /> Schedule Payment
          </Button>
        </div>

        {showNew && (
          <Card>
            <CardHeader><CardTitle>New Scheduled Payment</CardTitle></CardHeader>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Label</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Crew Server Bill"
                  className="w-full bg-[#0f0f16] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Recipient Wallet</label>
                <input value={newRecipient} onChange={e => setNewRecipient(e.target.value)} placeholder="Solana address"
                  className="w-full bg-[#0f0f16] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 font-mono" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Amount (USDC)</label>
                <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0.00"
                  className="w-full bg-[#0f0f16] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Recurrence</label>
                <select value={newRecurrence} onChange={e => setNewRecurrence(e.target.value as any)}
                  className="w-full bg-[#0f0f16] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50">
                  <option value="once">One-time</option>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => setShowNew(false)}>Schedule</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
            </div>
          </Card>
        )}

        {/* Upcoming payments */}
        <Card>
          <CardHeader>
            <CardTitle>Scheduled Payments</CardTitle>
            <Badge variant="ocean">{upcoming.length}</Badge>
          </CardHeader>
          <div className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-6">No upcoming payments.</p>
            )}
            {upcoming.map(p => <PaymentRow key={p.id} payment={p} />)}
          </div>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
            <Badge variant="success">{completed.length}</Badge>
          </CardHeader>
          <div className="space-y-2">
            {completed.map(p => <PaymentRow key={p.id} payment={p} />)}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function PaymentRow({ payment }: { payment: ScheduledPayment }) {
  const cfg = statusConfig[payment.status];
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-[#2a2a3a] bg-[#0f0f16] hover:border-[#3a3a4a] transition-all">
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <Calendar className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{payment.label}</p>
        <p className="text-xs text-gray-600 font-mono">{formatShortAddress(payment.recipient)}</p>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <p className="text-sm font-bold text-white">{formatUsd(payment.amountUsd)}</p>
        <div className="flex items-center gap-1 justify-end">
          <Repeat className="w-3 h-3 text-gray-600" />
          <span className="text-[10px] text-gray-600">{recurrenceLabel[payment.recurrence]}</span>
        </div>
      </div>
      <div className="text-right shrink-0 space-y-1">
        <Badge variant={cfg.variant}>
          <Icon className="w-3 h-3 mr-1" />
          {cfg.label}
        </Badge>
        <p className="text-[10px] text-gray-600">
          {payment.status === 'completed'
            ? formatTimestamp(payment.executedAt!)
            : `Due ${formatRelativeTime(payment.nextDue)}`}
        </p>
      </div>
    </div>
  );
}

const recurrenceLabel: Record<string, string> = {
  once: 'One-time', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
};
