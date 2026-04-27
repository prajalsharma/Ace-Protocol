'use client';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, Code2, Shield, Zap, Box, Globe, Cpu, Database, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(!open)}>
        <Icon className="w-4 h-4 text-orange-400 shrink-0" />
        <span className="flex-1 text-sm font-semibold text-white">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-600" /> : <ChevronRight className="w-4 h-4 text-gray-600" />}
      </button>
      {open && <div className="mt-4 pt-4 border-t border-[#1f1f2e]">{children}</div>}
    </Card>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-4 text-xs text-gray-300 overflow-x-auto leading-relaxed font-mono whitespace-pre">
      {children}
    </pre>
  );
}

function Prose({ children }: { children: string }) {
  return (
    <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{children}</div>
  );
}

export default function ArchitecturePage() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Hero */}
        <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-900/10 to-[#0c0c13] p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff6b2b] to-[#f4a935] flex items-center justify-center fire-glow shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ACE Protocol — System Architecture</h1>
              <p className="text-gray-400 text-sm mt-1">Adaptive Cashflow Engine · Full-Stack Solana Protocol · v0.1.0-alpha</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Anchor 0.30', 'Next.js 15', 'TypeScript', 'Solana Devnet', 'AI Policy Engine'].map(t => (
                  <Badge key={t} variant="muted">{t}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Product summary */}
        <Section title="Product Summary" icon={Box} defaultOpen>
          <Prose>{`ACE Protocol is a Solana-native execution-aware cashflow automation engine. Users deposit stablecoins or SOL into a PDA-controlled vault. ACE allocates capital across yield strategies (Hylo-compatible), maintains a configurable liquidity reserve, predicts upcoming payment obligations, and executes automated payouts via integrated payment rails (Sphere-compatible) — all while optimizing execution quality through MEV-aware routing (Jito/Raiku-compatible).

The core novelty: ACE is not just a yield vault. It is a programmable financial agent that connects DeFi yield to real-world payment needs, exposing a personal-finance UX instead of a trading terminal.

Why Solana: Sub-second finality, sub-cent fees, composable on-chain primitives, and native account architecture make Solana ideal for the frequent small-value operations (rebalances, payouts, fee collection) this protocol requires.

Why feasible: Adapter-driven architecture isolates each integration. The MVP can demo end-to-end flow with stub adapters and simulated vault state while protocol contracts are being finalized.`}</Prose>
        </Section>

        {/* System architecture diagram */}
        <Section title="System Architecture Diagram" icon={Globe} defaultOpen>
          <CodeBlock>{`┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│   Next.js Frontend (wallet connect, dashboard, onboarding)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ RPC + events
┌──────────────────────────▼──────────────────────────────────┐
│                    ON-CHAIN LAYER (Solana)                   │
│                                                             │
│  ace_vault program         ace_payments program             │
│  ┌───────────────────┐    ┌──────────────────────────┐      │
│  │ VaultState PDA    │    │ ScheduledPayment PDA      │      │
│  │ AllocationPolicy  │    │ PayoutRecord              │      │
│  │ ReserveBuffer     │    │ Idempotency nonce         │      │
│  └──────────┬────────┘    └───────────┬──────────────┘      │
│             │ CPI                     │ CPI                  │
│  ace_config program (fee, pause, whitelist, treasury)        │
└─────────────┬───────────────┬─────────────────────────────── ┘
              │ events        │ state reads
┌─────────────▼───────────────▼────────────────────────────── ┐
│                   BACKEND SERVICES (TypeScript)              │
│                                                             │
│  Indexer/Listener ──► Scheduler ──► Policy Engine           │
│                            │              │                  │
│                    Execution Router    AI Module             │
│                            │                                 │
│              ┌─────────────┼─────────────────┐              │
│              ▼             ▼                 ▼               │
│    YieldAdapter   PaymentAdapter   ExecutionAdapter          │
│    (Hylo-compat)  (Sphere-compat)  (Jito/Raiku-compat)       │
└─────────────────────────────────────────────────────────────┘`}</CodeBlock>
        </Section>

        {/* Smart contract modules */}
        <Section title="Smart Contract Modules (Anchor)" icon={Code2}>
          <div className="space-y-4">
            <CodeBlock>{`// ace_vault — Core vault logic
pub struct VaultState {
    pub owner: Pubkey,            // wallet owning this vault
    pub bump: u8,                 // PDA bump seed
    pub status: VaultStatus,      // Active | Paused | Emergency
    pub total_deposited: u64,     // lamports equivalent
    pub yield_balance: u64,
    pub reserve_balance: u64,
    pub liquid_balance: u64,
    pub payments_balance: u64,
    pub allocation: AllocationPolicy,
    pub last_rebalanced_slot: u64,
    pub risk_level: RiskLevel,
    pub version: u8,              // upgrade safety
}

pub struct AllocationPolicy {
    pub yield_bps: u16,           // target % * 100
    pub reserve_bps: u16,
    pub liquid_bps: u16,
    pub payments_bps: u16,
    // invariant: sum == 10_000
}

// ace_payments — Scheduled payment records
pub struct ScheduledPayment {
    pub vault: Pubkey,
    pub recipient: Pubkey,
    pub amount_lamports: u64,
    pub currency_mint: Pubkey,
    pub recurrence: Recurrence,
    pub next_due_ts: i64,
    pub nonce: u64,               // replay protection
    pub status: PaymentStatus,
    pub executed_at: Option<i64>,
}

// ace_config — Protocol-wide settings (admin-controlled)
pub struct ProtocolConfig {
    pub treasury: Pubkey,
    pub yield_fee_bps: u16,       // fee on yield harvested
    pub payout_fee_bps: u16,      // fee per automated payout
    pub pause_authority: Pubkey,
    pub is_paused: bool,
    pub strategy_whitelist: Vec<Pubkey>,
}`}</CodeBlock>

            <div className="text-sm text-gray-400 space-y-1">
              <p className="font-semibold text-white">Instructions:</p>
              {[
                'create_vault — initialize PDA vault for wallet owner',
                'deposit — transfer tokens into vault, emit DepositEvent',
                'withdraw — validate reserve ratio, emit WithdrawEvent',
                'set_allocation_policy — update target % split',
                'rebalance — crank: realign actual vs target allocation',
                'execute_payout — consume ScheduledPayment nonce, pay recipient',
                'schedule_payment — register a new ScheduledPayment PDA',
                'cancel_payment — mark payment cancelled (idempotent)',
                'harvest_yield — CPI to yield adapter, collect and credit yield',
                'collect_fee — move fee amount to treasury',
                'emergency_pause — pause_authority only, blocks all user actions',
                'resume_vault — re-activate after emergency pause',
              ].map(i => (
                <div key={i} className="flex items-start gap-2 pl-2">
                  <span className="text-orange-400/60 mt-0.5">›</span>
                  <span className="font-mono text-xs">{i}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Backend services */}
        <Section title="Backend Service Breakdown" icon={Database}>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { name: 'Indexer/Listener', desc: 'Subscribes to program logs via RPC WebSocket. Parses events (DepositEvent, PayoutEvent, RebalanceEvent) and persists to local DB.' },
              { name: 'Scheduler', desc: 'Cron-style runner that checks ScheduledPayment PDAs against current timestamp. Queues due payments for execution.' },
              { name: 'Policy Engine', desc: 'Evaluates vault state against allocation policy. Determines when to trigger rebalance, harvest, or payout. Checks all guardrails before acting.' },
              { name: 'Execution Router', desc: 'Selects optimal execution path for each transaction. Integrates with Jito/Raiku adapters for priority fees and MEV protection.' },
              { name: 'Yield Adapter', desc: 'Interface to Hylo-compatible yield protocols. Handles deposit, withdraw, position valuation, and yield harvest via clean adapter contract.' },
              { name: 'Payment Adapter', desc: 'Interface to Sphere-compatible payment rails. Sends USDC to on-chain wallets or off-ramp to bank accounts. Handles idempotency.' },
            ].map(({ name, desc }) => (
              <div key={name} className="p-3 rounded-lg border border-[#2a2a3a] bg-[#0f0f16]">
                <p className="text-sm font-semibold text-white mb-1">{name}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Security checklist */}
        <Section title="Security Checklist" icon={Shield}>
          <div className="space-y-2">
            {[
              { item: 'PDA ownership validation on every instruction — vaults are non-custodial', done: true },
              { item: 'Nonce-based replay protection on all execute_payout calls', done: true },
              { item: 'Oracle staleness guard: reject price feeds older than N slots', done: true },
              { item: 'Reserve ratio invariant enforced on-chain before every withdrawal/rebalance', done: true },
              { item: 'Emergency pause authority is a separate key from admin; requires multi-sig in production', done: true },
              { item: 'Strategy whitelist prevents allocation to unreviewed protocols', done: true },
              { item: 'Input validation on all deposit/withdraw amounts (>0, <=balance)', done: true },
              { item: 'Fee basis points cap (max 500 bps = 5%) enforced in config constraints', done: true },
              { item: 'Idempotency key (reference) required on all payment adapter calls', done: true },
              { item: 'AI policy engine cannot directly sign transactions — emits decisions for backend to act on', done: true },
              { item: 'All external integration adapters wrapped in try/catch with retry backoff + circuit breaker', done: true },
              { item: 'Slippage tolerance configured per-route; fallback route available if primary fails', done: true },
              { item: 'Treasury address is a cold-storage multisig — protocol fees are not auto-compounded', done: false },
              { item: 'Formal audit before mainnet deployment', done: false },
            ].map(({ item, done }) => (
              <div key={item} className="flex items-start gap-2 text-xs">
                <span className={cn('mt-0.5 shrink-0', done ? 'text-emerald-400' : 'text-yellow-400/50')}>
                  {done ? '✓' : '○'}
                </span>
                <span className={done ? 'text-gray-400' : 'text-gray-600'}>{item}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* MVP scope */}
        <Section title="48-Hour Hackathon MVP Scope" icon={Zap}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">Build first (core demo path)</p>
              <div className="space-y-1">
                {[
                  'Anchor vault program: create_vault, deposit, withdraw, set_allocation_policy',
                  'Mock yield adapter returning simulated APY + harvest amounts',
                  'Scheduler backend checking for scheduled payments (in-memory)',
                  'execute_payout instruction with nonce replay protection',
                  'Next.js frontend: onboarding → dashboard → vault → payments',
                  'Simulation mode toggle so demo works without real wallet',
                ].map(i => <p key={i} className="text-xs text-gray-400 pl-2 flex gap-2"><span className="text-orange-400/60 shrink-0">1.</span>{i}</p>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">Build second (differentiators)</p>
              <div className="space-y-1">
                {[
                  'AI insights feed with deterministic heuristics (no LLM needed for demo)',
                  'Execution quality metrics display (simulated Jito route selection)',
                  'Emergency pause button demonstrating fail-safe controls',
                  'Architecture / docs page for judges',
                ].map(i => <p key={i} className="text-xs text-gray-400 pl-2 flex gap-2"><span className="text-yellow-400/60 shrink-0">2.</span>{i}</p>)}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Post-hackathon</p>
              <div className="space-y-1">
                {[
                  'Real Hylo/Sphere/Jito adapter integrations',
                  'LLM-powered cashflow explanations (Claude API)',
                  'Mainnet deployment + audit',
                  'Mobile app + push notifications',
                ].map(i => <p key={i} className="text-xs text-gray-600 pl-2 flex gap-2"><span className="text-gray-700 shrink-0">3.</span>{i}</p>)}
              </div>
            </div>
          </div>
        </Section>

        {/* Pitch */}
        <Section title="Judge Pitch" icon={Cpu}>
          <div className="space-y-3 text-sm text-gray-400 leading-relaxed">
            <p className="text-white font-semibold text-base">ACE Protocol — Adaptive Cashflow Engine</p>
            <p>
              Solana's DeFi ecosystem has solved yield. It has not solved <em className="text-orange-300">cashflow</em>. Most users still can't answer three basic questions: "How much can I safely spend today?", "Will I have enough for next month's bills?", and "Am I paying too much in slippage?".
            </p>
            <p>
              ACE Protocol answers all three. It is a personal cashflow engine that sits on top of Solana's composable primitives — Hylo for yield, Jito for execution, Sphere for payment rails — and stitches them into an automated, policy-driven system accessible to users who have never touched a DeFi terminal.
            </p>
            <p>
              The technical novelty is the <strong className="text-white">execution-awareness layer</strong>: ACE doesn't just optimize yield, it optimizes the cost of executing financial actions. Every rebalance, every payout, every harvest is routed through a live cost estimator that batches when beneficial and falls back gracefully when primary routes fail.
            </p>
            <p>
              The guardrail architecture ensures the AI layer never becomes a liability: every automated action is bounded by on-chain invariants. Reserve ratios enforced in smart contract logic. Manual approval thresholds. Oracle freshness checks. Emergency pause. The system is trustless where it can be and transparent where it must delegate.
            </p>
            <p className="text-orange-300 font-medium">
              Capital efficiency meets execution intelligence, wrapped in a product that feels like a fintech app, not a blockchain interface. That's the voyage. Welcome aboard.
            </p>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
