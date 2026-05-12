'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import type { SolanaNetwork } from '@/lib/store/useProtocolStore';

const NETWORKS: { id: SolanaNetwork; label: string }[] = [
  { id: 'mainnet', label: 'Mainnet' },
  { id: 'devnet',  label: 'Devnet'  },
];

export function NetworkToggle() {
  const { network, setNetwork, isLoading } = useApp();

  return (
    <div
      className="relative flex items-center p-[3px] rounded shrink-0"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border-base)',
        borderRadius: 'var(--r-md)',
        gap: 1,
      }}
    >
      {/* Animated sliding indicator */}
      <motion.div
        layoutId="network-pill"
        className="absolute top-[3px] bottom-[3px]"
        animate={{
          left: network === 'mainnet' ? 3 : '50%',
          right: network === 'devnet' ? 3 : '50%',
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        style={{
          borderRadius: 'calc(var(--r-md) - 3px)',
          background:
            network === 'devnet'
              ? 'linear-gradient(135deg, rgba(16,217,140,0.18) 0%, rgba(16,217,140,0.08) 100%)'
              : 'linear-gradient(135deg, rgba(168,85,247,0.18) 0%, rgba(168,85,247,0.08) 100%)',
          border:
            network === 'devnet'
              ? '1px solid rgba(16,217,140,0.28)'
              : '1px solid rgba(168,85,247,0.28)',
          boxShadow:
            network === 'devnet'
              ? '0 0 10px rgba(16,217,140,0.18)'
              : '0 0 10px rgba(168,85,247,0.18)',
        }}
      />

      {NETWORKS.map(({ id, label }) => {
        const isActive = network === id;
        const isDevnet = id === 'devnet';
        const activeColor = isDevnet ? 'var(--green)' : 'var(--violet-bright)';

        return (
          <button
            key={id}
            onClick={() => { if (!isLoading && !isActive) setNetwork(id); }}
            disabled={isLoading}
            className="relative z-10 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide px-3 py-1.5 transition-colors duration-150 select-none"
            style={{
              borderRadius: 'calc(var(--r-md) - 3px)',
              color: isActive ? activeColor : 'var(--text-muted)',
              cursor: isLoading ? 'not-allowed' : isActive ? 'default' : 'pointer',
              minWidth: 68,
              justifyContent: 'center',
            }}
          >
            {/* Live dot for active network */}
            <AnimatePresence>
              {isActive && (
                <motion.span
                  key="dot"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-[5px] h-[5px] rounded-full shrink-0"
                  style={{
                    background: activeColor,
                    boxShadow: `0 0 5px ${activeColor}`,
                  }}
                />
              )}
            </AnimatePresence>
            {label}
          </button>
        );
      })}
    </div>
  );
}
