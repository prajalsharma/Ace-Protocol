'use client';
import { useState, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd, formatPercent, formatTimestamp } from '@/lib/utils';
import { appendLog } from '@/lib/activityLog';
import { computeProtocolFee } from '@/lib/feeEngine';
import {
  Shield, TrendingUp, Wallet, Settings, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, Loader2, Info, CheckCircle2,
  ExternalLink, RefreshCw, Zap, DollarSign,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Connection, PublicKey, SystemProgram, Transaction,
  LAMPORTS_PER_SOL, clusterApiUrl,
} from '@solana/web3.js';
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';

const PROGRAM_ID = 'DS5K9htMgTtUZGHvRiZZQER8ZX6PMHB79zuK7qB4ZmZY';
const EXPLORER_BASE = 'https://explorer.solana.com';
const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl('devnet');

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.045 } } },
  item: {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function VaultPage() {
  const { vault, strategies, isLoading, updateVault, addTransaction, sessionToken, refreshVault } = useApp();
  const { wallets: solanaWallets } = useSolanaWallets();
  const solanaWallet = solanaWallets[0] ?? null;

  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [txFeedback, setTxFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string; txSig?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Real devnet deposit via Privy sendTransaction ─────────────────────────
  const handleDeposit = useCallback(async () => {
    const amount = parseFloat(depositAmt);
    if (!vault || isNaN(amount) || amount <= 0) return;
    if (!solanaWallet) {
      setTxFeedback({ type: 'error', msg: 'No Solana wallet connected. Please reconnect.' });
      return;
    }

    setIsProcessing(true);
    setTxFeedback(null);

    try {
      const connection = new Connection(RPC, 'confirmed');
      const ownerPubkey = new PublicKey(solanaWallet.address);
      const programPubkey = new PublicKey(PROGRAM_ID);

      // Derive the vault PDA (same logic as program.ts findVaultPDA)
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), ownerPubkey.toBuffer()],
        programPubkey,
      );

      // Fetch SOL price to convert USD amount → lamports
      let solPrice = 148;
      try {
        const priceRes = await fetch('/api/sol-price');
        if (priceRes.ok) {
          const priceData = await priceRes.json() as { price?: number };
          solPrice = priceData.price ?? 148;
        }
      } catch { /* use fallback */ }

      const lamports = Math.ceil((amount / solPrice) * LAMPORTS_PER_SOL);

      // Check wallet balance
      const balance = await connection.getBalance(ownerPubkey);
      const feeBuffer = 10_000; // extra lamports for tx fee
      if (balance < lamports + feeBuffer) {
        setTxFeedback({
          type: 'error',
          msg: `Insufficient devnet SOL. You need ≈${((lamports + feeBuffer) / LAMPORTS_PER_SOL).toFixed(4)} SOL. Get devnet SOL at faucet.solana.com.`,
        });
        setIsProcessing(false);
        return;
      }

      // Build SOL transfer → vault PDA
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: ownerPubkey,
      }).add(
        SystemProgram.transfer({
          fromPubkey: ownerPubkey,
          toPubkey: vaultPda,
          lamports,
        }),
      );

      // Send via Privy's wallet adapter (triggers wallet signing UI)
      const txSig = await solanaWallet.sendTransaction(tx, connection);

      // Wait for confirmation
      await connection.confirmTransaction({
        signature: txSig,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      // Record in backend
      if (sessionToken) {
        await fetch('/api/protocol/demo-topup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ amountUsd: amount }),
        });
      }

      appendLog({
        type: 'deposit',
        message: `$${amount.toFixed(2)} deposited on-chain`,
        detail: `${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL → vault PDA. Tx: ${txSig.slice(0, 20)}…`,
      });

      setTxFeedback({
        type: 'success',
        msg: `Deposited $${amount.toFixed(2)} (${(lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL) on-chain successfully.`,
        txSig,
      });
      setDepositAmt('');
      refreshVault();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      const isUserRejected = msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('cancelled');
      setTxFeedback({
        type: 'error',
        msg: isUserRejected ? 'Transaction cancelled by user.' : `Deposit failed: ${msg}`,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [depositAmt, vault, solanaWallet, sessionToken, refreshVault]);

  // ── Withdraw (devnet: sends from vault PDA back to owner) ─────────────────
  const handleWithdraw = useCallback(async () => {
    const amount = parseFloat(withdrawAmt);
    if (!vault || isNaN(amount) || amount <= 0) return;
    if (amount > vault.liquidBalance) {
      setTxFeedback({ type: 'error', msg: `Insufficient liquid balance. Available: ${formatUsd(vault.liquidBalance)}` });
      return;
    }

    setIsProcessing(true);
    setTxFeedback(null);

    try {
      // On devnet, the vault PDA holds SOL but can only be spent by the program.
      // We do an optimistic UI update + record the intent; real program CPI
      // withdraw would be the Anchor instruction.  For demo we record it.
      await new Promise(r => setTimeout(r, 700));

      updateVault({
        totalDeposited: vault.totalDeposited - amount,
        liquidBalance: vault.liquidBalance - amount,
      });

      addTransaction({
        id: `tx-${Date.now()}`,
        vaultId: vault.id,
        type: 'withdraw',
        amountUsd: amount,
        status: 'confirmed',
        timestamp: Math.floor(Date.now() / 1000),
        description: `Withdrawal: ${formatUsd(amount)} from liquid balance`,
      });

      appendLog({
        type: 'withdraw',
        message: `${formatUsd(amount)} withdrawn from liquid bucket`,
        detail: `Liquid balance updated. Remaining: ${formatUsd(vault.liquidBalance - amount)}.`,
      });

      setTxFeedback({ type: 'success', msg: `Withdrawn ${formatUsd(amount)} from liquid balance.` });
      setWithdrawAmt('');
    } catch (err) {
      setTxFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Withdraw failed.' });
    } finally {
      setIsProcessing(false);
    }
  }, [withdrawAmt, vault, updateVault, addTransaction]);

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--teal)' }} />
      </div>
    </AppShell>
  );

  if (!vault) return null;

  const allocationItems = [
    { label: 'Earning Yield',  value: vault.yieldBalance,    pct: vault.allocation.yield,    color: 'var(--green)',  icon: TrendingUp },
    { label: 'Harbor Reserve', value: vault.reserveBalance,  pct: vault.allocation.reserve,  color: 'var(--blue)',   icon: Shield },
    { label: 'Liquid Spend',   value: vault.liquidBalance,   pct: vault.allocation.liquid,   color: '#f97316',       icon: Wallet },
    { label: 'Payments Lock',  value: vault.paymentsBalance, pct: vault.allocation.payments, color: 'var(--violet)',  icon: ArrowUpRight },
  ];

  const depositAmount = parseFloat(depositAmt) || 0;
  const quickFee = depositAmount > 0
    ? computeProtocolFee({ amountUsd: depositAmount, urgencyHours: 72, networkCongestionScore: 0.15, solVolatilityScore: 0.1 })
    : null;

  return (
    <AppShell>
      <motion.div
        variants={stagger.container}
        initial="hidden"
        animate="show"
        className="max-w-5xl mx-auto space-y-4"
      >

        {/* ── Status strips ── */}
        <motion.div variants={stagger.item} className="space-y-1.5">
          <div
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-[11px]"
            style={{ border: '1px solid rgba(34,197,94,0.18)', background: 'rgba(34,197,94,0.03)' }}
          >
            <div className="flex items-center gap-1.5 font-semibold shrink-0" style={{ color: 'var(--green)' }}>
              <span className="status-live" />
              On-chain deployed · Devnet
            </div>
            <span className="truncate hidden sm:block text-[10px]"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
            >
              {PROGRAM_ID}
            </span>
            <a
              href={`${EXPLORER_BASE}/address/${PROGRAM_ID}?cluster=devnet`}
              target="_blank" rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 transition-colors shrink-0 text-[10px]"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--green)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
            >
              Verify <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          {!solanaWallet && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px]"
              style={{ border: '1px solid rgba(45,212,191,0.18)', background: 'rgba(45,212,191,0.04)', color: 'var(--teal-bright)' }}
            >
              <AlertTriangle className="w-3 h-3 shrink-0" />
              No Solana wallet connected — deposits require a connected wallet to sign the transaction.
            </div>
          )}
        </motion.div>

        {/* ── Vault hero ── */}
        <motion.div variants={stagger.item}>
          <div className="card-hero p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="success">Active</Badge>
                  <Badge variant="muted">{vault.riskLevel} risk</Badge>
                  <Badge variant="muted">Devnet</Badge>
                </div>
                <p className="value-xl" style={{ color: 'var(--text-primary)' }}>
                  {formatUsd(vault.totalDeposited)}
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Total capital under management
                </p>
                <div className="flex items-center gap-4 mt-3 text-[11px]">
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--green)' }}>{formatPercent(vault.apy)}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Weighted APY</p>
                  </div>
                  <div className="w-px h-6" style={{ background: 'var(--border-base)' }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatTimestamp(vault.createdAt)}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Created</p>
                  </div>
                  <div className="w-px h-6" style={{ background: 'var(--border-base)' }} />
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatTimestamp(vault.lastRebalancedAt)}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Last rebalanced</p>
                  </div>
                </div>
              </div>
              <button onClick={refreshVault} className="btn-secondary flex items-center gap-1.5"
                style={{ fontSize: '11px', padding: '7px 14px' }}
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Capital allocation ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-base)' }}
            >
              <h3 className="label-metric">Capital Allocation</h3>
              <button className="flex items-center gap-1 text-[10px] transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <Settings className="w-3 h-3" />
                Edit Policy
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'var(--border-lo)' }}>
              {allocationItems.map(({ label, value, pct, color, icon: Icon }) => (
                <div key={label} className="p-4" style={{ background: 'var(--bg-card)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 flex items-center justify-center"
                      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, borderRadius: '5px' }}
                    >
                      <Icon className="w-3 h-3" style={{ color }} />
                    </div>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                  <p className="value-md" style={{ color: 'var(--text-primary)' }}>{formatUsd(value, 0)}</p>
                  <div className="flex items-center justify-between mt-2 mb-1">
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Target {pct}%</span>
                  </div>
                  <div className="progress-track">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, pct)}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="progress-fill"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-5 gap-4">

          {/* Strategies */}
          <motion.div variants={stagger.item} className="lg:col-span-3">
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Active Strategies</h3>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: '4px' }}
                >
                  {strategies.filter(s => s.isActive).length} active
                </span>
              </div>
              <div>
                {strategies.map(strategy => (
                  <div key={strategy.id} className="ledger-row" style={{ opacity: strategy.isActive ? 1 : 0.45 }}>
                    <div className="w-7 h-7 shrink-0 flex items-center justify-center mr-3 text-[10px] font-semibold tabular-nums"
                      style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-lo)', borderRadius: '6px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                    >
                      {strategy.riskScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{strategy.name}</p>
                        {!strategy.isActive && <Badge variant="muted">inactive</Badge>}
                      </div>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {strategy.protocol} · {strategy.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                        {formatPercent(strategy.apy)}
                      </p>
                      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>APY</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-[12px] font-semibold tabular-nums"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                      >
                        {formatUsd(strategy.allocatedAmount, 0)}
                      </p>
                      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Allocated</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Deposit / Withdraw panel */}
          <motion.div variants={stagger.item} className="lg:col-span-2">
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              {/* Tab bar */}
              <div className="flex items-center px-1 pt-1" style={{ borderBottom: '1px solid var(--border-base)' }}>
                {(['deposit', 'withdraw'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setTxFeedback(null); }}
                    className="relative flex items-center gap-1.5 px-4 py-3 text-[11px] font-medium transition-colors capitalize"
                    style={{ color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                  >
                    {tab === t && (
                      <motion.div layoutId="vault-tab" className="absolute bottom-0 left-0 right-0 h-px"
                        style={{ background: 'var(--teal)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    {t === 'deposit' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <label className="label-metric block mb-1.5">
                    {tab === 'deposit' ? 'Amount USD (converted to SOL)' : 'Amount USDC'}
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={tab === 'deposit' ? depositAmt : withdrawAmt}
                    onChange={e => tab === 'deposit' ? setDepositAmt(e.target.value) : setWithdrawAmt(e.target.value)}
                    className="input-base w-full"
                    style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                {/* Protocol fee preview */}
                {tab === 'deposit' && quickFee && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg text-[10px]"
                    style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3" style={{ color: 'var(--teal)', opacity: 0.7 }} />
                      <span style={{ color: 'var(--text-muted)' }}>Protocol fee</span>
                    </div>
                    <span className="font-semibold tabular-nums" style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>
                      {formatUsd(quickFee.feeUsd)} · {quickFee.label}
                    </span>
                  </div>
                )}

                <button
                  disabled={isProcessing || (!solanaWallet && tab === 'deposit')}
                  onClick={tab === 'deposit' ? handleDeposit : handleWithdraw}
                  className="btn-primary w-full flex items-center justify-center gap-1.5 disabled:opacity-40"
                  style={{ fontSize: '12px', padding: '10px' }}
                >
                  {isProcessing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing & confirming…</>
                    : tab === 'deposit'
                    ? <><Zap className="w-3.5 h-3.5" /> Deposit on-chain</>
                    : <><ArrowUpRight className="w-3.5 h-3.5" /> Withdraw</>
                  }
                </button>

                {/* TX Feedback */}
                {txFeedback && (
                  <div className="flex items-start gap-2 text-[11px] p-3 rounded-lg"
                    style={
                      txFeedback.type === 'success'
                        ? { border: '1px solid rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.04)', color: 'var(--green)' }
                        : txFeedback.type === 'error'
                        ? { border: '1px solid rgba(244,63,94,0.15)', background: 'rgba(244,63,94,0.04)', color: 'var(--red)' }
                        : { border: '1px solid rgba(59,130,246,0.15)', background: 'rgba(59,130,246,0.04)', color: 'var(--blue)' }
                    }
                  >
                    {txFeedback.type === 'success'
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 space-y-1">
                      <span>{txFeedback.msg}</span>
                      {txFeedback.txSig && (
                        <a
                          href={`${EXPLORER_BASE}/tx/${txFeedback.txSig}?cluster=devnet`}
                          target="_blank" rel="noopener noreferrer"
                          className="block text-[10px] underline underline-offset-2 transition-opacity hover:opacity-80"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          View on Explorer ↗
                        </a>
                      )}
                    </div>
                    <button onClick={() => setTxFeedback(null)} style={{ color: 'var(--text-muted)' }}>×</button>
                  </div>
                )}

                {/* Context notes */}
                {tab === 'deposit' && !txFeedback && (
                  <div className="flex items-start gap-2 text-[10px] p-3 rounded-lg"
                    style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)', color: 'var(--text-muted)' }}
                  >
                    <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'rgba(45,212,191,0.5)' }} />
                    Your wallet will sign a real SOL transfer to the ACE vault PDA on Devnet. Get test SOL at{' '}
                    <a href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer"
                      className="underline underline-offset-1" style={{ color: 'var(--teal)', opacity: 0.8 }}
                    >
                      faucet.solana.com
                    </a>.
                  </div>
                )}
                {tab === 'withdraw' && !txFeedback && (
                  <div className="flex items-start gap-2 text-[10px] p-3 rounded-lg"
                    style={{ border: '1px solid rgba(45,212,191,0.12)', background: 'rgba(45,212,191,0.03)', color: 'var(--text-muted)' }}
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'rgba(45,212,191,0.6)' }} />
                    Only liquid balance available for instant withdrawal.{' '}
                    <strong style={{ color: 'var(--text-secondary)' }}>Available: {formatUsd(vault.liquidBalance)}</strong>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

      </motion.div>
    </AppShell>
  );
}
