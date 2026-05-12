import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { patchPayment } from '@root/services/treasuryService';
import type { ScheduledPayment } from '@root/src/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { paymentId } = await params;
  const patch = await req.json() as Partial<ScheduledPayment>;
  return NextResponse.json(patchPayment(session.wallet, paymentId, patch));
}
