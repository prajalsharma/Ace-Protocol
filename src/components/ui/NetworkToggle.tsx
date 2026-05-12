'use client';

import { motion } from 'framer-motion';
import { useProtocolStore, type SolanaNetwork } from '@/lib/store/useProtocolStore';

const OPTIONS: { value: SolanaNetwork; label: string; color: string; dot: string }[] = [
  {
    value: 'mainnet',
    label: 'Mainnet',
    color: 'var(--teal)',
    dot: '#10d98c',
  },
  {
    value: 'devnet',
    label: 'Devnet',
    color: 'var(--violet-bright)',
    dot: '#a855f7',
  },
];

export function NetworkToggle() {
  const network = useProtocolStore((s) => s.network);
  const setNetwork = useProtocolStore((s) => s.setNetwork);

  return (
    <div
      className="relative flex items-center gap-0.5 p-1 rounded-[10px]"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border-base)',
      }}
      role="group"
      aria-label="Network selector"
    >
      {OPTIONS.map((opt) => {
        const isActive = network === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setNetwork(opt.value)}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-[7px] transition-colors select-none"
            style={{
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? opt.color : 'var(--text-tertiary)',
              zIndex: 1,
            }}
            aria-pressed={isActive}
          >
            {isActive && (
              <motion.div
                layoutId="network-pill"
                className="absolute inset-0 rounded-[7px]"
                style={{
                  background: `color-mix(in srgb, ${opt.dot} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${opt.dot} 22%, transparent)`,
                }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
            {/* Live dot — only on active */}
            {isActive ? (
              <span
                className="relative z-10 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: opt.dot, boxShadow: `0 0 5px ${opt.dot}` }}
              />
            ) : (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0 opacity-30"
                style={{ background: 'var(--text-tertiary)' }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
