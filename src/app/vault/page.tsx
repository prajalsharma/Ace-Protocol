'use client';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useApp } from '@/context/AppContext';
import { formatUsd, formatPercent, formatTimestamp } from '@/lib/utils';
import { appendLog } from '@/lib/activityLog';
import { routeExecution, estimateCurrentFee } from '@/lib/executionRouter';
import {
  Shield, TrendingUp, Wallet, Settings, AlertTriangle,
  ArrowUpRight, ArrowDownLeft, Loader2, Info, CheckCircle2, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VaultPage() {
  const { vault, strategies, isLoading, updateVault, addTransaction, isWalletConnected } = useApp();
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [txFeedback, setTxFeedback] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  function handleDeposit() {
    const amount = parseFloat(depositAmt);
    if (!vault || isNaN(amount) || amount <= 0) return;
    setIsProcessing(true);

    // Route through execution engine
    const { feeLamports } = estimateCurrentFee();
    const result = routeExecution({
      amountUsd: amount,
      urgencyHours: 0, // deposits are immediate
      networkFeeLamports: feeLamports,
      baselineFeeLamports: 5000,
      hasPendingBatchable: false,
    });

    setTimeout(() => {
      const newTotal = vault.totalDeposited + amount;
      const newYield = newTotal * (vault.allocation.yield / 100);
      const newReserve = newTotal * (vault.allocation.reserve / 100);
      const newLiquid = newTotal - newYield - newReserve - vault.paymentsBalance;

      updateVault({
        totalDeposited: newTotal,
        yieldBalance: Math.max(0, newYield),
        reserveBalance: Math.max(0, newReserve),
        liquidBalance: Math.max(0, newLiquid),
      });

      addTransaction({
        id: `tx-${Date.now()}`,
        vaultId: vault.id,
        type: 'deposit',
        amountUsd: amount,
        status: 'confirmed',
        timestamp: Math.floor(Date.now() / 1000),
        description: `Deposit: $${amount.toFixed(2)}`,
        executionCost: feeLamports / 1e9 * 148,
      });

      appendLog({
        type: 'deposit',
        message: `$${amount.toFixed(2)} deposited into vault`,
        detail: `Execution: ${result.decision}. ${result.reason} Buckets rebalanced automatically.`,
      });

      setTxFeedback({ type: 'success', msg: `Deposited $${amount.toFixed(2)} successfully` });
      setDepositAmt('');
      setIsProcessing(false);
    }, 800);
  }

  function handleWithdraw() {
    const amount = parseFloat(withdrawAmt);
    if (!vault || isNaN(amount) || amount <= 0) return;
    if (amount > vault.liquidBalance) {
      setTxFeedback({ type: 'error', msg: `Insufficient liquid balance. Available: $${vault.liquidBalance.toFixed(2)}` });
      return;
    }
    setIsProcessing(true);

    setTimeout(() => {
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
        description: `Withdraw: $${amount.toFixed(2)} (liquid)`,
      });

      appendLog({
        type: 'withdraw',
        message: `$${amount.toFixed(2)} withdrawn from liquid bucket`,
        detail: `Reserve and yield buckets unchanged. Remaining liquid: $${(vault.liquidBalance - amount).toFixed(2)}.`,
      });

      setTxFeedback({ type: 'success', msg: `Withdrawn $${amount.toFixed(2)} from liquid balance` });
      setWithdrawAmt('');
      setIsProcessing(false);
    }, 600);
  }

  if (isLoading) return (
    <AppShell>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    </AppShell>
  );

  if (!vault) return null;

  const allocationItems = [
    { label: 'Earning Yield',  key: 'yield',    value: vault.yieldBalance,    pct: vault.allocation.yield,    color: 'green' as const, icon: TrendingUp },
    { label: 'Harbor Reserve', key: 'reserve',  value: vault.reserveBalance,  pct: vault.allocation.reserve,  color: 'ocean' as const, icon: Shield },
    { label: 'Liquid Spend',   key: 'liquid',   value: vault.liquidBalance,   pct: vault.allocation.liquid,   color: 'fire' as const,  icon: Wallet },
    { label: 'Payments Lock',  key: 'payments', value: vault.paymentsBalance, pct: vault.allocation.payments, color: 'gold' as const,  icon: ArrowUpRight },
  ];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Vault header */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 rounded-xl border border-[#2a2a3a] bg-[#13131a] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="success">Active</Badge>
              <Badge variant="muted">{vault.riskLevel}</Badge>
            </div>
            <p className="text-3xl font-bold text-white">{formatUsd(vault.totalDeposited)}</p>
            <p className="text-gray-500 text-sm mt-1">Total vault balance</p>
            <div className="flex items-center gap-6 mt-4 text-sm">
              <div><p className="text-emerald-400 font-bold">{formatPercent(vault.apy)}</p><p className="text-gray-600 text-xs">Weighted APY</p></div>
              <div><p className="text-white font-bold">{formatTimestamp(vault.createdAt)}</p><p className="text-gray-600 text-xs">Created</p></div>
              <div><p className="text-white font-bold">{formatTimestamp(vault.lastRebalancedAt)}</p><p className="text-gray-600 text-xs">Last rebalance</p></div>
            </div>
          </div>
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <div className="space-y-2">
              <Button variant="fire" size="sm" fullWidth>
                <ArrowDownLeft className="w-3.5 h-3.5" /> Deposit
              </Button>
              <Button variant="outline" size="sm" fullWidth>
                <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
              </Button>
              <Button variant="ghost" size="sm" fullWidth>
                <Settings className="w-3.5 h-3.5" /> Rebalance Settings
              </Button>
            </div>
          </Card>
        </div>

        {/* Allocation breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Capital Allocation</CardTitle>
            <Button variant="ghost" size="sm"><Settings className="w-3.5 h-3.5" /> Edit Policy</Button>
          </CardHeader>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allocationItems.map(({ label, value, pct, color, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-[#2a2a3a] bg-[#0f0f16] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn('w-4 h-4', {
                    'text-emerald-400': color === 'green',
                    'text-sky-400':     color === 'ocean',
                    'text-orange-400':  color === 'fire',
                    'text-yellow-400':  color === 'gold',
                  })} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
                <p className="text-xl font-bold text-white">{formatUsd(value, 0)}</p>
                <p className="text-xs text-gray-600 mt-0.5">Target: {pct}%</p>
                <ProgressBar value={pct} color={color} className="mt-2" />
              </div>
            ))}
          </div>
        </Card>

        {/* Strategies */}
        <Card>
          <CardHeader>
            <CardTitle>Active Strategies</CardTitle>
            <Badge variant="muted">{strategies.filter(s => s.isActive).length} active</Badge>
          </CardHeader>
          <div className="space-y-3">
            {strategies.map(strategy => (
              <div key={strategy.id}
                className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border transition-all',
                  strategy.isActive
                    ? 'border-[#2a2a3a] bg-[#0f0f16]'
                    : 'border-[#1a1a24] bg-[#0c0c13] opacity-60',
                )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white">{strategy.name}</p>
                    {!strategy.isActive && <Badge variant="muted">inactive</Badge>}
                  </div>
                  <p className="text-xs text-gray-600">{strategy.protocol} · {strategy.description}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-sm font-bold text-emerald-400">{formatPercent(strategy.apy)}</p>
                  <p className="text-xs text-gray-600">APY</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-sm font-semibold text-white">{formatUsd(strategy.allocatedAmount, 0)}</p>
                  <p className="text-xs text-gray-600">Allocated</p>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 text-xs text-gray-400 shrink-0">
                  {strategy.riskScore}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Deposit/Withdraw */}
        <Card>
          <CardHeader>
            <div className="flex gap-2">
              {(['deposit', 'withdraw'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize',
                    tab === t ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'text-gray-500 hover:text-gray-300',
                  )}>
                  {t}
                </button>
              ))}
            </div>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1.5 block">Amount (USDC)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={tab === 'deposit' ? depositAmt : withdrawAmt}
                  onChange={e => tab === 'deposit' ? setDepositAmt(e.target.value) : setWithdrawAmt(e.target.value)}
                  className="w-full bg-[#0f0f16] border border-[#2a2a3a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <Button
                variant={tab === 'deposit' ? 'fire' : 'outline'}
                size="md"
                disabled={isProcessing}
                onClick={tab === 'deposit' ? handleDeposit : handleWithdraw}
              >
                {isProcessing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
                  : tab === 'deposit' ? 'Deposit' : 'Withdraw'
                }
              </Button>
            </div>

            {/* TX Feedback */}
            {txFeedback && (
              <div className={cn(
                'flex items-center gap-2 text-xs p-3 rounded-lg border',
                txFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : txFeedback.type === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-sky-500/10 border-sky-500/20 text-sky-400',
              )}>
                {txFeedback.type === 'success'
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  : txFeedback.type === 'error'
                  ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  : <Clock className="w-3.5 h-3.5 shrink-0" />}
                {txFeedback.msg}
                <button onClick={() => setTxFeedback(null)} className="ml-auto text-gray-500 hover:text-gray-300">×</button>
              </div>
            )}

            {tab === 'deposit' && (
              <div className="flex items-start gap-2 text-xs text-gray-600 p-3 bg-white/3 rounded-lg border border-white/5">
                <Info className="w-3.5 h-3.5 mt-0.5 text-orange-400/60 shrink-0" />
                Funds are allocated to your configured strategy split immediately. A small protocol fee applies on yield earned.
                {isWalletConnected
                  ? ' Wallet connected — simulates vault deposit on devnet state.'
                  : ' Simulation mode: updates local state only.'}
              </div>
            )}
            {tab === 'withdraw' && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-xs text-gray-600 p-3 bg-amber-500/5 rounded-lg border border-amber-500/15">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-amber-400/70 shrink-0" />
                  Only liquid balance is available for instant withdrawal. Available: {formatUsd(vault.liquidBalance)}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
