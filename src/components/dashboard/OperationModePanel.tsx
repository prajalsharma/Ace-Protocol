'use client';

import { useState } from 'react';
import { Shield, Zap, DollarSign, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { formatUsd } from '@/lib/utils';
import type { OperationMode } from '@/types';

const CAP_PRESETS = [100, 250, 500, 1000, 2500, 5000];

export function OperationModePanel() {
  const { vault, updateVault } = useApp();
  const [showCapEditor, setShowCapEditor] = useState(false);
  const [customCap, setCustomCap] = useState('');
  const [saving, setSaving] = useState(false);

  const mode: OperationMode = vault?.operationMode ?? 'safe';
  const cap: number = vault?.aiPaymentCapUsd ?? 500;
  const isAutopilot = mode === 'autopilot';

  async function setMode(next: OperationMode) {
    if (!vault || next === mode) return;
    setSaving(true);
    updateVault({ operationMode: next });
    setSaving(false);
  }

  async function setCap(val: number) {
    if (!vault || val <= 0) return;
    setSaving(true);
    updateVault({ aiPaymentCapUsd: val });
    setCustomCap('');
    setShowCapEditor(false);
    setSaving(false);
  }

  return (
    <div className="card-base overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-base)' }}>
        <p className="label-metric mb-1">Execution Mode</p>
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            AI Operations
          </h3>
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: isAutopilot ? 'rgba(168,85,247,0.08)' : 'rgba(34,197,94,0.07)',
              border: `1px solid ${isAutopilot ? 'rgba(168,85,247,0.22)' : 'rgba(34,197,94,0.18)'}`,
              color: isAutopilot ? 'var(--violet-bright)' : 'var(--teal)',
              borderRadius: '4px',
            }}
          >
            {isAutopilot ? <Zap className="w-2.5 h-2.5" /> : <Shield className="w-2.5 h-2.5" />}
            {isAutopilot ? 'Autopilot' : 'Safe Mode'}
          </span>
        </div>
      </div>

      {/* Mode toggles */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {/* Safe Mode */}
        <button
          onClick={() => void setMode('safe')}
          disabled={saving}
          className="relative rounded-lg p-3 text-left transition-all duration-150"
          style={{
            border: !isAutopilot
              ? '1px solid rgba(255,255,255,0.10)'
              : '1px solid var(--border-lo)',
            background: !isAutopilot ? 'rgba(255,255,255,0.03)' : 'transparent',
          }}
        >
          {!isAutopilot && (
            <span className="absolute top-2.5 right-2.5">
              <Check className="w-3 h-3" style={{ color: 'var(--green)' }} />
            </span>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5"
              style={{ color: !isAutopilot ? 'var(--green)' : 'var(--text-muted)' }}
            />
            <span className="text-[12px] font-semibold"
              style={{ color: !isAutopilot ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
            >
              Safe
            </span>
          </div>
          <ul className="space-y-1">
            {['AI recommends', 'Manual approval', 'Full control'].map(point => (
              <li key={point} className="flex items-start gap-1.5 text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="mt-1 w-1 h-1 rounded-full shrink-0"
                  style={{ background: !isAutopilot ? 'var(--green)' : 'var(--text-muted)' }}
                />
                {point}
              </li>
            ))}
          </ul>
        </button>

        {/* Autopilot */}
        <button
          onClick={() => void setMode('autopilot')}
          disabled={saving}
          className="relative rounded-lg p-3 text-left transition-all duration-150"
          style={{
            border: isAutopilot
              ? '1px solid rgba(168,85,247,0.22)'
              : '1px solid var(--border-lo)',
            background: isAutopilot ? 'rgba(168,85,247,0.06)' : 'transparent',
          }}
        >
          {isAutopilot && (
            <span className="absolute top-2.5 right-2.5">
              <Check className="w-3 h-3" style={{ color: 'var(--violet-bright)' }} />
            </span>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5"
              style={{ color: isAutopilot ? 'var(--violet-bright)' : 'var(--text-muted)' }}
            />
            <span className="text-[12px] font-semibold"
              style={{ color: isAutopilot ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
            >
              Autopilot
            </span>
          </div>
          <ul className="space-y-1">
            {['Auto-executes', 'Within spending cap', 'Whitelisted only'].map(point => (
              <li key={point} className="flex items-start gap-1.5 text-[10px]"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="mt-1 w-1 h-1 rounded-full shrink-0"
                  style={{ background: isAutopilot ? 'var(--violet-bright)' : 'var(--text-muted)' }}
                />
                {point}
              </li>
            ))}
          </ul>
        </button>
      </div>

      {/* AI Payment Cap */}
      <div className="px-3 pb-3">
        <div className="rounded-lg p-3"
          style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-lo)' }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                AI Payment Cap
              </span>
            </div>
            <button
              onClick={() => setShowCapEditor(v => !v)}
              className="flex items-center gap-0.5 text-[10px] transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
            >
              Edit
              {showCapEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          <p className="value-md" style={{ color: 'var(--text-primary)' }}>
            {formatUsd(cap)}
          </p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            {isAutopilot ? 'Max per execution cycle' : 'Enforced if autopilot enabled'}
          </p>

          <AnimatePresence>
            {showCapEditor && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {CAP_PRESETS.map(preset => (
                    <button
                      key={preset}
                      onClick={() => void setCap(preset)}
                      className="px-2.5 py-1 rounded text-[10px] font-semibold transition-all"
                      style={{
                        background: cap === preset ? 'rgba(168,85,247,0.10)' : 'transparent',
                        border: `1px solid ${cap === preset ? 'rgba(168,85,247,0.28)' : 'var(--border-base)'}`,
                        color: cap === preset ? 'var(--violet-bright)' : 'var(--text-tertiary)',
                        borderRadius: '4px',
                      }}
                    >
                      {formatUsd(preset, 0)}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px]"
                      style={{ color: 'var(--text-tertiary)' }}
                    >$</span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      placeholder="Custom"
                      value={customCap}
                      onChange={e => setCustomCap(e.target.value)}
                      className="input-base w-full pl-7"
                      style={{ fontSize: '11px', padding: '6px 12px 6px 24px' }}
                    />
                  </div>
                  <button
                    onClick={() => {
                      const val = parseFloat(customCap);
                      if (!isNaN(val) && val > 0) void setCap(val);
                    }}
                    disabled={!customCap || isNaN(parseFloat(customCap))}
                    className="btn-secondary"
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                  >
                    Set
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
