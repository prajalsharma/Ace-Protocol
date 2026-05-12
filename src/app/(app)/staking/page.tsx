'use client';
import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd, formatPercent } from '@/lib/utils';
import { appendLog } from '@/lib/activityLog';
import {
  TrendingUp, Zap, Loader2, AlertTriangle, CheckCircle2,
  ExternalLink, RefreshCw, ShieldCheck, Info, Sparkles,
  ArrowRight, DollarSign, Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Connection, PublicKey, SystemProgram, Transaction,
  LAMPORTS_PER_SOL, clusterApiUrl,
} from '@solana/web3.js';
import { useSolanaWallets } from '@privy-io/react-auth';
import type { StakingProvider, StakeRecommendation } from '@/lib/staking/stakingProviders';

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl('devnet');
const PROGRAM_ID = 'DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY';
const EXPLORER = 'https://explorer.solana.com';

interface StakingData {
  providers: StakingProvider[];
  recommendations: StakeRecommendation[];
  idleYieldUsd: number;
  solPriceUsd: number;
  lastUpdated: number;
}

const PROVIDER_COLOR: Record<string, string> = {
  jito: '#38bdf8',
  hylo: '#a78bfa',
};

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

// ── Stake Confirm Modal ───────────────────────────────────────────────────────
function StakeModal({
  provider,
  rec,
  onClose,
  onConfirm,
  isStaking,
  result,
}: {
  provider: StakingProvider;
  rec: StakeRecommendation;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  isStaking: boolean;
  result: { ok: boolean; txId?: string; txSig?: string; reason?: string } | null;
}) {
  const [customAmt, setCustomAmt] = useState(rec.allocateUsd.toFixed(2));
  const color = PROVIDER_COLOR[provider.id] ?? 'var(--teal)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
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
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-base)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center"
              style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, borderRadius: '8px' }}
            >
              <TrendingUp className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              Stake with {provider.name}
            </span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Provider summary */}
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: 'var(--bg-overlay)', border: `1px solid ${color}22` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {provider.name}
              </span>
              <span className="text-[20px] font-bold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
                {provider.apy.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--text-muted)' }}>Token received</span>
              <span style={{ color: 'var(--text-secondary)' }}>{provider.tokenSymbol}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--text-muted)' }}>Risk score</span>
              <span style={{ color: 'var(--text-secondary)' }}>{provider.riskScore}/10</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--text-muted)' }}>Lockup</span>
              <span style={{ color: 'var(--green)' }}>{provider.isLiquid ? 'None (liquid)' : `${provider.lockupDays} days`}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--text-muted)' }}>TVL</span>
              <span style={{ color: 'var(--text-secondary)' }}>${(provider.tvlUsd / 1_000_000).toFixed(0)}M</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="label-metric block mb-1.5">Stake Amount (USD from yield balance)</label>
            <input
              type="number"
              value={customAmt}
              onChange={e => setCustomAmt(e.target.value)}
              className="input-base w-full"
              style={{ fontSize: '14px', fontFamily: 'var(--font-mono)' }}
              min={provider.minStakeUsd}
            />
          </div>

          {/* Projection */}
          {parseFloat(customAmt) > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Monthly yield', value: formatUsd((parseFloat(customAmt) * provider.apy) / 100 / 12) },
                { label: 'Annual yield', value: formatUsd((parseFloat(customAmt) * provider.apy) / 100) },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-lg text-center"
                  style={{ background: `color-mix(in srgb, ${color} 6%, transparent)`, border: `1px solid ${color}18` }}
                >
                  <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="text-[16px] font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 text-[10px] p-3 rounded-lg"
            style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
          >
            <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--teal)', opacity: 0.7 }} />
            Devnet: A marker SOL transfer is sent on-chain to prove execution capability. On Mainnet, ACE submits the {provider.name} staking instruction on your behalf.
          </div>

          {/* Result */}
          {result && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-[11px]"
              style={result.ok
                ? { border: '1px solid rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.06)', color: 'var(--green)' }
                : { border: '1px solid rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.06)', color: 'var(--red)' }
              }
            >
              {result.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <p>{result.ok ? `Staked successfully via ${provider.name}.` : (result.reason ?? 'Staking failed.')}</p>
                {result.txSig && (
                  <a href={`${EXPLORER}/tx/${result.txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 underline underline-offset-2 text-[10px]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {result.txSig.slice(0, 24)}… <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {!result && (
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="btn-secondary flex-1" style={{ fontSize: '12px', padding: '10px' }}>
              Cancel
            </button>
            <button
              disabled={isStaking || parseFloat(customAmt) <= 0}
              onClick={() => onConfirm(parseFloat(customAmt))}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ fontSize: '12px', padding: '10px', background: color, color: '#000' }}
            >
              {isStaking
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Staking…</>
                : <><TrendingUp className="w-3.5 h-3.5" /> Stake Now</>
              }
            </button>
          </div>
        )}
        {result && (
          <div className="px-6 pb-6">
            <button onClick={onClose} className="btn-secondary w-full" style={{ fontSize: '12px', padding: '10px' }}>Close</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StakingPage() {
  const { vault, sessionToken, refreshVault } = useApp();
  const { wallets: solanaWallets } = useSolanaWallets();
  const solanaWallet = solanaWallets[0] ?? null;

  const [data, setData] = useState<StakingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedRec, setSelectedRec] = useState<{ provider: StakingProvider; rec: StakeRecommendation } | null>(null);
  const [isStaking, setIsStaking] = useState(false);
  const [stakeResult, setStakeResult] = useState<{ ok: boolean; txId?: string; txSig?: string; reason?: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!sessionToken) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/protocol/staking', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error('Failed to load staking data');
      setData(await res.json() as StakingData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleStake = useCallback(async (amountUsd: number) => {
    if (!selectedRec || !solanaWallet || !sessionToken) return;
    setIsStaking(true);
    setStakeResult(null);

    try {
      const connection = new Connection(RPC, 'confirmed');
      const ownerPubkey = new PublicKey(solanaWallet.address);
      const solPrice = data?.solPriceUsd ?? 148;
      const lamports = Math.ceil((amountUsd / solPrice) * LAMPORTS_PER_SOL);

      // Derive vault PDA as marker destination
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), ownerPubkey.toBuffer()],
        new PublicKey(PROGRAM_ID),
      );

      const balance = await connection.getBalance(ownerPubkey);
      if (balance < lamports + 10_000) {
        setStakeResult({ ok: false, reason: `Insufficient devnet SOL. Need ≈${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.` });
        return;
      }

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: ownerPubkey })
        .add(SystemProgram.transfer({ fromPubkey: ownerPubkey, toPubkey: vaultPda, lamports }));

      const txSig = await solanaWallet.sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');

      // Record in backend
      const backendRes = await fetch('/api/protocol/staking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ provider: selectedRec.provider.id, amountUsd, devnetTxSig: txSig }),
      });
      const backendData = await backendRes.json() as { ok?: boolean; txId?: string };

      appendLog({
        type: 'yield',
        message: `Staked ${formatUsd(amountUsd)} with ${selectedRec.provider.name}`,
        detail: `${selectedRec.provider.apy.toFixed(1)}% APY · ${selectedRec.provider.tokenSymbol} · Tx: ${txSig.slice(0, 20)}…`,
      });

      setStakeResult({ ok: true, txSig, txId: backendData.txId });
      refreshVault();
      void fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Staking failed';
      const isRejected = msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('cancelled');
      setStakeResult({ ok: false, reason: isRejected ? 'Transaction cancelled.' : msg });
    } finally {
      setIsStaking(false);
    }
  }, [selectedRec, solanaWallet, sessionToken, data, refreshVault, fetchData]);

  const providers = data?.providers ?? [];
  const recommendations = data?.recommendations ?? [];
  const idleYield = data?.idleYieldUsd ?? vault?.yieldBalance ?? 0;

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
                  Staking Intelligence
                </h1>
                <Badge variant="muted">Hylo + Jito</Badge>
              </div>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                ACE recommends where to deploy idle yield capital for optimal returns
              </p>
            </div>
            <button onClick={fetchData} disabled={isLoading} className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          </div>
        </motion.div>

        {/* ── Idle capital banner ── */}
        {idleYield > 0 && (
          <motion.div variants={stagger.item}>
            <div className="card-hero p-5">
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div>
                  <p className="label-metric mb-2">Idle Yield Capital</p>
                  <p className="value-xl" style={{ color: 'var(--text-primary)' }}>
                    {formatUsd(idleYield)}
                  </p>
                  <p className="text-[12px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Not currently earning yield — ACE recommends deploying this capital
                  </p>
                </div>
                {recommendations.length > 0 && (
                  <div className="flex flex-col items-end gap-1">
                    <p className="label-metric">Potential Monthly Yield</p>
                    <p className="value-lg" style={{ color: 'var(--green)' }}>
                      {formatUsd(recommendations.reduce((s, r) => s + r.expectedMonthlyYieldUsd, 0))}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>across all recommendations</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div variants={stagger.item}>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-[11px]"
              style={{ border: '1px solid rgba(244,63,94,0.18)', background: 'rgba(244,63,94,0.05)', color: 'var(--red)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </div>
          </motion.div>
        )}

        {/* ── AI Recommendations ── */}
        {recommendations.length > 0 && (
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center gap-2 px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)', background: 'rgba(45,212,191,0.03)' }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--teal)' }} />
                <h3 className="text-[12px] font-semibold" style={{ color: 'var(--teal)' }}>
                  ACE Recommendations
                </h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--teal)', borderRadius: '4px' }}
                >
                  {recommendations.length}
                </span>
              </div>

              {recommendations.map(rec => {
                const prov = providers.find(p => p.id === rec.provider);
                if (!prov) return null;
                const color = PROVIDER_COLOR[rec.provider] ?? 'var(--teal)';
                const urgencyColor = rec.urgency === 'immediate' ? 'var(--green)' : rec.urgency === 'soon' ? 'var(--teal)' : 'var(--text-muted)';

                return (
                  <div key={rec.provider} className="ledger-row group">
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center mr-3"
                      style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, borderRadius: '8px' }}
                    >
                      <TrendingUp className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {prov.name}
                        </p>
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: urgencyColor === 'var(--green)' ? 'rgba(34,197,94,0.12)' : 'rgba(45,212,191,0.12)', color: urgencyColor, borderRadius: '4px' }}
                        >
                          {rec.urgency === 'immediate' ? 'Deploy Now' : rec.urgency === 'soon' ? 'Deploy Soon' : 'Consider'}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 leading-snug max-w-lg" style={{ color: 'var(--text-muted)' }}>
                        {rec.rationale}
                      </p>
                    </div>
                    <div className="text-right shrink-0 mr-4 hidden md:block">
                      <p className="text-[13px] font-bold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
                        {prov.apy.toFixed(1)}% APY
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        +{formatUsd(rec.expectedMonthlyYieldUsd)}/mo
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRec({ provider: prov, rec });
                        setStakeResult(null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold transition-all shrink-0"
                      style={{ background: color, color: '#000', borderRadius: '7px', fontSize: '11px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    >
                      <TrendingUp className="w-3 h-3" /> Stake
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── Provider cards ── */}
        <motion.div variants={stagger.item}>
          <div className="grid md:grid-cols-2 gap-4">
            {providers.map(p => {
              const color = PROVIDER_COLOR[p.id] ?? 'var(--teal)';
              const rec = recommendations.find(r => r.provider === p.id);
              return (
                <div key={p.id} className="card-base p-5 space-y-4">
                  {/* Provider header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 flex items-center justify-center"
                        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, borderRadius: '10px' }}
                      >
                        <TrendingUp className="w-4.5 h-4.5" style={{ color }} />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.protocol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[22px] font-bold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>
                        {p.apy.toFixed(1)}%
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Live APY</p>
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {p.description}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'TVL', value: `$${(p.tvlUsd / 1_000_000).toFixed(0)}M` },
                      { label: 'Risk', value: `${p.riskScore}/10` },
                      { label: 'Token', value: p.tokenSymbol },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-2 rounded-lg text-center"
                        style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-lo)' }}
                      >
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.isLiquid && (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--green)', borderRadius: '5px' }}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" /> Liquid
                      </span>
                    )}
                    {p.lockupDays === 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--blue)', borderRadius: '5px' }}
                      >
                        <Zap className="w-2.5 h-2.5" /> Instant unstake
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', borderRadius: '5px' }}
                    >
                      <ShieldCheck className="w-2.5 h-2.5" /> {p.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Projected yield on rec amount */}
                  {rec && (
                    <div className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: `color-mix(in srgb, ${color} 5%, transparent)`, border: `1px solid ${color}18` }}
                    >
                      <div>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Deploy {formatUsd(rec.allocateUsd)} ({rec.allocatePct}% of idle)
                        </p>
                        <p className="text-[11px] font-semibold mt-0.5" style={{ color }}>
                          +{formatUsd(rec.expectedMonthlyYieldUsd)}/month
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4" style={{ color, opacity: 0.7 }} />
                    </div>
                  )}

                  {/* CTA row */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (rec) { setSelectedRec({ provider: p, rec }); setStakeResult(null); }
                      }}
                      disabled={!rec || idleYield < p.minStakeUsd}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold disabled:opacity-40 transition-all"
                      style={{ background: color, color: '#000', borderRadius: '8px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      {idleYield < p.minStakeUsd ? `Min $${p.minStakeUsd}` : 'Stake on Behalf'}
                    </button>
                    <a
                      href={p.websiteUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] transition-colors"
                      style={{ border: '1px solid var(--border-base)', color: 'var(--text-muted)', borderRadius: '8px' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                    >
                      Docs <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── No wallet warning ── */}
        {!solanaWallet && (
          <motion.div variants={stagger.item}>
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-[11px]"
              style={{ border: '1px solid rgba(45,212,191,0.18)', background: 'rgba(45,212,191,0.04)', color: 'var(--teal)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Connect a Solana wallet to stake on-chain. ACE will sign the staking instruction on your behalf.
            </div>
          </motion.div>
        )}

        {/* ── Footer note ── */}
        <motion.div variants={stagger.item}>
          <div className="flex items-start gap-3 px-4 py-3 rounded-lg text-[10px]"
            style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
          >
            <Lock className="w-3 h-3 shrink-0 mt-0.5" />
            APYs are fetched live from provider public APIs. Rates shown are indicative and subject to change. ACE never takes custody of funds — staking instructions are signed by your wallet.
          </div>
        </motion.div>

      </motion.div>

      <AnimatePresence>
        {selectedRec && (
          <StakeModal
            provider={selectedRec.provider}
            rec={selectedRec.rec}
            onClose={() => { setSelectedRec(null); setStakeResult(null); }}
            onConfirm={handleStake}
            isStaking={isStaking}
            result={stakeResult}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
