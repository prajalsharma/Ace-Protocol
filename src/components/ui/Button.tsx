'use client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'fire';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:   'font-semibold active:scale-[0.98]',
  secondary: 'border active:scale-[0.98]',
  outline:   'border active:scale-[0.98]',
  ghost:     'active:scale-[0.98]',
  danger:    'border active:scale-[0.98]',
  success:   'border active:scale-[0.98]',
  fire:      'font-semibold active:scale-[0.98]',
};

const variantStyles: Partial<Record<Variant, React.CSSProperties>> = {
  primary:   { background: 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)', color: '#041412', boxShadow: 'none', transition: 'transform 160ms var(--ease-out), box-shadow 160ms var(--ease-out)' },
  fire:      { background: 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)', color: '#041412' },
  secondary: { borderColor: 'var(--border-base)', background: 'rgba(255,255,255,0.025)', color: 'var(--text-secondary)' },
  outline:   { borderColor: 'var(--border-base)', background: 'rgba(255,255,255,0.025)', color: 'var(--text-secondary)' },
  ghost:     { background: 'transparent', color: 'var(--text-tertiary)' },
  danger:    { borderColor: 'rgba(244,63,94,0.22)', background: 'rgba(244,63,94,0.05)', color: 'var(--red)' },
  success:   { borderColor: 'rgba(45,212,191,0.22)', background: 'rgba(45,212,191,0.05)', color: 'var(--teal)' },
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[11px]',
  md: 'px-4 py-2 text-[12px]',
  lg: 'px-5 py-2.5 text-[13px] font-semibold',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  loading,
  onClick,
  type = 'button',
  fullWidth,
  style,
}: {
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  fullWidth?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed font-medium',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      style={{
        borderRadius: 'var(--r-md)',
        fontFamily: 'var(--font-body)',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}
