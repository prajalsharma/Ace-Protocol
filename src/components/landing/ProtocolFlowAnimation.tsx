'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ProtocolFlowScene = dynamic(
  () => import('./ProtocolFlowScene').then(m => m.ProtocolFlowScene),
  { ssr: false }
);

function LoadingFallback() {
  return (
    <div className="flex h-full min-h-[520px] w-full items-end justify-start p-4 sm:min-h-[620px] lg:min-h-[700px]">
      <div className="space-y-2 w-full max-w-sm">
        {/* Skeleton tabs */}
        <div className="flex gap-1.5 mb-3">
          {[1,2,3,4].map(i => (
            <div
              key={i}
              className="flex-1 h-8 rounded-xl animate-pulse"
              style={{ background: 'rgba(255,255,255,0.04)', animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        {/* Skeleton content rows */}
        {[1,2,3].map(i => (
          <div
            key={i}
            className="h-12 rounded-xl animate-pulse"
            style={{ background: 'rgba(255,255,255,0.03)', animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>
    </div>
  );
}

export function ProtocolFlowAnimation() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProtocolFlowScene />
    </Suspense>
  );
}
