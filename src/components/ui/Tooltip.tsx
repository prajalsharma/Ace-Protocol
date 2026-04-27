'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Tooltip({ children, content, className }: {
  children: React.ReactNode;
  content: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-[#1a1a24] border border-[#2a2a3a] rounded-lg whitespace-nowrap z-50 pointer-events-none">
          {content}
        </span>
      )}
    </span>
  );
}
