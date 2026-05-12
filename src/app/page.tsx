'use client';

import Link from 'next/link';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy, useSolanaWallets } from '@privy-io/react-auth';
import {
  ArrowRight, BrainCircuit, ChevronRight, Clock3, LockKeyhole,
  AlertTriangle, GitBranch, Eye, ShieldOff, ShieldCheck, Zap, Bot,
  CheckCircle2, XCircle, Search,
} from 'lucide-react';
import { ProtocolFlowAnimation } from '@/components/landing/ProtocolFlowAnimation';
import { WalletScanner } from '@/components/landing/WalletScanner';
import { AceMark } from '@/components/brand/AceMark';

/* ─────────────────────────────────────────────────────────────────────────────
   Motion system — impeccable.style:
   • Exponential ease-out only (real objects decelerate smoothly)
   • Animate transform + opacity only — never width/height/top/left
   • Entrances 650–850ms, state feedback 180–250ms
   • prefers-reduced-motion handled via globals.css
───────────────────────────────────────────────────────────────────────────── */

const E: [number, number, number, number] = [0.16, 1, 0.3, 1];   // ease-out-expo
const EC: [number, number, number, number] = [0.22, 1, 0.36, 1]; // cinematic

// tasteskill.dev: staggered reveal rhythm — never fire all at once
const up = (d = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-5%' },
  transition: { duration: 0.72, ease: E, delay: d },
});

// For hero elements that are already visible on mount — use animate not whileInView
const upMount = (d = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.72, ease: E, delay: d },
});

function Reveal({
  children, delay = 0, className = '',
}: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useInView(ref, { once: true, margin: '-5%' });
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y: 22 }}
      animate={v ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.76, ease: E, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Design system primitives
   tasteskill.dev: every typographic token is intentional
───────────────────────────────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.30em]"
      style={{ color: '#4a6090' }}>
      {children}
    </span>
  );
}

