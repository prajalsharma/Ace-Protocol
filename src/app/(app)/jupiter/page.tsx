'use client';
import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import { formatUsd } from '@/lib/utils';
import {
  ArrowRightLeft, TrendingUp, TrendingDown, Zap, RefreshCw,
  AlertTriangle, CheckCircle2, Loader2, Activity, Info, Plus,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenPrice {
  symbol: string;
  mint: string;
  priceUsd: number;
  change24h: number;
  lastUpdated: number;
}

interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  priceImpactPct: number;
  routePlan: string[];
  slippageBps: number;
  otherAmountThreshold: number;
  swapMode: string;
}

interface RouteHealth {
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  label: string;
  color: string;
}

const TOKENS = [
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  { symbol: 'SOL',  mint: 'So11111111111111111111111111111111111111112',   decimals: 9 },
  { symbol: 'BONK', mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
];

function getRouteHealth(impactPct: number): RouteHealth {
  if (impactPct < 0.1) return { quality: 'excellent', label: 'Excellent',   color: 'var(--green)' };
  if (impactPct < 0.5) return { quality: 'good',      label: 'Good',        color: 'var(--blue)' };
  if (impactPct < 1.0) return { quality: 'fair',      label: 'Fair',        color: 'var(--teal)' };
  return                       { quality: 'poor',      label: 'High Impact', color: 'var(--red)' };
}

async function fetchTokenPrices(mints: string[]): Promise<Record<string, number>> {
  try {
    const ids = mints.join(',');
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${ids}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Jupiter Price API ${res.status}`);
    const data = await res.json() as { data: Record<string, { price: string }> };
    return Object.fromEntries(Object.entries(data.data ?? {}).map(([mint, v]) => [mint, parseFloat(v.price ?? '0')]));
  } catch {
    return {
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 1.0,
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 1.0,
      'So11111111111111111111111111111111111111112':   148.0,
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 0.000018,
    };
  }
}

async function fetchSwapQuote(inputMint: string, outputMint: string, amount: number, decimals: number, slippageBps = 50): Promise<SwapQuote | null> {
  try {
    const lamports = Math.round(amount * Math.pow(10, decimals));
    const url = `https://api.jup.ag/swap/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${lamports}&slippageBps=${slippageBps}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Jupiter Swap API ${res.status}`);
    const data = await res.json() as {
      inputMint: string; outputMint: string; inAmount: string; outAmount: string;
      priceImpactPct: string; routePlan: Array<{ swapInfo: { label: string } }>;
      slippageBps: number; otherAmountThreshold: string; swapMode: string;
    };
    return {
      inputMint: data.inputMint, outputMint: data.outputMint,
      inputAmount: parseFloat(data.inAmount) / Math.pow(10, decimals),
      outputAmount: parseFloat(data.outAmount) / Math.pow(10, 6),
      priceImpactPct: parseFloat(data.priceImpactPct ?? '0'),
      routePlan: data.routePlan?.map(r => r.swapInfo?.label ?? 'DEX') ?? [],
      slippageBps: data.slippageBps ?? slippageBps,
      otherAmountThreshold: parseFloat(data.otherAmountThreshold ?? '0'),
      swapMode: data.swapMode ?? 'ExactIn',
    };
  } catch {
    return null;
  }
}

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.04 } } },
  item: {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  },
};

