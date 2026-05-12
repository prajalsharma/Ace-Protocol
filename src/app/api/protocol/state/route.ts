import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { getProtocolState, getEmptyProtocolState } from '@root/services/treasuryService';

const MAINNET_RPC = process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC
  ?? process.env.NEXT_PUBLIC_SOLANA_RPC
  ?? 'https://api.mainnet-beta.solana.com';

const DEVNET_RPC = process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC
  ?? 'https://api.devnet.solana.com';

export async function GET(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const networkParam = req.nextUrl.searchParams.get('network') ?? 'devnet';
  const network = networkParam === 'mainnet' ? 'mainnet' : 'devnet';
  const rpcUrl = network === 'mainnet' ? MAINNET_RPC : DEVNET_RPC;

  try {
    const state = await getProtocolState(session.wallet, rpcUrl);
    return NextResponse.json({ ...state, network });
  } catch {
    // DB unavailable (e.g. better-sqlite3 native binding issue on this host).
    // Return an empty-but-valid state so the dashboard still loads.
    return NextResponse.json({ ...getEmptyProtocolState(session.wallet), network });
  }
}
