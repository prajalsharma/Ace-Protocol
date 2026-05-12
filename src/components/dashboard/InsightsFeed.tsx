'use client';
import { AlertTriangle, TrendingUp, X, ChevronRight, BrainCircuit, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useApp } from '@/context/AppContext';
import type { CashflowInsight } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const typeConfig: Record<string, {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}> = {
  recommendation: { icon: BrainCircuit, color: 'var(--violet-bright)' },
  alert:          { icon: AlertTriangle, color: 'var(--red)' },
  prediction:     { icon: TrendingUp,   color: 'var(--green)' },
};

const impactVariant: Record<string, 'fire' | 'gold' | 'ocean' | 'muted'> = {
  high:   'fire',
  medium: 'gold',
  low:    'muted',
};

export function InsightsFeed() {
  const { insights, dismissInsight } = useApp();

  if (!insights.length) {
    return (
      <Card>
        <CardHeader><CardTitle>AI Insights</CardTitle></CardHeader>
        <div className="py-8 text-center space-y-3">
          <div className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.16)' }}>
            <Zap className="w-4.5 h-4.5" style={{ color: 'var(--violet-bright)', width: 18, height: 18 }} />
          </div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
            No active recommendations
          </p>
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Treasury signals nominal. ACE is monitoring.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Insights</CardTitle>
        <Badge variant="fire">{insights.length}</Badge>
      </CardHeader>
      <div className="space-y-1.5">
        <AnimatePresence>
          {insights.map((insight, i) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 16, scale: 0.97 }}
              transition={{ delay: i * 0.04, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <InsightItem insight={insight} onDismiss={dismissInsight} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function InsightItem({
  insight,
  onDismiss,
}: {
  insight: CashflowInsight;
  onDismiss: (id: string) => void;
}) {
  const cfg = typeConfig[insight.type] ?? typeConfig.recommendation;
  const Icon = cfg.icon;
  const conf = Math.round(insight.confidence * 100);

  return (
    <div
      className="flex gap-4 p-4 rounded-[14px] group transition-all"
      style={{ border: '1px solid var(--border-lo)', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-base)';
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.012)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-lo)';
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      {/* Ambient accent */}
      <div className="pointer-events-none absolute inset-0 rounded-[14px]"
        style={{ background: `radial-gradient(ellipse at 0% 50%, color-mix(in srgb, ${cfg.color} 5%, transparent) 0%, transparent 55%)` }} />

      <div
        className="mt-0.5 shrink-0 w-9 h-9 flex items-center justify-center relative"
        style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, borderRadius: '10px', border: `1px solid color-mix(in srgb, ${cfg.color} 22%, transparent)` }}
      >
        <Icon className="w-4 h-4" style={{ color: cfg.color, width: 16, height: 16 }} />
      </div>

      <div className="flex-1 min-w-0 relative">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em]" style={{ color: 'var(--text-primary)' }}>
            {insight.title}
          </p>
          <button
            onClick={() => onDismiss(insight.id)}
            className="shrink-0 transition-colors mt-0.5 p-1 rounded-md"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <X className="w-3.5 h-3.5" style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
          {insight.description}
        </p>

        {/* Footer with confidence bar */}
        <div className="flex items-center gap-3 mt-3">
          <Badge variant={impactVariant[insight.impact]}>{insight.impact}</Badge>
          <div className="flex items-center gap-2">
            {/* Animated confidence bar */}
            <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${conf}%` }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: cfg.color }}
              />
            </div>
            <span className="text-[11.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {conf}%
            </span>
          </div>
          {insight.action && (
            <button
              className="ml-auto flex items-center gap-1 text-[12px] font-semibold transition-colors"
              style={{ color: 'var(--violet-bright)', opacity: 0.75 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75'; }}
            >
              {insight.action.label} <ChevronRight className="w-3.5 h-3.5" style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
