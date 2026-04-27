'use client';
import { cn } from '@/lib/utils';

export function Card({ children, className, hover = false }: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border border-[#2a2a3a] bg-[#13131a] p-5',
      hover && 'card-hover cursor-pointer',
      className,
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-between mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-semibold text-gray-300 uppercase tracking-wider', className)}>{children}</h3>;
}
