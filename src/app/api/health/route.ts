// ============================================================
// ACE Protocol — Health Check API
// Returns system status for monitoring and diagnostics.
// ============================================================

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'ace-protocol',
    version: '0.1.0-alpha',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV ?? 'development',
    solanaRpc: process.env.NEXT_PUBLIC_SOLANA_RPC ? 'configured' : 'default-devnet',
    aiProvider: process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : process.env.OPENAI_API_KEY
        ? 'openai'
        : 'deterministic-fallback',
  });
}
