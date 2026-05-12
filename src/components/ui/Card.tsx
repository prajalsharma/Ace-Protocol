'use client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type CardVariant = 'default' | 'hero' | 'insight' | 'warning' | 'private' | 'raised';

export function Card({
  children,
  className,
  hover = false,
  animate = false,
  delay = 0,
  variant = 'default',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  animate?: boolean;
  delay?: number;
  variant?: CardVariant;
  style?: React.CSSProperties;
}) {
  const variantClass = {
    default:  'card-base',
    raised:   'card-raised',
    hero:     'card-hero',
    insight:  'card-insight',
    warning:  'card-warning',
    private:  'card-private',
  }[variant];

  const hoverStyle = hover ? {
    transition: 'border-color 0.15s ease, background 0.15s ease',
    cursor: 'pointer',
  } : {};

  const base = cn(variantClass, 'p-7', className);

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1], delay }}
        className={base}
        style={{ ...hoverStyle, ...style }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={base} style={{ ...hoverStyle, ...style }}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn('label-metric', className)}>
      {children}
    </h3>
  );
}

export function CardDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn('-mx-5', className)}
      style={{ height: 1, background: 'var(--border-lo)' }}
    />
  );
}

/** Metric card — for financial KPIs */
export function MetricCard({
  label,
  value,
  sub,
  accent = 'var(--amber)',
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  return (
    <div className={cn('card-base p-4 flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="label-metric">{label}</span>
        {Icon && (
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: `${accent}14`, borderRadius: '6px' }}
          >
            <Icon className="w-3 h-3" style={{ color: accent }} />
          </div>
        )}
      </div>
      <div>
        <p className="value-lg" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {sub && (
          <p className="text-[10px] mt-1.5 leading-tight" style={{ color: 'var(--text-muted)' }}>{sub}</p>
        )}
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          <span
            className="text-[9px] font-semibold"
            style={{ color: trend === 'up' ? 'var(--green)' : trend === 'down' ? 'var(--red)' : 'var(--text-tertiary)' }}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
          </span>
        </div>
      )}
    </div>
  );
}

/** Hero card — treasury summary */
export function HeroCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card-hero p-6', className)}>
      {children}
    </div>
  );
}

/** Insight card — AI analysis */
export function InsightCardBlock({
  title,
  body,
  confidence,
  type = 'info',
  className,
}: {
  title: string;
  body: string;
  confidence?: number;
  type?: 'info' | 'warning' | 'alert' | 'success';
  className?: string;
}) {
  const accentMap = {
    info:    'var(--blue)',
    warning: 'var(--amber)',
    alert:   'var(--red)',
    success: 'var(--green)',
  };
  const accent = accentMap[type];

  return (
    <div
      className={cn('p-4 rounded-[10px]', className)}
      style={{
        background: `color-mix(in srgb, ${accent} 5%, var(--bg-card))`,
        border: `1px solid color-mix(in srgb, ${accent} 18%, transparent)`,
      }}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <span
          className="w-1 h-full rounded-full shrink-0 mt-1"
          style={{ background: accent, minHeight: 32, width: 2 }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{title}</p>
            {confidence !== undefined && (
              <span
                className="chip shrink-0 text-[9px]"
                style={{
                  color: accent,
                  background: `color-mix(in srgb, ${accent} 10%, transparent)`,
                  borderColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
                  padding: '1px 6px',
                }}
              >
                {Math.round(confidence * 100)}%
              </span>
            )}
          </div>
          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
        </div>
      </div>
    </div>
  );
}