function SectionLabel({ children, teal }: { children: React.ReactNode; teal?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="h-px w-10 rounded-full" style={{ background: teal ? 'rgba(45,212,191,0.4)' : 'rgba(255,255,255,0.12)' }} />
      <Label>{children}</Label>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Wallet button — real Privy integration preserved
───────────────────────────────────────────────────────────────────────────── */

function ConnectButton({ size = 'default' }: { size?: 'default' | 'lg' }) {
  const router = useRouter();
  const { authenticated, login, ready } = usePrivy();
  const { wallets } = useSolanaWallets();
  const connected = authenticated && wallets.length > 0;

  useEffect(() => {
    if (connected) router.push('/dashboard');
  }, [connected, router]);

  const isLg = size === 'lg';

  return (
    <motion.button
      onClick={() => { if (!connected) login(); }}
      disabled={!ready}
      whileHover={{ y: -1.5 }}
      whileTap={{ y: 0 }}
      transition={{ duration: 0.18, ease: E }}
      className={`relative inline-flex items-center justify-center gap-2.5 overflow-hidden font-semibold transition-shadow disabled:opacity-50 disabled:cursor-not-allowed ${isLg ? 'rounded-[14px] px-8 py-4 text-[14.5px]' : 'rounded-[12px] px-5 py-2.5 text-[13px]'}`}
      style={{
        background: 'linear-gradient(135deg, #2dd4bf 0%, #0ea5a0 50%, #0d9488 100%)',
        color: '#021210',
        boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 1px rgba(45,212,191,0.3)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 1px rgba(45,212,191,0.3), 0 12px 40px rgba(45,212,191,0.30)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 0 rgba(255,255,255,0.15) inset, 0 0 0 1px rgba(45,212,191,0.3)'; }}
    >
      {connected ? 'Open Dashboard' : 'Connect Wallet'}
      {!connected && <ArrowRight className="h-3.5 w-3.5" />}
    </motion.button>
  );
}

function NavLoginWrapper() {
  const { login } = usePrivy();
  return <WalletScanner onLogin={login} />;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Pain card
   tasteskill.dev: glass surface, intentional icon color, editorial copy
───────────────────────────────────────────────────────────────────────────── */

function PainCard({
  icon: Icon, title, body, accent,
}: {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.22, ease: E } }}
      className="group relative flex flex-col h-full rounded-[20px] p-6"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
      }}
    >
      {/* Hover glow — impeccable.style: only opacity transitions */}
      <div className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{ background: `radial-gradient(ellipse at 20% 0%, ${accent}0d 0%, transparent 65%)` }} />

      {/* Top accent strip */}
      <div className="absolute inset-x-0 top-0 h-px rounded-t-[20px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}44, transparent)`, opacity: 0 }}
      />
      <div className="absolute inset-x-0 top-0 h-px rounded-t-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-400"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}66, transparent)` }} />

      <div className="relative mb-5 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `${accent}12`, border: `1px solid ${accent}20` }}>
        <Icon className="h-[17px] w-[17px]" style={{ color: accent }} />
      </div>

      <h3 className="relative font-semibold leading-snug tracking-[-0.025em] text-white"
        style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
        {title}
      </h3>
      <p className="relative mt-3 text-[0.9rem] leading-[1.85]"
        style={{ color: 'rgba(180,190,220,0.58)' }}>
        {body}
      </p>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Flow step — timeline with connector
───────────────────────────────────────────────────────────────────────────── */

function FlowStep({ n, title, body, accent, last }: {
  n: string; title: string; body: string; accent: string; last?: boolean;
}) {
  return (
    <div className="relative flex gap-6">
      <div className="relative flex-shrink-0 flex flex-col items-center">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full z-10"
          style={{ background: `${accent}14`, border: `1.5px solid ${accent}44` }}>
          <span className="text-[11px] font-mono font-700" style={{ color: accent }}>{n}</span>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-0 group-hover:opacity-20"
            style={{ background: accent }} />
        </div>
        {!last && (
          <div className="absolute top-10 bottom-0 left-1/2 w-px -translate-x-1/2"
            style={{
              height: 'calc(100% + 28px)',
              background: `linear-gradient(180deg, ${accent}30, transparent)`,
            }} />
        )}
      </div>
      <div className="pb-12 pt-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] mb-3" style={{ color: accent }}>Step {n}</p>
        <h3 className="font-semibold text-white leading-snug tracking-[-0.025em]"
          style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>
          {title}
        </h3>
        <p className="mt-3 text-[0.95rem] leading-[1.9]"
          style={{ color: 'rgba(180,190,220,0.58)' }}>
          {body}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Mode card
   ui-ux-pro-max: Trust & Authority — confident, minimal, institutional
───────────────────────────────────────────────────────────────────────────── */

function ModeCard({
  mode, label, headline, accent1, accent2, sub, features, featured,
}: {
  mode: 'safe' | 'auto';
  label: string;
  headline: React.ReactNode;
  accent1: string;
  accent2: string;
  sub: string;
  features: { text: string; yes: boolean }[];
  featured?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2, ease: E } }}
      className="relative flex h-full flex-col rounded-[24px] p-8 lg:p-10"
      style={{
        background: featured
          ? `linear-gradient(145deg, ${accent1}0b, rgba(8,14,28,0.95))`
          : 'linear-gradient(145deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
        border: `1px solid ${featured ? `${accent1}30` : 'rgba(255,255,255,0.07)'}`,
        boxShadow: featured ? `0 0 80px ${accent1}0c` : 'none',
      }}
    >
      {/* Top glow line */}
      <div className="absolute inset-x-0 top-0 h-px rounded-t-[24px]"
        style={{ background: `linear-gradient(90deg, transparent 5%, ${accent1}55 50%, transparent 95%)` }} />

      {featured && (
        <div className="mb-7">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ background: `${accent1}12`, color: accent1, border: `1px solid ${accent1}25` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent1, boxShadow: `0 0 6px ${accent1}` }} />
            Recommended default
          </span>
        </div>
      )}

      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-[14px]"
        style={{ background: `${accent1}0e`, border: `1px solid ${accent1}20` }}>
        {mode === 'safe'
          ? <ShieldCheck className="h-[18px] w-[18px]" style={{ color: accent1 }} />
          : <Bot className="h-[18px] w-[18px]" style={{ color: accent1 }} />}
      </div>

      <Label>{label}</Label>

      <div className="mt-4 font-display font-700 leading-[1.1] tracking-[-0.05em] text-white"
        style={{ fontSize: 'clamp(1.6rem,2.5vw,2rem)' }}>
        {headline}
      </div>

      <p className="mt-4 text-[0.94rem] leading-[1.85]" style={{ color: 'rgba(180,190,220,0.55)' }}>
        {sub}
      </p>

      <div className="mt-7 flex-1 space-y-3.5">
        {features.map(({ text, yes }) => (
          <div key={text} className="flex items-start gap-3">
            {yes
              ? <CheckCircle2 className="mt-0.5 h-[15px] w-[15px] flex-shrink-0" style={{ color: accent1 }} />
              : <XCircle className="mt-0.5 h-[15px] w-[15px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.12)' }} />
            }
            <span className="text-[0.9rem] leading-snug"
              style={{ color: yes ? 'rgba(210,220,240,0.78)' : 'rgba(255,255,255,0.22)' }}>
              {text}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent1}44, transparent 70%)` }} />
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Integration card — premium 4×2 grid
───────────────────────────────────────────────────────────────────────────── */

