'use client';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'fire' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  fire: 'bg-gradient-to-r from-[#ff6b2b] to-[#f4a935] text-white font-semibold hover:opacity-90 shadow-lg shadow-orange-900/30',
  outline: 'border border-[#2a2a3a] text-gray-300 hover:border-orange-500/50 hover:text-white bg-transparent',
  ghost: 'text-gray-400 hover:text-white hover:bg-white/5 bg-transparent',
  danger: 'bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30',
  success: 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
};

export function Button({
  children,
  variant = 'fire',
  size = 'md',
  className,
  disabled,
  loading,
  onClick,
  type = 'button',
  fullWidth,
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
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  );
}
