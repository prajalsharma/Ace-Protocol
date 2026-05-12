import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { recordTransaction } from '@root/services/treasuryService';
import type { TransactionRecord } from '@root/src/types';

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const tx = await req.json() as TransactionRecord;
  return NextResponse.json(recordTransaction(session.wallet, tx));
}
