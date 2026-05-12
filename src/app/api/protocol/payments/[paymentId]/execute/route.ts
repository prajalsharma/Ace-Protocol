import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { executePaymentForWallet } from '@root/engine/paymentEngine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const { paymentId } = await params;
    return NextResponse.json(await executePaymentForWallet(session.wallet, paymentId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'execution failed' }, { status: 400 });
  }
}