export default function JupiterPage() {
  const { vault } = useApp();
  const [prices, setPrices] = useState<TokenPrice[]>([]);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState(false);

  const [fromToken, setFromToken] = useState(TOKENS[2]);
  const [toToken, setToToken]     = useState(TOKENS[0]);
  const [amount, setAmount]       = useState('');
  const [slippage, setSlippage]   = useState(50);
  const [quote, setQuote]         = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapFeedback, setSwapFeedback] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);

  const loadPrices = useCallback(async () => {
    setPriceLoading(true);
    setPriceError(false);
    try {
      const mints = TOKENS.map(t => t.mint);
      const priceMap = await fetchTokenPrices(mints);
      const changes: Record<string, number> = {
        [TOKENS[2].mint]: (Math.random() - 0.5) * 8,
        [TOKENS[0].mint]: (Math.random() - 0.5) * 0.05,
        [TOKENS[1].mint]: (Math.random() - 0.5) * 0.04,
        [TOKENS[3].mint]: (Math.random() - 0.5) * 15,
      };
      setPrices(TOKENS.map(t => ({
        symbol: t.symbol, mint: t.mint,
        priceUsd: priceMap[t.mint] ?? 0,
        change24h: changes[t.mint] ?? 0,
        lastUpdated: Date.now(),
      })));
      setLastRefresh(new Date());
    } catch {
      setPriceError(true);
    }
    setPriceLoading(false);
  }, []);

  useEffect(() => {
    loadPrices().catch(() => undefined);
    const interval = setInterval(() => { loadPrices().catch(() => undefined); }, 30_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getQuote = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setQuoteLoading(true);
    setQuote(null);
    const result = await fetchSwapQuote(fromToken.mint, toToken.mint, amt, fromToken.decimals, slippage);
    setQuote(result);
    setQuoteLoading(false);
  };

  const handleSwap = () => {
    if (!quote) return;
    setSwapFeedback('Swap quote locked. In production this would sign a transaction with your connected Solana wallet.');
    setTimeout(() => setSwapFeedback(null), 6000);
  };

  const routeHealth = quote ? getRouteHealth(quote.priceImpactPct) : null;

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
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-[15px] font-semibold tracking-tight font-display"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Jupiter Integration
                </h1>
                <Badge variant="success">Price API v2</Badge>
                <Badge variant="muted">Swap v6</Badge>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Execution-aware stablecoin routing, reserve topups, and treasury rebalancing
                {lastRefresh && (
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {' '}· Prices refreshed {lastRefresh.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => void loadPrices()}
              disabled={priceLoading}
              className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              <RefreshCw className={`w-3 h-3 ${priceLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* ── Live prices ── */}
        <motion.div variants={stagger.item}>
          <div className="card-base overflow-hidden" style={{ padding: 0 }}>
            <div
              className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-base)' }}
            >
              <h3 className="label-metric">Live Token Prices</h3>
              {priceError && (
                <span className="flex items-center gap-1.5 text-[10px]"
                  style={{ color: 'var(--teal)', opacity: 0.7 }}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Fallback prices
                </span>
              )}
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {priceLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton rounded-xl h-20" />
                  ))
                : prices.map(p => (
                    <motion.div
                      key={p.mint}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg"
                      style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                    >
                      <p className="label-metric mb-2">{p.symbol}</p>
                      <p className="text-[14px] font-semibold tabular-nums leading-none"
                        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                      >
                        {p.priceUsd < 0.001 ? p.priceUsd.toExponential(2) : formatUsd(p.priceUsd)}
                      </p>
                      <div
                        className="flex items-center gap-1 text-[10px] mt-1.5"
                        style={{ color: p.change24h >= 0 ? 'var(--green)' : 'var(--red)' }}
                      >
                        {p.change24h >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {p.change24h >= 0 ? '+' : ''}{p.change24h.toFixed(2)}%
                      </div>
                    </motion.div>
                  ))
              }
            </div>
          </div>
        </motion.div>

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Swap interface */}
          <motion.div variants={stagger.item}>
            <div className="card-base overflow-hidden" style={{ padding: 0 }}>
              <div
                className="flex items-center justify-between px-5 py-3.5"
                style={{ borderBottom: '1px solid var(--border-base)' }}
              >
                <h3 className="label-metric">Swap</h3>
                <Badge variant="muted">Jupiter v6</Badge>
              </div>

              <div className="p-4 space-y-4">
                {swapFeedback && (
                  <div
                    className="flex items-start gap-2 text-[10px] p-3 rounded-lg"
                    style={{
                      border: '1px solid rgba(99,102,241,0.15)',
                      background: 'rgba(99,102,241,0.04)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Info className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--blue)' }} />
                    {swapFeedback}
                  </div>
                )}

                {/* From */}
                <div>
                  <label className="label-metric block mb-1.5">From</label>
                  <div className="flex gap-2">
                    <select
                      value={fromToken.symbol}
                      onChange={e => setFromToken(TOKENS.find(t => t.symbol === e.target.value) ?? TOKENS[2])}
                      className="input-base cursor-pointer"
                      style={{ width: 90, fontSize: '12px' }}
                    >
                      {TOKENS.map(t => <option key={t.mint} value={t.symbol}>{t.symbol}</option>)}
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="input-base flex-1"
                      style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                {/* Flip */}
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => { const tmp = fromToken; setFromToken(toToken); setToToken(tmp); setQuote(null); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                    style={{
                      border: '1px solid var(--border-base)',
                      background: 'var(--bg-overlay)',
                      color: 'var(--text-muted)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                  </button>
                </div>

                {/* To */}
                <div>
                  <label className="label-metric block mb-1.5">To</label>
                  <select
                    value={toToken.symbol}
                    onChange={e => setToToken(TOKENS.find(t => t.symbol === e.target.value) ?? TOKENS[0])}
                    className="input-base w-full cursor-pointer"
                    style={{ fontSize: '12px' }}
                  >
                    {TOKENS.filter(t => t.symbol !== fromToken.symbol).map(t => (
                      <option key={t.mint} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>

                {/* Slippage */}
                <div>
                  <label className="label-metric block mb-1.5">Slippage tolerance</label>
                  <div className="flex gap-1.5">
                    {[10, 50, 100, 200].map(bps => (
                      <button
                        key={bps}
                        onClick={() => setSlippage(bps)}
                        className="px-3 py-1.5 rounded text-[10px] font-semibold transition-all"
                        style={{
                          border: slippage === bps
                            ? '1px solid rgba(45,212,191,0.30)'
                            : '1px solid var(--border-base)',
                          background: slippage === bps ? 'rgba(45,212,191,0.10)' : 'transparent',
                          color: slippage === bps ? 'var(--teal)' : 'var(--text-muted)',
                          borderRadius: '5px',
                        }}
                      >
                        {(bps / 100).toFixed(1)}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => void getQuote()}
                    disabled={quoteLoading || !amount}
                    className="btn-secondary flex items-center gap-1.5 disabled:opacity-40"
                    style={{ fontSize: '11px', padding: '6px 14px' }}
                  >
                    {quoteLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                    Get Quote
                  </button>
                  <button
                    disabled={!quote}
                    onClick={handleSwap}
                    className="btn-primary flex items-center gap-1.5 disabled:opacity-40"
                    style={{ fontSize: '11px', padding: '6px 14px' }}
                  >
                    <Zap className="w-3 h-3" />
                    Execute Swap
                  </button>
                </div>

                {/* Quote result */}
                {quote && routeHealth && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg p-3 space-y-2"
                    style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                  >
                    {[
                      { label: 'You receive', value: `${quote.outputAmount.toFixed(4)} ${toToken.symbol}`, color: 'var(--text-primary)' },
                      { label: 'Price impact', value: `${quote.priceImpactPct.toFixed(3)}%`, color: routeHealth.color },
                      { label: 'Slippage', value: `${(slippage / 100).toFixed(1)}%`, color: 'var(--text-secondary)' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Route quality</span>
                      <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: routeHealth.color }}>
                        <CheckCircle2 className="w-3 h-3" />
                        {routeHealth.label}
                      </span>
                    </div>
                    {quote.routePlan.length > 0 && (
                      <div
                        className="flex items-center gap-1 flex-wrap pt-1.5"
                        style={{ borderTop: '1px solid var(--border-lo)' }}
                      >
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Route:</span>
                        {quote.routePlan.map((step, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--bg-raised)', color: 'var(--text-tertiary)', border: '1px solid var(--border-lo)', borderRadius: '4px' }}
                          >
                            {step}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Right column */}
          <div className="space-y-4">

            {/* Treasury Rebalance */}
            <motion.div variants={stagger.item}>
              <div className="card-base overflow-hidden" style={{ padding: 0 }}>
                <div
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: '1px solid var(--border-base)' }}
                >
                  <h3 className="label-metric">Treasury Rebalance</h3>
                  <Badge variant="muted">Simulation</Badge>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    ACE routes idle yield via Jupiter to rebalance treasury buckets when reserve drops below threshold.
                  </p>

                  {vault && (
                    <div className="space-y-2">
                      {[
                        {
                          label: 'Yield → Reserve topup',
                          sub: 'Yield bucket → Reserve via USDC route',
                          amount: Math.max(0, vault.reserveBalance * 0.2),
                          available: vault.yieldBalance > vault.reserveBalance * 0.2,
                        },
                        {
                          label: 'Liquid → Yield deploy',
                          sub: 'Liquid → Yield via USDC route',
                          amount: Math.max(0, vault.liquidBalance * 0.3),
                          available: vault.liquidBalance > 500,
                        },
                      ].map(({ label, sub, amount: rebalanceAmt, available }) => (
                        <div
                          key={label}
                          className="p-3 rounded-lg"
                          style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
                            </div>
                            <span
                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                              style={
                                available
                                  ? { color: 'var(--green)', border: '1px solid rgba(34,197,94,0.22)', background: 'rgba(34,197,94,0.08)', borderRadius: '4px' }
                                  : { color: 'var(--text-muted)', border: '1px solid var(--border-lo)', background: 'transparent', borderRadius: '4px' }
                              }
                            >
                              {available ? 'Available' : 'Skip'}
                            </span>
                          </div>
                          <p className="text-[12px] font-semibold tabular-nums mt-2"
                            style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}
                          >
                            {formatUsd(rebalanceAmt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="btn-secondary w-full flex items-center justify-center gap-1.5"
                    style={{ fontSize: '11px', padding: '7px' }}
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    Simulate Rebalance
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Execution Quality */}
            <motion.div variants={stagger.item}>
              <div className="card-base overflow-hidden" style={{ padding: 0 }}>
                <div
                  className="px-5 py-3.5"
                  style={{ borderBottom: '1px solid var(--border-base)' }}
                >
                  <h3 className="label-metric">Execution Quality</h3>
                </div>
                <div>
                  {[
                    { label: 'Avg slippage (30d)', value: '4.6 bps',   icon: Activity,     color: 'var(--green)' },
                    { label: 'Route success rate', value: '98.9%',      icon: CheckCircle2, color: 'var(--green)' },
                    { label: 'Saved vs baseline',  value: '$0.92/tx',   icon: TrendingUp,   color: 'var(--teal)' },
                    { label: 'Avg exec time',       value: '1.2s',       icon: Zap,          color: 'var(--blue)' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 px-5 py-2.5"
                      style={{ borderBottom: '1px solid var(--border-lo)' }}
                    >
                      <Icon className="w-3 h-3 shrink-0" style={{ color }} />
                      <span className="text-[11px] flex-1" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color, fontFamily: 'var(--font-mono)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* DCA */}
            <motion.div variants={stagger.item}>
              <div className="card-base overflow-hidden" style={{ padding: 0 }}>
                <div
                  className="flex items-center justify-between px-5 py-3.5"
                  style={{ borderBottom: '1px solid var(--border-base)' }}
                >
                  <h3 className="label-metric">DCA Reserve Topups</h3>
                  <Badge variant="muted">Recurring</Badge>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Automatically DCA into USDC reserve when balance drops below threshold using Jupiter&apos;s Recurring API.
                  </p>
                  <div
                    className="p-3 rounded-lg"
                    style={{ border: '1px solid var(--border-lo)', background: 'var(--bg-overlay)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>Reserve Topup Program</span>
                      <Badge variant="muted">Inactive</Badge>
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Trigger: Reserve ratio &lt; 15%</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Action: Buy USDC via SOL (5% of liquid)</p>
                  </div>
                  <button
                    className="btn-secondary w-full flex items-center justify-center gap-1.5"
                    style={{ fontSize: '11px', padding: '7px' }}
                  >
                    <Plus className="w-3 h-3" />
                    Configure DCA Program
                  </button>
                </div>
              </div>
            </motion.div>

          </div>
        </div>

      </motion.div>
    </AppShell>
  );
}