function IntCard({ name, tag, color, desc }: { name: string; tag: string; color: string; desc: string }) {
  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
      className="group relative flex flex-col gap-4 rounded-[20px] p-6"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(ellipse at 30% 0%, ${color}10 0%, transparent 60%)` }} />
      <div className="absolute inset-x-0 top-0 h-px rounded-t-[20px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${color}55, transparent)` }} />
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl relative"
          style={{ background: `${color}13`, border: `1px solid ${color}22` }}>
          <span className="relative h-3 w-3 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}88` }} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] px-2.5 py-1 rounded-full"
          style={{ background: `${color}12`, color, border: `1px solid ${color}22` }}>
          {tag}
        </span>
      </div>
      <div>
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-white mb-1.5"
          style={{ fontFamily: 'var(--font-display)' }}>
          {name}
        </p>
        <p className="text-[13px] leading-[1.75]"
          style={{ color: 'rgba(180,190,220,0.5)' }}>
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Number stat
───────────────────────────────────────────────────────────────────────────── */

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-display font-800 leading-none tracking-[-0.06em] text-white"
        style={{ fontSize: 'clamp(2.2rem,3.5vw,3rem)' }}>
        {n}
      </div>
      <div className="mt-2 text-[0.825rem] font-medium" style={{ color: 'rgba(180,190,220,0.5)' }}>
        {label}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */

