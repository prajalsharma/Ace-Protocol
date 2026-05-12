'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/*
  ACE Protocol — Product Flow Visualization

  Implements the REAL 4-step product flow with cinematic quality:
    1. Connect Treasury   — wallet read → classify on-chain state
    2. Detect Recurring   — AI surfaces payment patterns w/ confidence
    3. Build Execution Plan — reserve-aware obligation queue
    4. Execute in Policy  — policy-gated, auditable execution

  Design language derived from:
  • tasteskill.dev: asymmetric layouts, editorial density, intentional detail
  • impeccable.style: exponential ease-out only, opacity+transform, purposeful motion
  • ui-ux-pro-max: AI-Native UI style, Executive Summary BI pattern

  No Three.js. Pure CSS + framer-motion.
*/

// ─── Motion config ────────────────────────────────────────────────────────────
const E: [number, number, number, number] = [0.22, 1, 0.36, 1];
const spring = { type: 'spring' as const, stiffness: 380, damping: 28 };

// ─── Step 1: Connect Treasury ─────────────────────────────────────────────────

function StepConnect({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 350);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  const txns = [
    { hash: 'a3f1…8d2c', amount: '-0.42 SOL',  label: 'Pay.sh payment',  color: '#5bc8ff' },
    { hash: 'b7e9…1a4f', amount: '-142 USDC',  label: 'AWS infra bill',  color: '#ff8c52' },
    { hash: 'c1d8…9e3b', amount: '+8.1 SOL',   label: 'Revenue inflow',  color: '#2de0a0' },
    { hash: 'd4a2…7f6c', amount: '-500 USDC',  label: 'Payroll cycle',   color: '#c8a3ff' },
  ];

  return (
    <div className="flex flex-col gap-3">

      {/* Wallet card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.5, ease: E }}
        className="relative overflow-hidden rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.13) 0%, rgba(45,212,191,0.06) 100%)',
          border: '1px solid rgba(168,85,247,0.28)',
        }}
      >
        {/* Scan line animation — impeccable.style: purposeful, reads as "scanning" */}
        {phase === 1 && (
          <motion.div
            initial={{ top: 0, opacity: 0.7 }}
            animate={{ top: '100%', opacity: 0 }}
            transition={{ duration: 0.75, ease: 'linear' }}
            className="absolute inset-x-0 h-px pointer-events-none z-10"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.8), transparent)' }}
          />
        )}

        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="4" width="14" height="9" rx="2" stroke="#c084fc" strokeWidth="1.5" />
              <path d="M1 7h14" stroke="#c084fc" strokeWidth="1.5" />
              <circle cx="11.5" cy="9.5" r="1" fill="#c084fc" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#c084fc' }}>
              Wallet Connected
            </p>
            <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.45)' }}>
              7xKR…m4Qz
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.div
              animate={active ? { scale: [1, 1.6, 1], opacity: [1, 0.4, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#2de0a0', boxShadow: '0 0 5px #2de0a0' }}
            />
            <span className="text-[9px] font-semibold" style={{ color: '#2de0a0' }}>READ-ONLY</span>
          </div>
        </div>

        {/* Balance reveal — tasteskill.dev: financial value scale, prominent */}
        <AnimatePresence>
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.42, ease: E }}
              className="overflow-hidden"
            >
              <div
                className="flex items-end gap-4 pt-2 pb-1 border-t"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div>
                  <p className="text-[8.5px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Treasury Balance
                  </p>
                  <p
                    className="text-[22px] font-mono font-600 leading-none mt-1"
                    style={{ color: '#edf2ff', letterSpacing: '-0.04em' }}
                  >
                    48,291{' '}
                    <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.38)' }}>USDC</span>
                  </p>
                </div>
                <div className="mb-0.5 ml-auto text-right">
                  <p className="text-[8.5px] uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.3)' }}>SOL</p>
                  <p
                    className="text-[15px] font-mono font-500 leading-none mt-0.5"
                    style={{ color: '#c8a3ff', letterSpacing: '-0.03em' }}
                  >
                    142.7
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Transaction rows — impeccable.style: staggered entrance, translate+opacity */}
      <AnimatePresence>
        {phase >= 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] px-1 mb-2"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              Recent On-Chain Activity
            </p>
            <div className="space-y-1.5">
              {txns.map((tx, i) => (
                <motion.div
                  key={tx.hash}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.32, ease: E }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tx.color }} />
                  <span className="text-[11px] flex-1 truncate" style={{ color: 'rgba(255,255,255,0.52)' }}>
                    {tx.label}
                  </span>
                  <span className="text-[11px] font-mono font-500 flex-shrink-0" style={{ color: tx.color }}>
                    {tx.amount}
                  </span>
                  <span className="text-[9px] font-mono flex-shrink-0" style={{ color: 'rgba(255,255,255,0.18)' }}>
                    {tx.hash}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step 2: Detect Recurring Patterns ────────────────────────────────────────

