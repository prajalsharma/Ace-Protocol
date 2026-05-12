import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { createPayment } from '@root/services/treasuryService';
import type { ScheduledPayment } from '@root/src/types';

export async function POST(req: NextRequest) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const payment = await req.json() as ScheduledPayment;
  return NextResponse.json(createPayment(session.wallet, payment));
}
