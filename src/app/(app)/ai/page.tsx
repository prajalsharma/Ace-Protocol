'use client';
import { useState, useRef, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SpendingChart } from '@/components/charts/SpendingChart';
import { useApp } from '@/context/AppContext';
import {
  Cpu, Lightbulb, AlertTriangle, TrendingUp, ShieldCheck,
  Lock, CheckCircle2, Loader2, ChevronRight, X, Send, BrainCircuit, Bot,
} from 'lucide-react';
import { cn, formatUsd } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { CashflowInsight, Vault, ScheduledPayment } from '@/types';

const IMPACT_BADGE_VARIANTS: Record<CashflowInsight['impact'], 'fire' | 'gold' | 'ocean'> = {
  high: 'fire',
  medium: 'gold',
  low: 'ocean',
};

// ─── Treasury Chat Message ────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  reserveImpact?: string;
  model?: string;
}

function TreasuryChatPanel() {
  const { sessionToken } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm ACE, your AI treasury assistant. I can explain your reserve health, forecast runway, analyze payment schedules, and recommend adjustments — all within policy guardrails. What would you like to know?",
      confidence: 1.0,
      reserveImpact: 'No direct impact',
      model: 'ace-v1',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json() as { reply?: string; confidence?: number; reserveImpact?: string; model?: string; error?: string };
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply ?? data.error ?? 'I encountered an issue. Please try again.',
        confidence: data.confidence,
        reserveImpact: data.reserveImpact,
        model: data.model,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please try again.',
      }]);
    }
    setLoading(false);
  };

  const SUGGESTED = ['What is my treasury runway?', 'Is my reserve healthy?', 'Explain upcoming payments', 'Should I deploy to yield?'];

  return (
    <Card>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/[0.10] flex items-center justify-center">
            <Bot className="w-3 h-3 text-amber-400" />
          </div>
          <span className="text-[12px] font-semibold text-white">Treasury Assistant</span>
          <Badge variant="muted">gpt-4.1-mini</Badge>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-emerald-400">
          <Lock className="w-2.5 h-2.5" />
          Policy-bounded
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="p-4 space-y-3 max-h-72 overflow-y-auto">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex gap-2.5', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-md bg-amber-500/[0.08] border border-amber-500/[0.15] flex items-center justify-center shrink-0 mt-0.5">
                <BrainCircuit className="w-3 h-3 text-amber-400/70" />
              </div>
            )}
            <div className={cn(
              'max-w-[80%] rounded-lg px-3 py-2 text-[12px] leading-relaxed',
              msg.role === 'user'
                ? 'bg-white/[0.06] text-white border border-white/[0.08]'
                : 'bg-[#080910] border border-white/[0.05] text-[#c8cae8]',
            )}>
              {msg.content}
              {msg.role === 'assistant' && msg.confidence !== undefined && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/[0.05]">
                  <span className="text-[9px] text-[#4a4d66]">
                    {(msg.confidence * 100).toFixed(0)}% confidence
                  </span>
                  {msg.reserveImpact && (
                    <span className="text-[9px] text-[#4a4d66] truncate">{msg.reserveImpact}</span>
                  )}
                  {msg.model && (
                    <span className="text-[9px] text-[#2e3050] ml-auto">{msg.model}</span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-md bg-amber-500/[0.08] border border-amber-500/[0.15] flex items-center justify-center shrink-0">
              <Loader2 className="w-3 h-3 text-amber-400/70 animate-spin" />
            </div>
            <div className="bg-[#080910] border border-white/[0.05] rounded-lg px-3 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-amber-400/30"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggested */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3">
          {SUGGESTED.map(q => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="text-[10px] px-2.5 py-1 rounded-md border border-white/[0.06] text-[#4a4d66] hover:text-[#8b8fa8] hover:border-white/[0.10] transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 px-4 pb-4">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
          placeholder="Ask about reserve health, runway, payments…"
          disabled={loading}
          className="flex-1 bg-[#07080f] border border-white/[0.07] rounded-lg px-3 py-2 text-[12px] text-white placeholder-[#2e3050] focus:outline-none focus:border-white/[0.14] disabled:opacity-50 transition-colors"
        />
        <Button size="sm" onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        </Button>
      </div>
    </Card>
  );
}

export default function AIPage() {
  const { insights, dismissInsight, isLoading, vault, payments } = useApp();

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">

        {/* ── Page header ── */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0b0c17] p-5">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-amber-500/[0.10] flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white tracking-tight mb-1">AI Crew</h2>
              <p className="text-[11px] text-[#4a4d66] leading-relaxed">
                Cashflow intelligence that recommends actions within your policy guardrails.
                The crew never moves funds without your authorization.
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] text-emerald-400">All actions bounded by policy constraints</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Guardrails ── */}
        <Card>
          <div className="px-5 py-3.5 border-b border-white/[0.05]">
            <h3 className="text-[10px] font-semibold text-[#3a3e5e] uppercase tracking-[0.14em]">Active Guardrails</h3>
          </div>
          <div className="p-4 grid sm:grid-cols-2 gap-2">
            {[
              { label: 'Min reserve ratio',       value: '15%',      desc: 'Reserve never drops below this' },
              { label: 'Max yield allocation',     value: '80%',      desc: 'Capital ceiling for yield strategies' },
              { label: 'Max rebalance per action', value: '15%',      desc: 'Single-step shift limit' },
              { label: 'Manual approval above',    value: '$500',     desc: 'Requires your confirmation' },
              { label: 'Max execution cost',       value: '$2.00',    desc: 'Skip action if fees too high' },
              { label: 'Oracle staleness limit',   value: '10 slots', desc: 'Reject stale price data' },
            ].map(({ label, value, desc }) => (
              <div key={label} className="flex items-start gap-2.5 p-3 rounded-lg border border-white/[0.05] bg-[#080910]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white leading-snug">{label}</p>
                  <p className="text-[10px] text-[#4a4d66] mt-0.5">{desc}</p>
                </div>
                <span className="text-[11px] font-bold text-amber-400 font-mono shrink-0">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Insights ── */}
        <Card>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <h3 className="text-[10px] font-semibold text-[#3a3e5e] uppercase tracking-[0.14em]">Active Recommendations</h3>
            <Badge variant={insights.length > 0 ? 'fire' : 'muted'}>{insights.length}</Badge>
          </div>
          <div className="p-4 space-y-2">
            {insights.length === 0 && (
              <div className="text-center py-6">
                <CheckCircle2 className="w-6 h-6 text-emerald-500/30 mx-auto mb-2" />
                <p className="text-[11px] text-[#4a4d66]">All clear. No active recommendations.</p>
              </div>
            )}
            {insights.map(insight => {
              const iconConfig = {
                recommendation: { icon: Lightbulb,     color: 'text-amber-400',   bg: 'bg-amber-500/[0.08]' },
                alert:          { icon: AlertTriangle,  color: 'text-red-400',     bg: 'bg-red-500/[0.08]' },
                prediction:     { icon: TrendingUp,     color: 'text-emerald-400', bg: 'bg-emerald-500/[0.08]' },
              };
              const cfg = iconConfig[insight.type] ?? iconConfig.recommendation;
              const Icon = cfg.icon;

              return (
                <div key={insight.id} className="rounded-lg border border-white/[0.05] p-3">
                  <div className="flex items-start gap-2.5">
                    <div className={cn('w-6 h-6 rounded-md flex items-center justify-center shrink-0', cfg.bg)}>
                      <Icon className={cn('w-3 h-3', cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[12px] font-semibold text-white leading-snug">{insight.title}</p>
                        <button onClick={() => dismissInsight(insight.id)} className="text-[#2e3050] hover:text-[#4a4d66] shrink-0 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-[#4a4d66] mt-0.5 leading-relaxed">{insight.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={IMPACT_BADGE_VARIANTS[insight.impact]}>{insight.impact} impact</Badge>
                        <span className="text-[10px] text-[#2e3050]">{(insight.confidence * 100).toFixed(0)}% confidence</span>
                        {insight.action && (
                          <Button size="sm" variant="ghost" className="ml-auto text-[10px] py-1 h-auto">
                            {insight.action.label} <ChevronRight className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Spending forecast ── */}
        <Card>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
            <h3 className="text-[10px] font-semibold text-[#3a3e5e] uppercase tracking-[0.14em]">Spending Forecast — 6 Months</h3>
            <Badge variant="muted">AI model</Badge>
          </div>
          <div className="p-4">
            <SpendingChart />
            <div className="flex items-center gap-4 mt-3 text-[10px] text-[#4a4d66]">
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-amber-500 inline-block" />Actual</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-amber-500/30 inline-block" />Predicted</div>
            </div>
          </div>
        </Card>

        {/* ── Treasury AI Chat ── */}
        <TreasuryChatPanel />

        {/* ── Policy engine ── */}
        <PolicyEnginePanel vault={vault} payments={payments} />
      </div>
    </AppShell>
  );
}

const PANEL_NOW_SEC = Math.floor(Date.now() / 1000);

function PolicyEnginePanel({ vault, payments }: { vault: Vault | null; payments: ScheduledPayment[] }) {
  const now = PANEL_NOW_SEC;
  const upcoming7d = payments.filter(p => p.status === 'scheduled' && p.nextDue < now + 7 * 86400);
  const upcoming1d = payments.filter(p => p.status === 'scheduled' && p.nextDue < now + 86400);
  const totalDue7d = upcoming7d.reduce((s, p) => s + p.amountUsd, 0);
  const reserveRatio = vault && vault.totalDeposited > 0
    ? (vault.reserveBalance / vault.totalDeposited) * 100
    : null;
  const hasLowReserve = reserveRatio !== null && reserveRatio < 15;
  const hasHighPressure = upcoming1d.length > 0;

  const rows = [
    {
      label: 'Cashflow classification',
      status: 'active' as const,
      detail: payments.length > 0
        ? `${payments.filter(p => p.recurrence !== 'once').length} recurring · ${payments.filter(p => p.recurrence === 'once').length} one-time`
        : 'No payments scheduled yet',
    },
    {
      label: 'Payment pressure detection',
      status: upcoming7d.length > 0 ? 'active' as const : 'standby' as const,
      detail: upcoming7d.length > 0
        ? `${formatUsd(totalDue7d)} due within 7 days (${upcoming7d.length} payment${upcoming7d.length !== 1 ? 's' : ''})`
        : 'No payments due within 7 days',
    },
    {
      label: 'Reserve coverage check',
      status: 'active' as const,
      detail: reserveRatio !== null
        ? `${reserveRatio.toFixed(1)}% reserve ratio — ${hasLowReserve ? 'below 15% threshold' : 'healthy'}`
        : 'No vault data yet',
    },
    {
      label: 'Execution cost monitor',
      status: 'active' as const,
      detail: hasHighPressure
        ? 'Urgent payments detected — executing immediately, no batching'
        : 'Batching window open for next eligible action',
    },
    {
      label: 'Yield opportunity scanner',
      status: vault && vault.yieldBalance > 0 ? 'active' as const : 'standby' as const,
      detail: vault && vault.yieldBalance > 0
        ? `${formatUsd(vault.yieldBalance)} in yield strategies at ${vault.apy}% APY`
        : 'No yield allocation active yet',
    },
    {
      label: 'Emergency circuit breaker',
      status: 'standby' as const,
      detail: hasLowReserve
        ? 'Reserve below threshold — optional deployments paused'
        : 'No anomalies detected',
    },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-white/[0.05]">
        <h3 className="text-[10px] font-semibold text-[#3a3e5e] uppercase tracking-[0.14em]">Policy Engine</h3>
      </div>
      <div className="divide-y divide-white/[0.03]">
        {rows.map(({ label, status, detail }) => (
          <div key={label} className="flex items-center gap-3 px-5 py-3">
            <div className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-[#2e3050]',
            )} />
            <div className="flex-1 min-w-0">
              <span className="text-[12px] text-[#c8cae8]">{label}</span>
              <p className="text-[10px] text-[#4a4d66] mt-0.5">{detail}</p>
            </div>
            <Badge variant={status === 'active' ? 'success' : 'muted'}>{status}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