function StepDetect({ active }: { active: boolean }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!active) { setRevealed(0); return; }
    const timers = [0, 480, 860, 1240, 1600].map((delay, i) =>
      setTimeout(() => setRevealed(i + 1), delay + 180)
    );
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const patterns = [
    { label: 'Payroll Cycle',       frequency: 'Monthly · ~1st',      amount: '~500 USDC',     confidence: 94, color: '#c8a3ff' },
    { label: 'Infrastructure Bill', frequency: 'Monthly · ~15th',     amount: '~142 USDC',     confidence: 88, color: '#ff8c52' },
    { label: 'API / Pay.sh',        frequency: 'Weekly · variable',   amount: '~0.4–1.2 SOL',  confidence: 76, color: '#5bc8ff' },
    { label: 'Revenue Inflow',      frequency: 'Irregular · detected',amount: '+8–15 SOL avg', confidence: 81, color: '#2de0a0' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* AI scanning header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.38 }}
        className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
        style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.18)' }}
      >
        <motion.div
          animate={active ? { rotate: 360 } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 flex-shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="8" cy="8" r="2" fill="#c084fc" />
          </svg>
        </motion.div>
        <p className="text-[11px]" style={{ color: '#c084fc' }}>
          AI analyzing <span className="font-mono font-500">847</span> transactions
        </p>
      </motion.div>

      {/* Pattern cards — tasteskill.dev: data-dense but structured */}
      <div className="space-y-2">
        {patterns.map((p, i) => (
          <AnimatePresence key={p.label}>
            {revealed > i && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.42, ease: E }}
                className="relative overflow-hidden rounded-xl px-3.5 py-3"
                style={{
                  background: `linear-gradient(135deg, ${p.color}09 0%, rgba(255,255,255,0.018) 100%)`,
                  border: `1px solid ${p.color}22`,
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="text-[12px] font-semibold leading-none" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {p.label}
                    </p>
                    <p className="text-[9.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.frequency}</p>
                  </div>
                  <p className="text-[12px] font-mono font-500 flex-shrink-0" style={{ color: p.color }}>
                    {p.amount}
                  </p>
                </div>
                {/* Confidence bar — impeccable.style: width transition only */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.confidence}%` }}
                      transition={{ duration: 0.65, ease: E, delay: 0.08 }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${p.color}60, ${p.color})` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono flex-shrink-0" style={{ color: p.color }}>
                    {p.confidence}%
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Build Execution Plan ─────────────────────────────────────────────

function StepPlan({ active }: { active: boolean }) {
  const [queueVisible, setQueueVisible] = useState(false);
  const [reserveVisible, setReserveVisible] = useState(false);

  const payments = [
    { id: 'p1', label: 'Payroll · Team',      amount: '500 USDC',  due: 'in 3 days',  status: 'ready',  color: '#c8a3ff' },
    { id: 'p2', label: 'AWS / Infrastructure',amount: '142 USDC',  due: 'in 11 days', status: 'queued', color: '#ff8c52' },
    { id: 'p3', label: 'Pay.sh API bill',     amount: '0.42 SOL',  due: 'in 5 days',  status: 'queued', color: '#5bc8ff' },
    { id: 'p4', label: 'QVAC compute',        amount: '0.18 SOL',  due: 'in 18 days', status: 'queued', color: '#2de0a0' },
  ];

  const statusColors: Record<string, string> = {
    ready:     '#2de0a0',
    queued:    '#5bc8ff',
    executing: '#c8a3ff',
    done:      '#3a4a6a',
  };

  useEffect(() => {
    if (!active) { setQueueVisible(false); setReserveVisible(false); return; }
    const t1 = setTimeout(() => setQueueVisible(true), 300);
    const t2 = setTimeout(() => setReserveVisible(true), 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  return (
    <div className="flex flex-col gap-3">
      {/* Reserve health — ui-ux-pro-max: financial dashboard, status first */}
      <AnimatePresence>
        {reserveVisible && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: E }}
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
            style={{ background: 'rgba(16,217,140,0.06)', border: '1px solid rgba(16,217,140,0.18)' }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(16,217,140,0.14)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1L7.5 4H11L8.5 6.5L9.5 10L6 8L2.5 10L3.5 6.5L1 4H4.5L6 1Z" fill="#10d98c" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] font-semibold" style={{ color: '#10d98c' }}>
                Reserve healthy · Coverage 112%
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '78%' }}
                    transition={{ duration: 0.9, ease: E, delay: 0.18 }}
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #10d98c50, #10d98c)' }}
                  />
                </div>
                <span className="text-[9px] font-mono" style={{ color: '#10d98c' }}>48,291 USDC</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Queue */}
      <AnimatePresence>
        {queueVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-center justify-between px-1 mb-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                Execution Queue
              </p>
              <span
                className="text-[9px] font-mono px-2 py-0.5 rounded"
                style={{ background: 'rgba(91,200,255,0.1)', color: '#5bc8ff', border: '1px solid rgba(91,200,255,0.2)' }}
              >
                {payments.length} scheduled
              </span>
            </div>
            <div className="space-y-1.5">
              {payments.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.09, duration: 0.34, ease: E }}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.055)' }}
                >
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.72)' }}>{p.label}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>Due {p.due}</p>
                  </div>
                  <span className="text-[11px] font-mono font-500 flex-shrink-0" style={{ color: p.color }}>
                    {p.amount}
                  </span>
                  <span
                    className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background: `${statusColors[p.status]}14`,
                      color: statusColors[p.status],
                      border: `1px solid ${statusColors[p.status]}28`,
                    }}
                  >
                    {p.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step 4: Execute Within Policies ─────────────────────────────────────────

function StepExecute({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 280);
    const t2 = setTimeout(() => setPhase(2), 1100);
    const t3 = setTimeout(() => setPhase(3), 2050);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  const policies = [
    { label: 'Spending cap',          value: '2,500 USDC / mo' },
    { label: 'Destination whitelist', value: '4 addresses' },
    { label: 'Time window',           value: '09:00–17:00 UTC' },
    { label: 'Reserve floor',         value: '20,000 USDC min' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Policy checks */}
      <AnimatePresence>
        {phase >= 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] px-1 mb-2"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              Policy Validation
            </p>
            <div className="space-y-1.5">
              {policies.map((pol, i) => (
                <motion.div
                  key={pol.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3, ease: E }}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ ...spring, delay: i * 0.08 + 0.18 }}
                    className="w-[15px] h-[15px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,217,140,0.14)', border: '1px solid rgba(16,217,140,0.28)' }}
                  >
                    <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                      <path d="M1 3.5L2.5 5L6 2" stroke="#10d98c" strokeWidth="1.4"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                  <span className="text-[11px] flex-1" style={{ color: 'rgba(255,255,255,0.58)' }}>{pol.label}</span>
                  <span className="text-[9.5px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{pol.value}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Execution progress */}
      <AnimatePresence>
        {phase >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: E }}
            className="relative overflow-hidden rounded-2xl p-4"
            style={{
              background: 'linear-gradient(135deg, rgba(200,163,255,0.10) 0%, rgba(45,212,191,0.06) 100%)',
              border: '1px solid rgba(200,163,255,0.24)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <motion.div
                animate={phase === 2 ? { rotate: 360 } : {}}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="#c8a3ff" strokeWidth="1.4" strokeDasharray="4 2" />
                </svg>
              </motion.div>
              <p className="text-[11.5px] font-semibold" style={{ color: '#c8a3ff' }}>
                {phase < 3 ? 'Executing payment…' : 'Execution complete'}
              </p>
              {phase >= 3 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring} className="ml-auto">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <circle cx="7.5" cy="7.5" r="6.5" fill="rgba(16,217,140,0.14)" stroke="#10d98c" strokeWidth="1.2" />
                    <path d="M4.5 7.5L6.5 9.5L11 5" stroke="#10d98c" strokeWidth="1.4"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span style={{ color: 'rgba(255,255,255,0.38)' }}>Payroll · Team</span>
                <span className="font-mono" style={{ color: '#c8a3ff' }}>500 USDC</span>
              </div>
              <div className="h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: phase >= 3 ? '100%' : '65%' }}
                  transition={{ duration: phase >= 3 ? 0.42 : 0.85, ease: E }}
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #c8a3ff80, #c8a3ff, #2de0a0)' }}
                />
              </div>
            </div>

            {/* Audit log */}
            <AnimatePresence>
              {phase >= 3 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.32, ease: E }}
                  className="overflow-hidden"
                >
                  <div
                    className="mt-3 pt-2.5 border-t flex items-center gap-2"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <rect x="1" y="1" width="8" height="8" rx="1.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                      <path d="M3 5l1.5 1.5L7 3.5" stroke="#10d98c" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                    <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      Execution logged · sig:{' '}
                      <span className="font-mono">4qHz…e7Vb</span>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  n: string;
  label: string;
  sublabel: string;
  color: string;
}

const STEPS: Step[] = [
  { n: '01', label: 'Connect Treasury',     sublabel: 'Wallet read access',    color: '#c8a3ff' },
  { n: '02', label: 'Detect Recurring',     sublabel: 'AI pattern analysis',   color: '#5bc8ff' },
  { n: '03', label: 'Build Execution Plan', sublabel: 'Queue & reserve-aware', color: '#2de0a0' },
  { n: '04', label: 'Execute in Policy',    sublabel: 'Auditable automation',  color: '#ff8c52' },
];

const STEP_DURATION = 4400;

// ─── Main exported scene ──────────────────────────────────────────────────────

export function ProtocolFlowScene() {
  const [activeStep, setActiveStep] = useState(0);
  const timeRef = useRef<number>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(s => (s + 1) % STEPS.length);
    }, STEP_DURATION);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setProgress(0);
    timeRef.current = performance.now();
    let id: number;
    const raf = (now: number) => {
      const elapsed = now - timeRef.current;
      setProgress(Math.min(elapsed / STEP_DURATION, 1));
      if (elapsed < STEP_DURATION) id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => cancelAnimationFrame(id);
  }, [activeStep]);

  const step = STEPS[activeStep];

  return (
    <div
      className="h-full w-full flex flex-col select-none"
      style={{
        fontFamily: 'var(--font-body)',
        minHeight: '520px',
      }}
    >
      {/* ── Step tabs ── */}
      <div className="flex gap-1 p-2 sm:p-3 flex-shrink-0 overflow-x-auto">
        {STEPS.map((s, i) => {
          const isActive = i === activeStep;
          const isDone = i < activeStep;
          return (
            <button
              key={s.n}
              onClick={() => setActiveStep(i)}
              className="relative flex-1 min-w-0 rounded-xl px-2 py-2 sm:px-3 sm:py-2.5 text-left overflow-hidden"
              style={{
                background: isActive ? `${s.color}0e` : 'rgba(255,255,255,0.016)',
                border: `1px solid ${isActive ? `${s.color}2e` : 'rgba(255,255,255,0.055)'}`,
                transition: 'background 240ms, border-color 240ms',
              }}
            >
              {/* Progress strip — impeccable.style: bottom, width-only transition */}
              {isActive && (
                <div
                  className="absolute bottom-0 left-0 h-[2px] rounded-full"
                  style={{
                    width: `${progress * 100}%`,
                    background: `linear-gradient(90deg, ${s.color}70, ${s.color})`,
                    transition: 'none',
                  }}
                />
              )}
              <div className="flex items-center gap-1.5">
                {isDone ? (
                  <div
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ background: 'rgba(16,217,140,0.18)' }}
                  >
                    <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                      <path d="M1 3.5L2.5 5L6 2" stroke="#10d98c" strokeWidth="1.2"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                ) : (
                  <span
                    className="text-[9px] font-mono font-600 flex-shrink-0"
                    style={{ color: isActive ? s.color : 'rgba(255,255,255,0.18)' }}
                  >
                    {s.n}
                  </span>
                )}
                <div className="min-w-0 hidden sm:block">
                  <p
                    className="text-[10px] font-semibold leading-none truncate"
                    style={{ color: isActive ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.3)' }}
                  >
                    {s.label}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Step header ── */}
      <div className="px-3 sm:px-4 pt-4 pb-3 flex-shrink-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.26, ease: E }}
            className="flex items-center gap-3"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${step.color}12`, border: `1px solid ${step.color}28` }}
            >
              <span className="text-[11px] font-mono font-700" style={{ color: step.color }}>{step.n}</span>
            </div>
            <div>
              <p
                className="text-[15px] font-semibold leading-none"
                style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.028em',
                }}
              >
                {step.label}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: step.color, opacity: 0.72 }}>
                {step.sublabel}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 overflow-hidden px-3 sm:px-4 pb-4 min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
            transition={{ duration: 0.36, ease: E }}
            className="h-full"
          >
            {activeStep === 0 && <StepConnect active />}
            {activeStep === 1 && <StepDetect active />}
            {activeStep === 2 && <StepPlan active />}
            {activeStep === 3 && <StepExecute active />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Dot indicators ── */}
      <div className="flex items-center justify-center gap-2 pb-3 flex-shrink-0">
        {STEPS.map((s, i) => (
          <button
            key={s.n}
            onClick={() => setActiveStep(i)}
            className="transition-all duration-300"
            style={{
              width: i === activeStep ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === activeStep ? s.color : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
