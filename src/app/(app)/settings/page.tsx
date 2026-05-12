'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd } from '@/lib/utils';
import {
  Shield, Bot, Bell, Wallet, LogOut,
  CheckCircle2, AlertTriangle, Save, Info, Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { OperationMode, RiskLevel } from '@/types';

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.055 } } },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

/* ── Section header ──────────────────────────────────────────────────────────── */
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="px-7 py-5" style={{ borderBottom: '1px solid var(--border-base)' }}>
      <h3 className="text-[16px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
        {title}
      </h3>
      {sub && <p className="text-[13px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { vault, walletAddress, updateVault, disconnectWallet } = useApp();

  const [operationMode, setOperationMode] = useState<OperationMode>(vault?.operationMode ?? 'safe');
  const [aiPaymentCap, setAiPaymentCap] = useState(vault?.aiPaymentCapUsd?.toString() ?? '500');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(vault?.riskLevel ?? 'balanced');
  const [reserveTarget, setReserveTarget] = useState(vault?.allocation.reserve?.toString() ?? '20');
  const [yieldTarget, setYieldTarget] = useState(vault?.allocation.yield?.toString() ?? '60');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!vault) return;
    setSaving(true);
    const cap = parseFloat(aiPaymentCap);
    const reserve = parseFloat(reserveTarget);
    const yieldPct = parseFloat(yieldTarget);

    if (isNaN(cap) || cap <= 0 || cap > 10000) { alert('Payment cap must be between $1 and $10,000.'); setSaving(false); return; }
    if (isNaN(reserve) || reserve < 5 || reserve > 50) { alert('Reserve target must be between 5% and 50%.'); setSaving(false); return; }
    if (isNaN(yieldPct) || yieldPct < 0 || yieldPct > 85) { alert('Yield target must be between 0% and 85%.'); setSaving(false); return; }
    if (reserve + yieldPct > 95) { alert('Reserve + yield cannot exceed 95%.'); setSaving(false); return; }

    const liquid = Math.max(5, 100 - reserve - yieldPct - (vault.allocation.payments ?? 5));
    updateVault({ operationMode, aiPaymentCapUsd: cap, riskLevel, allocation: { reserve, yield: yieldPct, liquid, payments: vault.allocation.payments ?? 5 } });

    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }, 600);
  };

  return (
    <AppShell>
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-3xl mx-auto space-y-6"
      >

        {/* ── Header ── */}
        <motion.div variants={stagger.item}>
          <h1 className="text-[28px] font-bold tracking-[-0.04em]"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            Settings
          </h1>
          <p className="text-[15px] mt-2 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
            Treasury policy, operation mode, and account preferences
          </p>
        </motion.div>

        {/* ── Save feedback ── */}
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="flex items-center gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
              style={{ border: '1px solid rgba(34,197,94,0.22)', background: 'rgba(34,197,94,0.06)', color: 'var(--green)' }}
            >
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              Settings saved successfully.
            </div>
          </motion.div>
        )}

        {/* ── Operation Mode ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <SectionHead
              title="Operation Mode"
              sub="Choose how ACE handles payment execution — you always retain override authority."
            />
            <div className="p-6 grid sm:grid-cols-2 gap-4">
              {([
                {
                  id: 'safe' as const,
                  label: 'Safe Mode',
                  description: 'AI recommends, you approve every execution. Nothing runs without your sign-off.',
                  icon: Shield,
                  color: 'var(--green)',
                  recommended: true,
                },
                {
                  id: 'autopilot' as const,
                  label: 'Autopilot',
                  description: 'AI executes within whitelisted addresses, spending caps, and reserve limits you define.',
                  icon: Bot,
                  color: 'var(--teal)',
                  recommended: false,
                },
              ] as const).map(({ id, label, description, icon: Icon, color, recommended }) => {
                const isActive = operationMode === id;
                return (
                  <button
                    key={id}
                    onClick={() => setOperationMode(id)}
                    className="rounded-[16px] p-6 text-left transition-all"
                    style={{
                      border: isActive
                        ? `1px solid color-mix(in srgb, ${color} 32%, transparent)`
                        : '1px solid var(--border-base)',
                      background: isActive ? `color-mix(in srgb, ${color} 7%, transparent)` : 'rgba(255,255,255,0.015)',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-hi)'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)'; }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-10 h-10 flex items-center justify-center"
                        style={{
                          background: `color-mix(in srgb, ${color} 12%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${color} 26%, transparent)`,
                          borderRadius: '10px',
                        }}
                      >
                        <Icon className="w-4.5 h-4.5" style={{ color, width: 18, height: 18 }} />
                      </div>
                      <span className="text-[15px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--text-primary)' }}>{label}</span>
                      {recommended && (
                        <span
                          className="text-[11px] px-2 py-0.5 font-semibold rounded-full"
                          style={{
                            background: 'rgba(34,197,94,0.09)',
                            color: 'var(--green)',
                            border: '1px solid rgba(34,197,94,0.18)',
                          }}
                        >
                          recommended
                        </span>
                      )}
                    </div>
                    <p className="text-[13.5px] leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>{description}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full border-2 transition-all"
                        style={isActive
                          ? { borderColor: color, background: color }
                          : { borderColor: 'var(--border-base)', background: 'transparent' }
                        }
                      />
                      <span className="text-[12px] font-medium" style={{ color: isActive ? color : 'var(--text-muted)' }}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {operationMode === 'autopilot' && (
              <div
                className="mx-6 mb-6 flex items-start gap-3 p-4 rounded-xl text-[13.5px]"
                style={{
                  border: '1px solid rgba(45,212,191,0.20)',
                  background: 'rgba(45,212,191,0.05)',
                  color: 'rgba(45,212,191,0.85)',
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                Autopilot will execute payments automatically. Ensure spending caps and destination whitelists are correctly configured before enabling.
              </div>
            )}
          </div>
        </motion.div>

        {/* ── AI Spending Controls ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <SectionHead
              title="AI Spending Controls"
              sub="Hard caps enforced on-chain. AI cannot exceed these limits without manual approval."
            />
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[13px] font-semibold uppercase tracking-[0.08em] mb-3"
                  style={{ color: 'var(--text-tertiary)' }}>
                  Max AI payment cap — per execution cycle
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-medium"
                      style={{ color: 'var(--text-tertiary)' }}
                    >$</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={aiPaymentCap}
                      onChange={e => setAiPaymentCap(e.target.value)}
                      className="input-base"
                      style={{ width: 160, paddingLeft: '28px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>USDC equivalent</span>
                </div>
                <p className="text-[13px] mt-2.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  AI will not execute payments exceeding this amount without manual approval.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[100, 250, 500, 1000, 2500].map(val => (
                  <button
                    key={val}
                    onClick={() => setAiPaymentCap(val.toString())}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                    style={{
                      border: aiPaymentCap === val.toString()
                        ? '1px solid rgba(45,212,191,0.32)'
                        : '1px solid var(--border-base)',
                      background: aiPaymentCap === val.toString() ? 'rgba(45,212,191,0.09)' : 'transparent',
                      color: aiPaymentCap === val.toString() ? 'var(--teal)' : 'var(--text-muted)',
                    }}
                  >
                    {formatUsd(val, 0)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Risk & Allocation ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <SectionHead
              title="Risk & Allocation Policy"
              sub="Define how treasury capital is split across reserve, yield, and liquid buckets."
            />
            <div className="p-6 space-y-6">
              {/* Risk level */}
              <div>
                <label className="block text-[13px] font-semibold uppercase tracking-[0.08em] mb-3"
                  style={{ color: 'var(--text-tertiary)' }}>
                  Risk tolerance
                </label>
                <div className="flex gap-3">
                  {(['conservative', 'balanced', 'aggressive'] as RiskLevel[]).map(r => {
                    const color = r === 'conservative' ? 'var(--blue)' : r === 'balanced' ? 'var(--green)' : 'var(--red)';
                    const isActive = riskLevel === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setRiskLevel(r)}
                        className="flex-1 py-2.5 rounded-lg text-[13.5px] font-semibold capitalize transition-all"
                        style={{
                          border: isActive
                            ? `1px solid color-mix(in srgb, ${color} 32%, transparent)`
                            : '1px solid var(--border-base)',
                          background: isActive ? `color-mix(in srgb, ${color} 9%, transparent)` : 'transparent',
                          color: isActive ? color : 'var(--text-muted)',
                        }}
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Allocation inputs */}
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-semibold uppercase tracking-[0.08em] mb-3"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Reserve target (%)
                  </label>
                  <input
                    type="number" min="5" max="50"
                    value={reserveTarget}
                    onChange={e => setReserveTarget(e.target.value)}
                    className="input-base w-full"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <p className="text-[12.5px] mt-2" style={{ color: 'var(--text-muted)' }}>
                    Min: 5% · Recommended: 15–25%
                  </p>
                </div>
                <div>
                  <label className="block text-[13px] font-semibold uppercase tracking-[0.08em] mb-3"
                    style={{ color: 'var(--text-tertiary)' }}>
                    Yield target (%)
                  </label>
                  <input
                    type="number" min="0" max="85"
                    value={yieldTarget}
                    onChange={e => setYieldTarget(e.target.value)}
                    className="input-base w-full"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <p className="text-[12.5px] mt-2" style={{ color: 'var(--text-muted)' }}>
                    Capital allocated to yield strategies
                  </p>
                </div>
              </div>

              <div
                className="flex items-start gap-3 p-4 rounded-xl text-[13px] leading-relaxed"
                style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
              >
                <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'rgba(45,212,191,0.55)', width: 16, height: 16 }} />
                Reserve + Yield + Liquid + Payments = 100%. Liquid and payment buckets are auto-calculated from remaining allocation.
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Account ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <SectionHead title="Account" sub="Connected wallet, network, and notification preferences." />
            <div className="p-6 space-y-3">
              {[
                {
                  icon: Wallet,
                  label: 'Connected wallet',
                  value: walletAddress ?? 'Not connected',
                  mono: true,
                  badge: <Badge variant="success">Active</Badge>,
                  color: 'var(--teal)',
                },
                {
                  icon: Zap,
                  label: 'Network',
                  value: 'Solana Devnet · Non-custodial',
                  mono: false,
                  badge: <Badge variant="muted">Devnet</Badge>,
                  color: 'var(--blue)',
                },
                {
                  icon: Bell,
                  label: 'Notifications',
                  value: 'Payment alerts, reserve warnings',
                  mono: false,
                  badge: <Badge variant="muted">In-app</Badge>,
                  color: '#a78bfa',
                },
              ].map(({ icon: Icon, label, value, mono, badge, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-4 p-4 rounded-xl transition-colors"
                  style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${color} 11%, transparent)`, borderRadius: '10px' }}
                  >
                    <Icon className="w-4.5 h-4.5" style={{ color, width: 18, height: 18 }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold tracking-[-0.01em]" style={{ color: 'var(--text-primary)' }}>{label}</p>
                    <p
                      className="text-[13px] mt-0.5 truncate"
                      style={{ color: 'var(--text-tertiary)', fontFamily: mono ? 'var(--font-mono)' : undefined }}
                    >
                      {value}
                    </p>
                  </div>
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Actions ── */}
        <motion.div variants={stagger.item}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={saving || !vault}
              className="btn-primary flex items-center gap-2 disabled:opacity-40"
            >
              {saving
                ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Settings</>
              }
            </button>
            <button
              onClick={() => {
                setOperationMode(vault?.operationMode ?? 'safe');
                setAiPaymentCap(vault?.aiPaymentCapUsd?.toString() ?? '500');
              }}
              className="btn-secondary flex items-center gap-2"
            >
              Reset
            </button>
            <div className="flex-1" />
            <button
              onClick={() => void disconnectWallet()}
              className="flex items-center gap-2 text-[14px] font-medium px-4 py-2.5 rounded-xl transition-all"
              style={{
                border: '1px solid rgba(244,63,94,0.22)',
                color: 'var(--red)',
                background: 'transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.07)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        </motion.div>

      </motion.div>
    </AppShell>
  );
}