export default function LandingPage() {

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const heroO = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  const pain = [
    { icon: Clock3,       title: 'No recurring payment layer',  body: 'Solana has no native way to schedule repeating payments. Every recurring obligation requires manual intervention.',          accent: '#f43f5e' },
    { icon: ShieldOff,    title: 'Unsafe autonomous execution',  body: 'Autonomous treasury tools either require full custody or have no policy enforcement — leaving teams exposed.',               accent: '#f97316' },
    { icon: Eye,          title: 'Zero treasury visibility',     body: 'Protocols, DAOs, and teams have no unified view of upcoming obligations, reserve health, or cashflow timing.',               accent: '#eab308' },
    { icon: AlertTriangle,title: 'Fragmented operations',        body: 'Payroll, subscriptions, API bills, and infrastructure costs live across wallets with no structured execution layer.',        accent: '#a855f7' },
    { icon: GitBranch,    title: 'Manual approval burden',       body: "Every payment requires a human to sign. There's no way to pre-approve policy-bound recurring transactions.",                 accent: '#3b82f6' },
  ];

  const steps = [
    { n: '01', title: 'Connect Treasury',       body: 'Connect your wallet for read-only access. ACE reads your on-chain balance and history — no custody transferred.',                                     accent: '#c8a3ff' },
    { n: '02', title: 'Detect Recurring',       body: 'The AI layer analyzes your transaction history to surface recurring patterns: payroll cycles, subscriptions, infrastructure bills, and API payments.', accent: '#5bc8ff' },
    { n: '03', title: 'Build Execution Plan',   body: 'ACE constructs a forward-looking queue with timing estimates, reserve impact analysis, and recommended execution windows.',                            accent: '#2de0a0' },
    { n: '04', title: 'Execute Within Policy',  body: 'Payments run through your defined policy: spending caps, destination whitelists, time windows, and risk thresholds. Every execution is auditable.',   accent: '#ff8c52' },
  ];

  const integrations = [
    { name: 'Jupiter',  tag: 'Routing',     color: '#f59e0b', desc: 'Optimal token swap routing for treasury rebalancing and execution.' },
    { name: 'pay.sh',   tag: 'Machine pay', color: '#5bc8ff', desc: 'Machine-native payment layer for AI agent infrastructure billing.' },
    { name: 'x402',     tag: 'HTTP pay',    color: '#c8a3ff', desc: 'Pay-per-request HTTP monetization via on-chain micropayments.' },
    { name: 'Cloak',    tag: 'Privacy',     color: '#a855f7', desc: 'Private transfers with stealth addressing for sensitive payrolls.' },
    { name: 'QVAC',     tag: 'Local AI',    color: '#2de0a0', desc: 'On-device AI inference for private treasury analysis, no data leaves.' },
    { name: 'Ika',      tag: 'MPC custody', color: '#fb923c', desc: 'Threshold signature custody for institutional-grade key management.' },
    { name: 'Jito',     tag: 'Execution',   color: '#ef4444', desc: 'MEV-protected transaction execution with bundle optimization.' },
    { name: 'Encrypt',  tag: 'E2E encrypt', color: '#818cf8', desc: 'End-to-end encrypted payment instructions and policy storage.' },
  ];

  return (
    <div style={{
      background: '#020408',
      fontFamily: 'var(--font-body)',
      color: 'rgba(200,210,230,0.85)',
      overflowX: 'hidden',
      minHeight: '100vh',
    }}>

      {/* ──────────────────────────────────────────────────────────────────────
          BACKGROUND CANVAS — deep institutional atmosphere
          tasteskill.dev: intentional depth, not random gradients
      ────────────────────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        {/* Primary violet orb — upper left */}
        <div className="absolute" style={{
          top: '-10%', left: '-8%',
          width: '60vw', height: '60vw',
          maxWidth: 900, maxHeight: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
        {/* Teal accent — upper right */}
        <div className="absolute" style={{
          top: '5%', right: '-5%',
          width: '40vw', height: '40vw',
          maxWidth: 600, maxHeight: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(45,212,191,0.055) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }} />
        {/* Deep glow bottom center */}
        <div className="absolute" style={{
          bottom: '30%', left: '50%',
          transform: 'translateX(-50%)',
          width: '80vw', height: '60vw',
          maxWidth: 1200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(88,28,135,0.04) 0%, transparent 60%)',
          filter: 'blur(60px)',
        }} />
        {/* Subtle grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black 20%, transparent 70%)',
        }} />
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          NAV
          tasteskill.dev: asymmetric, spacious — logo dominant, links receded
      ────────────────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 backdrop-blur-2xl" style={{
        background: 'rgba(2,4,8,0.82)',
        borderBottom: '1px solid rgba(255,255,255,0.055)',
      }}>
        <div className="mx-auto flex h-[70px] max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-12">

          <div className="flex items-center gap-4">
            <AceMark className="h-[42px] w-[42px]" glow />
            <div style={{ lineHeight: 1 }}>
              <div className="text-[15px] font-700 text-white tracking-[-0.04em]"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}>
                ACE Protocol
              </div>
              <div className="mt-[5px] text-[8.5px] font-medium uppercase tracking-[0.26em]"
                style={{ color: 'rgba(94,234,212,0.65)' }}>
                Treasury Autopilot · Solana
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-7">
            {[
              { href: '#problem', label: 'Problem' },
              { href: '#flow',    label: 'How it works' },
              { href: '#modes',   label: 'Modes' },
              { href: '#analyze', label: 'Try free' },
            ].map(({ href, label }) => (
              <a key={href} href={href}
                className="text-[13px] font-medium transition-colors duration-200 hover:text-white"
                style={{ color: 'rgba(200,210,230,0.4)' }}>
                {label}
              </a>
            ))}
          </div>

          <ConnectButton />
        </div>
      </nav>

      <main style={{ position: 'relative', zIndex: 1 }}>

        {/* ────────────────────────────────────────────────────────────────────
            HERO
            tasteskill.dev: massive typographic statement, immersive depth
            impeccable.style: entrance stagger, parallax on left col only
        ──────────────────────────────────────────────────────────────────── */}
        <section ref={heroRef}
          className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12"
          style={{ paddingTop: 'clamp(72px, 10vw, 128px)', paddingBottom: 0 }}>

          <div className="grid lg:grid-cols-[1fr_1.08fr] lg:items-center lg:gap-0">

            {/* ── Left ── */}
            <motion.div style={{ y: heroY, opacity: heroO }}
              className="relative z-10 pb-12 lg:pb-44 lg:pr-14">

              {/* Live status badge */}
              <motion.div {...upMount(0)}>
                <span className="inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.2em]"
                  style={{
                    background: 'rgba(45,212,191,0.05)',
                    border: '1px solid rgba(45,212,191,0.18)',
                    color: '#5eead4',
                  }}>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute h-full w-full rounded-full animate-ping opacity-50"
                      style={{ background: '#2dd4bf' }} />
                    <span className="relative h-2 w-2 rounded-full" style={{ background: '#5eead4' }} />
                  </span>
                  AI-Assisted Treasury · Solana Devnet
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1 {...upMount(0.06)}
                style={{
                  marginTop: '2rem',
                  fontFamily: "'Outfit', system-ui, sans-serif",
                  fontSize: 'clamp(3.5rem, 7vw, 7.5rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.05em',
                  lineHeight: 0.92,
                  color: '#fff',
                }}>
                Your Solana<br />
                assets on<br />
                <span style={{ color: '#2dd4bf' }}>autopilot.</span>
              </motion.h1>

              {/* Sub */}
              <motion.p {...upMount(0.14)}
                className="mt-8 text-[1.05rem] leading-[1.85]"
                style={{ color: 'rgba(180,190,220,0.65)', maxWidth: 460 }}>
                AI-assisted recurring payments and reserve-aware treasury automation — policy-enforced, non-custodial, built for Solana.
              </motion.p>

              {/* Micro pills */}
              <motion.div {...upMount(0.20)} className="mt-7 flex flex-wrap gap-2">
                {[
                  { icon: ShieldCheck, text: 'Reserve-aware' },
                  { icon: Zap,         text: 'Execution routing' },
                  { icon: BrainCircuit,text: 'AI-native' },
                  { icon: LockKeyhole, text: 'Policy enforced' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text}
                    className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px]"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(200,210,230,0.7)',
                    }}>
                    <Icon className="h-3.5 w-3.5 opacity-60" />
                    {text}
                  </div>
                ))}
              </motion.div>

              {/* CTA row */}
              <motion.div {...upMount(0.27)} className="mt-10 flex flex-wrap items-center gap-4">
                <ConnectButton size="lg" />
                <a href="#analyze"
                  className="inline-flex items-center gap-2 rounded-[14px] text-[13.5px] font-medium transition-all hover:text-white"
                  style={{
                    color: 'rgba(200,210,230,0.55)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '14px 24px',
                  }}>
                  Analyze my treasury
                  <Search className="h-3.5 w-3.5" />
                </a>
              </motion.div>

              {/* Stats */}
              <motion.div {...upMount(0.34)}
                className="mt-14 flex items-center gap-10 flex-wrap"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '2rem' }}>
                <Stat n="100%" label="Non-custodial" />
                <Stat n="∞" label="Auditable logs" />
                <Stat n="SOL" label="Solana devnet" />
              </motion.div>
            </motion.div>

            {/* ── Right: animated product scene ── */}
            <motion.div {...up(0.07)} className="relative lg:h-[100vh] lg:min-h-[700px]">
              {/* Fade edges */}
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-[#020408] to-transparent lg:hidden" />
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#020408] to-transparent hidden lg:block" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-[#020408] to-transparent" />

              {/* Floating data pills — real product data, purposeful */}
              {[
                { pos: 'left-[4%] top-[20%]', delay: 0.48, color: '#c8a3ff', border: 'rgba(200,163,255,0.2)', label: 'Capital classified', sub: 'deposit.classify()' },
                { pos: 'right-[4%] top-[30%]', delay: 0.54, color: '#2de0a0', border: 'rgba(45,224,160,0.2)', label: 'Reserve: 112%', sub: 'coverage: healthy', pulse: true },
                { pos: 'right-[6%] bottom-[28%]', delay: 0.60, color: '#5bc8ff', border: 'rgba(91,200,255,0.2)', label: 'Queue: 4 items', sub: 'next_due: 3d' },
                { pos: 'left-[6%] bottom-[30%]', delay: 0.56, color: '#ff8c52', border: 'rgba(255,140,82,0.2)', label: 'AI insight', sub: 'payroll in 4d', bot: true },
              ].map(({ pos, delay, color, border, label, sub, pulse, bot }) => (
                <div key={label} className={`pointer-events-none absolute z-20 hidden lg:block ${pos}`}>
                  <motion.div {...up(delay)}
                    className="rounded-2xl px-4 py-3"
                    style={{ background: 'rgba(4,6,16,0.90)', border: `1px solid ${border}`, backdropFilter: 'blur(16px)', minWidth: 140 }}>
                    <div className="flex items-center gap-2" style={{ color }}>
                      {bot
                        ? <Bot className="h-3 w-3" />
                        : <span className={`h-1.5 w-1.5 rounded-full ${pulse ? 'animate-pulse' : ''}`} style={{ background: color }} />
                      }
                      <span className="text-[11px] font-medium">{label}</span>
                    </div>
                    <div className="mt-1 font-mono text-[9.5px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{sub}</div>
                  </motion.div>
                </div>
              ))}

              <div className="relative h-[520px] w-full sm:h-[640px] lg:absolute lg:inset-0 lg:h-full">
                <ProtocolFlowAnimation />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Scroll indicator */}
        <div className="flex justify-center py-12">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.8 }}
            className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em]"
            style={{ color: 'rgba(255,255,255,0.15)' }}>
            Scroll
            <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}>
              <ChevronRight className="h-3.5 w-3.5 rotate-90" />
            </motion.div>
          </motion.div>
        </div>

        {/* ────────────────────────────────────────────────────────────────────
            INTEGRATIONS GRID — premium 4×2 layout
            tasteskill.dev: ecosystem credibility, balanced visual weight
        ──────────────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12 pb-28">
          <Reveal>
            <div className="text-center mb-12">
              <SectionLabel>Ecosystem Integrations</SectionLabel>
              <h2 className="font-display font-700 text-white leading-[1.0] tracking-[-0.05em]"
                style={{ fontSize: 'clamp(2rem,3.8vw,3.4rem)' }}>
                Built on the most powerful<br />
                <span style={{
                  background: 'linear-gradient(135deg, #c8a3ff 0%, #a855f7 40%, #5bc8ff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>Solana infrastructure.</span>
              </h2>
              <p className="mx-auto mt-5 text-[1rem] leading-[1.85]"
                style={{ color: 'rgba(180,190,220,0.48)', maxWidth: 480 }}>
                Eight protocol integrations powering every layer of ACE — from private execution to on-chain AI.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {integrations.map(i => <IntCard key={i.name} {...i} />)}
            </div>
          </Reveal>
        </section>

        {/* ────────────────────────────────────────────────────────────────────
            PROBLEM
            tasteskill.dev: section divider with editorial header
        ──────────────────────────────────────────────────────────────────── */}
        <section id="problem"
          className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12"
          style={{ paddingTop: 'clamp(64px,8vw,112px)', paddingBottom: 'clamp(80px,10vw,140px)' }}>

          <Reveal>
            <SectionLabel>The Problem</SectionLabel>
            <div className="grid lg:grid-cols-[1fr_auto] lg:items-end gap-10 mb-16">
              <h2 className="font-display font-700 text-white leading-[1.0] tracking-[-0.055em]"
                style={{ fontSize: 'clamp(2.8rem,5.5vw,5.2rem)' }}>
                Recurring payments<br />are still broken<br />
                <span style={{
                  background: 'linear-gradient(135deg, #fb923c 0%, #f59e0b 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>on Solana.</span>
              </h2>
              <p className="max-w-sm text-[1rem] leading-[1.9]" style={{ color: 'rgba(180,190,220,0.52)' }}>
                Protocols manage treasuries across spreadsheets and Discord threads. DAOs miss payroll windows. AI agents can&apos;t pay their own infrastructure bills. There&apos;s no execution layer.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {pain.map(({ icon, title, body, accent }, i) => (
              <Reveal key={title} delay={i * 0.05}>
                <PainCard icon={icon} title={title} body={body} accent={accent} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────────
            HOW IT WORKS — sticky left, timeline right
            tasteskill.dev: asymmetric layout, density 5, premium editorial
        ──────────────────────────────────────────────────────────────────── */}
        <section id="flow"
          className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12"
          style={{ paddingTop: 'clamp(64px,8vw,112px)', paddingBottom: 'clamp(80px,10vw,140px)' }}>

          <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-start">

            {/* Sticky left */}
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <SectionLabel>Product Flow</SectionLabel>
                <h2 className="font-display font-700 text-white leading-[1.0] tracking-[-0.05em]"
                  style={{ fontSize: 'clamp(2.2rem,4.2vw,3.8rem)' }}>
                  Four steps.<br />
                  <span style={{
                    background: 'linear-gradient(135deg, #5eead4, #2dd4bf)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}>Full control.</span>
                </h2>
                <p className="mt-6 text-[1rem] leading-[1.9]" style={{ color: 'rgba(180,190,220,0.52)', maxWidth: 380 }}>
                  ACE sits between your wallet and your obligations — classifying, queuing, and executing recurring payments through a transparent policy layer.
                </p>

                {/* AI stream preview card */}
                <div className="mt-10 rounded-[20px] p-5"
                  style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012))',
                    border: '1px solid rgba(255,255,255,0.07)',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.03) inset',
                  }}>
                  <p className="text-[9.5px] font-semibold uppercase tracking-[0.26em] mb-4" style={{ color: 'rgba(255,255,255,0.22)' }}>
                    Live AI insight stream
                  </p>
                  <div className="space-y-3">
                    {[
                      { text: '"AWS payment typically happens in 3 days."',          color: '#5bc8ff' },
                      { text: '"Reserve buffer may become unsafe next week."',        color: '#ff8c52' },
                      { text: '"This pattern matches monthly payroll cycle."',        color: '#c8a3ff' },
                      { text: '"Gas conditions are currently low — good window."',    color: '#2de0a0' },
                    ].map(({ text, color }) => (
                      <div key={text} className="flex items-start gap-3">
                        <BrainCircuit className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
                        <p className="text-[0.815rem] leading-[1.7]" style={{ color: 'rgba(180,190,220,0.55)' }}>{text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Timeline right */}
            <div className="pt-1">
              {steps.map(({ n, title, body, accent }, i) => (
                <Reveal key={n} delay={i * 0.07}>
                  <FlowStep n={n} title={title} body={body} accent={accent} last={i === steps.length - 1} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────────────────────────────
            OPERATING MODES
            ui-ux-pro-max: Trust & Authority, compact, decisive
        ──────────────────────────────────────────────────────────────────── */}
        <section id="modes"
          className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12"
          style={{ paddingTop: 'clamp(64px,8vw,112px)', paddingBottom: 'clamp(80px,10vw,140px)' }}>

          <Reveal>
            <div className="text-center mb-14">
              <SectionLabel>Operating Modes</SectionLabel>
              <h2 className="font-display font-700 text-white leading-[1.0] tracking-[-0.055em]"
                style={{ fontSize: 'clamp(2.4rem,4.8vw,4.5rem)' }}>
                You set the rules.<br />
                <span style={{
                  background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 40%, #2dd4bf 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  ACE follows them.
                </span>
              </h2>
              <p className="mx-auto mt-5 text-[1.02rem] leading-[1.88]"
                style={{ color: 'rgba(180,190,220,0.48)', maxWidth: 420 }}>
                Start in Safe Mode. Enable Autopilot when ready.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal delay={0.04}>
              <ModeCard
                mode="safe"
                label="Safe Mode · Default"
                headline={<>AI suggests.<br /><span style={{ color: '#2de0a0' }}>You approve.</span></>}
                accent1="#2de0a0"
                accent2="#0d9488"
                sub="Full visibility, zero surprises. The AI queues payments and shows reserve impact — you sign or skip each one."
                features={[
                  { text: 'AI analyzes and queues payments', yes: true },
                  { text: 'You approve every execution', yes: true },
                  { text: 'Reserve impact shown before signing', yes: true },
                  { text: 'Full AI suggestion audit log', yes: true },
                  { text: 'Autonomous execution', yes: false },
                ]}
                featured
              />
            </Reveal>
            <Reveal delay={0.09}>
              <ModeCard
                mode="auto"
                label="Autopilot Mode"
                headline={<>AI executes.<br /><span style={{ color: '#a78bfa' }}>Within limits.</span></>}
                accent1="#a78bfa"
                accent2="#7c3aed"
                sub="Define spending caps, whitelists, and time windows. ACE handles approved recurring payments automatically."
                features={[
                  { text: 'AI executes approved recurring payments', yes: true },
                  { text: 'Hard spending caps enforced per period', yes: true },
                  { text: 'Destination whitelist required', yes: true },
                  { text: 'Admin override always available', yes: true },
                  { text: 'Unrestricted AI fund access', yes: false },
                ]}
              />
            </Reveal>
          </div>

          {/* Security callout */}
          <Reveal delay={0.14}>
            <div className="mt-4 flex items-start gap-4 rounded-[18px] px-6 py-5"
              style={{
                background: 'rgba(255,255,255,0.018)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)' }}>
                <ShieldCheck className="h-4 w-4 text-[#fb7185]" />
              </div>
              <div>
                <p className="text-[0.9rem] font-semibold text-white" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                  Security guarantee
                </p>
                <p className="mt-1 text-[0.835rem] leading-[1.78]" style={{ color: 'rgba(180,190,220,0.45)' }}>
                  In both modes, ACE never has unrestricted fund access. Autopilot only handles payments within your pre-approved execution paths. Spending caps are hard-enforced on-chain. No AI can override a policy you set.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ────────────────────────────────────────────────────────────────────
            WALLET ANALYZER
            Real product feature — not marketing fluff
        ──────────────────────────────────────────────────────────────────── */}
        <section id="analyze"
          className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12"
          style={{ paddingTop: 'clamp(64px,8vw,112px)', paddingBottom: 'clamp(80px,10vw,140px)' }}>

          <Reveal>
            <div className="text-center mb-12">
              <SectionLabel teal>Free · No signup required</SectionLabel>
              <h2 className="font-display font-700 text-white leading-[1.04] tracking-[-0.05em]"
                style={{ fontSize: 'clamp(2.2rem,4.2vw,3.8rem)' }}>
                See inside your<br />
                <span style={{
                  background: 'linear-gradient(135deg, #5eead4, #2dd4bf, #0d9488)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Solana treasury.
                </span>
              </h2>
              <p className="mx-auto mt-5 text-[1.05rem] leading-[1.92]"
                style={{ color: 'rgba(180,190,220,0.5)', maxWidth: 500 }}>
                Paste any Solana address. Real mainnet data via Helius. Surface recurring patterns, reserve health, and upcoming obligations — instantly.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.06}>
            <div className="relative mx-auto max-w-2xl rounded-[28px] overflow-hidden">
              {/* Ambient glow behind card */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full blur-[80px]"
                  style={{ background: 'rgba(245,158,11,0.05)' }} />
                <div className="absolute -right-8 -bottom-8 h-40 w-40 rounded-full blur-[70px]"
                  style={{ background: 'rgba(157,92,255,0.05)' }} />
              </div>
              <div className="relative rounded-[28px] p-6 sm:p-8"
                style={{
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.032), rgba(255,255,255,0.015))',
                  border: '1px solid rgba(255,255,255,0.09)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset',
                }}>
                <NavLoginWrapper />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-[11px]"
              style={{ color: 'rgba(255,255,255,0.2)' }}>
              {['Read-only · no signing required', 'Real mainnet data via Helius', 'Nothing stored beyond session', 'Pattern detection runs locally'].map(t => (
                <div key={t} className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
                  {t}
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ────────────────────────────────────────────────────────────────────
            CTA
            tasteskill.dev: cinematic, immersive depth, atmospheric
        ──────────────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-12"
          style={{ paddingBottom: 'clamp(64px,8vw,112px)' }}>
          <Reveal>
            <div className="relative overflow-hidden rounded-[40px] px-8 py-20 sm:px-14 sm:py-24 lg:px-20 lg:py-28 text-center"
              style={{
                background: 'linear-gradient(145deg, #070d1e 0%, #050a16 55%, #030710 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 0 120px rgba(88,28,135,0.08)',
              }}>
              {/* Depth layers */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 bottom-0 h-80"
                  style={{ background: 'radial-gradient(ellipse at 50% 120%, rgba(139,92,246,0.18), transparent 55%)' }} />
                <div className="absolute inset-x-0 top-0 h-40"
                  style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(139,92,246,0.08), transparent 55%)' }} />
                {/* Grid */}
                <div className="absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                    maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent)',
                  }} />
                {/* Top glow line */}
                <div className="absolute inset-x-0 top-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.5) 50%, transparent 95%)' }} />
              </div>

              <div className="relative">
                <AceMark className="mx-auto h-[72px] w-[72px]" glow />

                <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.32em]"
                  style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Connect your wallet to begin
                </p>

                <h2 className="mt-5 font-display font-700 text-white leading-[1.06] tracking-[-0.055em]"
                  style={{ fontSize: 'clamp(2rem,4.5vw,3.8rem)' }}>
                  Your Solana treasury,<br />finally on autopilot.
                </h2>

                <p className="mx-auto mt-5 text-[0.96rem] leading-[1.9]"
                  style={{ color: 'rgba(180,190,220,0.38)', maxWidth: 480 }}>
                  Connect your wallet to access the private dashboard. Treasury state stays between you and the protocol — nothing exposed on the public page.
                </p>

                <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <ConnectButton size="lg" />
                  <Link href="https://github.com/enkethomassen/ace-protocol"
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[14px] text-[13.5px] font-medium transition-all hover:text-white"
                    style={{
                      color: 'rgba(200,210,230,0.5)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: '14px 24px',
                    }}>
                    View repository
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="mt-14 flex flex-wrap items-center justify-center gap-5 text-[11px] font-medium"
                  style={{ color: 'rgba(255,255,255,0.18)' }}>
                  {['Solana', '·', 'Jupiter', '·', 'Helius', '·', 'Jito', '·', 'QVAC', '·', 'Cloak'].map((n, i) => (
                    <span key={i}>{n}</span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

      </main>

      {/* ────────────────────────────────────────────────────────────────────────
          FOOTER
      ──────────────────────────────────────────────────────────────────────── */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <div className="mx-auto flex max-w-[1360px] flex-col gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div className="flex items-center gap-4">
            <AceMark className="h-10 w-10" />
            <div style={{ lineHeight: 1 }}>
              <div className="text-[13px] font-semibold text-white tracking-[-0.03em]"
                style={{ fontFamily: 'var(--font-display)' }}>ACE Protocol</div>
              <div className="mt-1.5 text-[8.5px] uppercase tracking-[0.24em]"
                style={{ color: 'rgba(255,255,255,0.2)' }}>AI treasury autopilot · Solana</div>
            </div>
          </div>
          <p className="text-[11px] lg:text-center" style={{ color: 'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} ACE Protocol. Built on Solana.
          </p>
          <div className="flex items-center gap-5 text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {[
              { label: 'Twitter', href: 'https://twitter.com' },
              { label: 'GitHub',  href: 'https://github.com/enkethomassen/ace-protocol' },
              { label: 'Docs',    href: '#' },
              { label: 'Legal',   href: '#' },
            ].map(({ label, href }) => (
              <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="transition-colors hover:text-white">
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}
