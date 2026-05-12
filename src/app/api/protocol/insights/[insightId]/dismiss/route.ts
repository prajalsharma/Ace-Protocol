import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromAuthHeader } from '@root/services/sessionService';
import { dismissInsight } from '@root/services/treasuryService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ insightId: string }> },
) {
  const session = getSessionFromAuthHeader(req.headers.get('authorization'));
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { insightId } = await params;
  dismissInsight(session.wallet, insightId);
  return NextResponse.json({ ok: true });
}
